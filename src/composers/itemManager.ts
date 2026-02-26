import { Composer } from "grammy";
import type { BarcodeReaderPort } from "../barcode/barcodeReader";
import { logger } from "../logger";
import type { OpenFoodFactsClientPort } from "../openfoodfacts/client";
import type { ItemRepositoryPort, SubmittedNutritionFacts } from "../repositories";
import { getMessageText } from "./getMessageText";
import type { MyContext } from "../types/context";
import { SubmitItemMode, SubmitItemState } from "../types/session";

type SubmitItemDeps = {
  token: string;
  repository: ItemRepositoryPort;
  offClient: OpenFoodFactsClientPort;
  barcodeReader: BarcodeReaderPort;
};

const COMMANDS = {
  ITEM: {
    SUBMIT: "item_submit",
    LIST: "item_list",
    DELETE: "item_delete",
    UPDATE: "item_update",
  },
} as const;
const SKIP_ALIAS_REGEX = /^skip$/i;
const DEFAULT_ITEM_LIST_RANGE = { start: 1, end: 10 } as const;
const PRODUCT_FIELDS = [
  "code",
  "product_name",
  "product_name_en",
  "generic_name",
  "brands",
  "quantity",
  "nutriments",
] as const;

export const createSubmitItemComposer = ({
  token,
  repository,
  offClient,
  barcodeReader,
}: SubmitItemDeps): Composer<MyContext> => {
  const composer = new Composer<MyContext>();

  composer.command(COMMANDS.ITEM.SUBMIT, async (ctx) => {
    beginSubmitFlow(ctx);

    await ctx.reply("Submit started. Send a barcode image or a text that includes the barcode.");
  });

  composer.command(COMMANDS.ITEM.LIST, async (ctx) => {
    const rangeQuery = ctx.match.trim();
    const range = parseRange(rangeQuery);
    if (range === "invalid") {
      await ctx.reply("Invalid range. Use /item_list or /item_list 5-10.");
      return;
    }

    const submittedItems = await repository.listSubmittedItems();
    const indexedItems = submittedItems.map((item, index) => ({
      item,
      position: index + 1,
    }));

    const selectedRange = range ?? DEFAULT_ITEM_LIST_RANGE;
    const selectedItems = indexedItems.filter(
      ({ position }) => position >= selectedRange.start && position <= selectedRange.end,
    );

    if (!selectedItems.length) {
      await ctx.reply("No submitted items in that range.");
      return;
    }

    const lines = selectedItems.map(({ item, position }) => {
      const alias = item.alias ?? "-";
      const protein = item.nutritionFacts.proteins100g ?? "-";
      const calories = item.nutritionFacts.energyKcal100g ?? "-";
      return `${position}. barcode: ${item.barcode} | name: ${item.productName} | alias: ${alias} | protein: ${protein} | calories: ${calories}`;
    });

    await ctx.reply(lines.join("\n"));
  });

  composer.command(COMMANDS.ITEM.DELETE, async (ctx) => {
    const query = ctx.match.trim();

    if (!query) {
      await ctx.reply("Send barcode or alias. Example: /item_delete greek yogurt");
      return;
    }

    const deleted = await repository.deleteSubmittedItemByAliasOrBarcode(query);
    if (!deleted) {
      await ctx.reply("Item not found for that alias or barcode.");
      return;
    }

    const alias = deleted.alias ?? "-";
    await ctx.reply(
      `Deleted item: ${deleted.productName} | barcode: ${deleted.barcode} | alias: ${alias}`,
    );
  });

  composer.command(COMMANDS.ITEM.UPDATE, async (ctx) => {
    const alias = ctx.match.trim();

    if (!alias) {
      await ctx.reply("Send alias to update. Example: /item_update greek yogurt");
      return;
    }

    const existing = await repository.findSubmittedItemByAlias(alias);
    if (!existing) {
      await ctx.reply("Alias not found.");
      return;
    }

    ctx.session.submit = {
      state: SubmitItemState.AwaitingInput,
      mode: SubmitItemMode.Update,
      updateIndex: existing.index,
    };

    await ctx.reply(
      `Updating ${existing.item.productName} (${existing.item.barcode}). Send a barcode image or text barcode.`,
    );
  });

  composer.command("cancel", async (ctx) => {
    if (ctx.session.submit.state === SubmitItemState.Idle) {
      await ctx.reply("No active submit flow.");
      return;
    }

    resetSubmitFlow(ctx);
    await ctx.reply("Submit flow cancelled.");
  });

  composer.on("message", async (ctx, next) => {
    if (ctx.session.submit.state === SubmitItemState.Idle) {
      await next();
      return;
    }

    if (ctx.session.submit.state === SubmitItemState.AwaitingInput) {
      const barcode = await resolveBarcodeFromMessage(ctx, token, barcodeReader);
      if (!barcode) {
        await ctx.reply("Could not read a barcode. Send a clearer image or a text with digits.");
        return;
      }

      try {
        const product = await offClient.getProduct(barcode, [...PRODUCT_FIELDS]);
        const productName = getProductDisplayName(product);

        if (!product || !productName) {
          await ctx.reply("Product not found for this barcode. Send another barcode.");
          return;
        }

        ctx.session.submit = {
          state: SubmitItemState.AwaitingAlias,
          mode: ctx.session.submit.mode,
          updateIndex: ctx.session.submit.updateIndex,
          pending: {
            barcode,
            productName,
            nutritionFacts: extractNutritionFacts(product),
            brand: getString(product, "brands"),
            quantity: getString(product, "quantity"),
          },
        };

        await ctx.reply(
          `Found: ${productName}. Send alias text or send \"skip\" to continue without alias.`,
        );
      } catch (err) {
        logger.error({ event: "submit_item.lookup_failed", barcode, err });
        await ctx.reply("Could not fetch this product right now. Try again.");
      }

      return;
    }

    if (ctx.session.submit.state === SubmitItemState.AwaitingAlias) {
      const pending = ctx.session.submit.pending;
      if (!pending) {
        resetSubmitFlow(ctx);
        await ctx.reply("Submit session expired. Send /item_submit to start again.");
        return;
      }

      const aliasInput = getMessageText(ctx).trim();
      if (!aliasInput) {
        await ctx.reply('Send alias text, or send "skip".');
        return;
      }

      const alias = SKIP_ALIAS_REGEX.test(aliasInput) ? undefined : aliasInput;

      const savedItem = {
        barcode: pending.barcode,
        productName: pending.productName,
        nutritionFacts: pending.nutritionFacts,
        alias,
        brand: pending.brand,
        quantity: pending.quantity,
        chatId: ctx.chat.id,
        userId: ctx.from?.id,
        username: ctx.from?.username,
        date: new Date().toISOString(),
      };

      if (
        ctx.session.submit.mode === SubmitItemMode.Update &&
        typeof ctx.session.submit.updateIndex === "number"
      ) {
        await repository.updateSubmittedItemAtIndex(ctx.session.submit.updateIndex, savedItem);
      } else {
        await repository.saveSubmittedItem(savedItem);
      }

      resetSubmitFlow(ctx);

      if (alias) {
        await ctx.reply(`Saved ${pending.productName} with alias: ${alias}`);
      } else {
        await ctx.reply(`Saved ${pending.productName} without alias.`);
      }
    }
  });

  return composer;
};

const beginSubmitFlow = (ctx: MyContext): void => {
  ctx.session.submit = {
    state: SubmitItemState.AwaitingInput,
    mode: SubmitItemMode.Create,
  };
};

const resetSubmitFlow = (ctx: MyContext): void => {
  ctx.session.submit = {
    state: SubmitItemState.Idle,
    mode: SubmitItemMode.Create,
  };
};

const resolveBarcodeFromMessage = async (
  ctx: MyContext,
  token: string,
  barcodeReader: BarcodeReaderPort,
): Promise<string | null> => {
  const message = ctx.message;
  if (!message) {
    return null;
  }

  if ("photo" in message) {
    const biggestPhoto = message.photo?.at(-1);
    if (!biggestPhoto) {
      return null;
    }

    const file = await ctx.api.getFile(biggestPhoto.file_id);
    if (!file.file_path) {
      return null;
    }

    const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
    const res = await fetch(fileUrl);
    if (!res.ok) {
      throw new Error(`Telegram file download failed with ${res.status}`);
    }

    const bytes = await res.arrayBuffer();
    return barcodeReader.readFromImage(bytes);
  }

  const text = getMessageText(ctx);
  return extractBarcodeFromText(text);
};

const extractBarcodeFromText = (text: string): string | null => {
  const matches = text.match(/(?:\d[\s-]*){8,14}/g);
  if (!matches) {
    return null;
  }

  for (const candidate of matches) {
    const digits = candidate.replace(/\D/g, "");
    if (digits.length >= 8 && digits.length <= 14) {
      return digits;
    }
  }

  return null;
};

const getProductDisplayName = (product: Record<string, unknown> | null): string | null => {
  if (!product) {
    return null;
  }

  return (
    getString(product, "product_name") ||
    getString(product, "product_name_en") ||
    getString(product, "generic_name") ||
    null
  );
};

const extractNutritionFacts = (product: Record<string, unknown>): SubmittedNutritionFacts => {
  const nutriments =
    product.nutriments && typeof product.nutriments === "object"
      ? (product.nutriments as Record<string, unknown>)
      : {};

  return {
    energyKcal100g: getNumber(nutriments, "energy-kcal_100g"),
    proteins100g: getNumber(nutriments, "proteins_100g"),
    carbohydrates100g: getNumber(nutriments, "carbohydrates_100g"),
    fat100g: getNumber(nutriments, "fat_100g"),
    sugars100g: getNumber(nutriments, "sugars_100g"),
    fiber100g: getNumber(nutriments, "fiber_100g"),
    salt100g: getNumber(nutriments, "salt_100g"),
    sodium100g: getNumber(nutriments, "sodium_100g"),
  };
};

const getNumber = (record: Record<string, unknown>, key: string): number | undefined => {
  const value = record[key];
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
};

const getString = (record: Record<string, unknown>, key: string): string | undefined => {
  const value = record[key];
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

const parseRange = (query: string): { start: number; end: number } | null | "invalid" => {
  if (!query) {
    return null;
  }

  const match = query.match(/^(\d+)\s*-\s*(\d+)$/);
  if (!match) {
    return "invalid";
  }

  const start = Number(match[1]);
  const end = Number(match[2]);
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start) {
    return "invalid";
  }

  return { start, end };
};
