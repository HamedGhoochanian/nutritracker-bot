import { Bot, type Context } from "grammy";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { BarcodeReader } from "./lib/barcode";
import { logger } from "./lib/logger";
import { OpenFoodFactsClient } from "./lib/openfoodfacts";
import type { LoggedMessage, SavedProduct } from "./lib/repositories/botRepository";
import { requireTargetUsername } from "./middleware/requireTargetUsername";

type BotRepositoryLike = {
  logMessage(entry: LoggedMessage): Promise<void>;
  saveProduct(entry: SavedProduct): Promise<void>;
};

type OpenFoodFactsClientLike = {
  getProductNameById(productId: string): Promise<string | null>;
  getProduct(
    productId: string,
    fields?: readonly string[],
  ): Promise<Record<string, unknown> | null>;
};

type BarcodeReaderLike = {
  readFromImage(imageBytes: ArrayBuffer): Promise<string | null>;
};

export type CreateBotDeps = {
  token: string;
  targetUsername: string;
  repository: BotRepositoryLike;
  offClient?: OpenFoodFactsClientLike;
  barcodeReader?: BarcodeReaderLike;
  imageSaveDir?: string;
};

export const createBot = ({
  token,
  targetUsername,
  repository,
  offClient = new OpenFoodFactsClient({ baseUrl: "https://world.openfoodfacts.net" }),
  barcodeReader = new BarcodeReader(),
  imageSaveDir = path.resolve("downloads"),
}: CreateBotDeps): Bot<Context> => {
  const bot = new Bot(token);

  bot.use(requireTargetUsername(targetUsername));

  bot.hears(/^pic_save\b/i, async (ctx) => {
    const message = ctx.message;
    if (!message || !("photo" in message)) {
      await ctx.reply("Send an image with caption starting with pic_save.");
      return;
    }

    const photos = "photo" in message ? message.photo : undefined;
    const biggestPhoto = photos?.at(-1);
    if (!biggestPhoto) {
      await ctx.reply("No photo found in this message.");
      return;
    }

    try {
      logger.info({
        event: "pic_save.download_started",
        fileId: biggestPhoto.file_id,
        timestamp: new Date().toISOString(),
      });
      await mkdir(imageSaveDir, { recursive: true });
      const file = await ctx.api.getFile(biggestPhoto.file_id);
      const filePath = file.file_path;

      if (!filePath) {
        await ctx.reply("Could not resolve file path for this image.");
        return;
      }

      const fileUrl = `https://api.telegram.org/file/bot${token}/${filePath}`;
      const res = await fetch(fileUrl);
      if (!res.ok) {
        throw new Error(`Telegram file download failed with ${res.status}`);
      }

      const fileBytes = await res.arrayBuffer();
      const barcode = await barcodeReader.readFromImage(fileBytes);

      if (barcode) {
        logger.info({ event: "pic_save.barcode_detected", barcode });
        const productName = await offClient.getProductNameById(barcode);
        if (productName) {
          await repository.saveProduct({
            productId: barcode,
            productName,
            chatId: ctx.chat.id,
            userId: ctx.from?.id,
            username: ctx.from?.username,
            date: new Date().toISOString(),
          });
          await ctx.reply(`Detected barcode: ${barcode}\nProduct: ${productName}`);
        } else {
          await ctx.reply(`Detected barcode: ${barcode}, but product was not found.`);
        }
      } else {
        await ctx.reply("No barcode detected in this image.");
      }

      const extension = path.extname(filePath) || ".jpg";
      const localFileName = `photo_${message.message_id}_${Date.now()}${extension}`;
      const localPath = path.join(imageSaveDir, localFileName);
      await Bun.write(localPath, fileBytes);

      logger.info({ event: "pic_save.download_completed", localPath });
      await ctx.reply(`Saved image to ${localPath}`);
    } catch (err) {
      logger.error({ event: "pic_save.download_failed", err });
      await ctx.reply("Failed to download and save this image.");
    }
  });

  bot.command("say_name", async (ctx) => {
    const productId = ctx.match.trim();
    logger.info({
      event: "say_name.command_received",
      from: ctx.from?.username,
      chatId: ctx.chat.id,
      productId,
    });

    if (!productId) {
      logger.warn({ event: "say_name.missing_product_id" });
      await ctx.reply("Send a product id after the command, e.g. /say_name 737628064502");
      return;
    }

    try {
      logger.info({ event: "say_name.fetching_product", productId });
      const product = await offClient.getProduct(productId, [
        "code",
        "product_name",
        "product_name_en",
        "generic_name",
        "brands",
        "quantity",
      ]);

      const productName =
        (typeof product?.product_name === "string" && product.product_name) ||
        (typeof product?.product_name_en === "string" && product.product_name_en) ||
        (typeof product?.generic_name === "string" && product.generic_name) ||
        null;

      if (!productName) {
        logger.warn({
          event: "say_name.no_display_name",
          productId,
          code: product?.code,
        });
        await ctx.reply("Product not found for that product id.");
        return;
      }

      await repository.saveProduct({
        productId,
        productName,
        chatId: ctx.chat.id,
        userId: ctx.from?.id,
        username: ctx.from?.username,
        date: new Date().toISOString(),
      });
      logger.info({ event: "say_name.product_saved", productId, productName });

      const brandPart =
        typeof product?.brands === "string" && product.brands ? ` (${product.brands})` : "";
      await ctx.reply(`Product: ${productName}${brandPart}`);
    } catch (err) {
      logger.error({ event: "say_name.fetch_failed", productId, err });
      await ctx.reply("Could not fetch product for that product id.");
    }
  });

  bot.on("message", async (ctx) => {
    logger.info({
      event: "message.received",
      messageId: ctx.message.message_id,
      from: ctx.from?.username,
      chatId: ctx.chat.id,
      hasText: "text" in ctx.message,
    });
    const entry: LoggedMessage = {
      id: ctx.message.message_id,
      chatId: ctx.chat.id,
      userId: ctx.from?.id,
      username: ctx.from?.username,
      firstName: ctx.from?.first_name,
      text: "text" in ctx.message ? ctx.message.text : undefined,
      caption: "caption" in ctx.message ? ctx.message.caption : undefined,
      date: new Date(ctx.message.date * 1000).toISOString(),
    };

    await repository.logMessage(entry);
    logger.info({ event: "message.logged", messageId: ctx.message.message_id });

    await ctx.reply("Logged.");
  });

  return bot;
};
