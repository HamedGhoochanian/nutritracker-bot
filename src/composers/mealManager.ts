import { Composer } from "grammy";
import type { SavedMealIngredient, SubmittedItem } from "../../lib/repositories/botRepository";
import type { MyContext } from "../types/context";
import type { BotRepositoryLike } from "../types/dependencies";
import { MealCreateState } from "../types/session";

type MealManagerDeps = {
  repository: BotRepositoryLike;
};

const COMMANDS = {
  MEAL: {
    CREATE: "meal_create",
  },
} as const;

const DONE_REGEX = /^done$/i;

export const createMealManagerComposer = ({ repository }: MealManagerDeps): Composer<MyContext> => {
  const composer = new Composer<MyContext>();

  composer.command(COMMANDS.MEAL.CREATE, async (ctx) => {
    const parsedName = parseMealName(ctx.match);
    if (!parsedName) {
      await ctx.reply(
        'Invalid meal name. Use /meal_create <name> or /meal_create "name with spaces".',
      );
      return;
    }

    const existing = await repository.findMealByName(parsedName);
    if (existing) {
      await ctx.reply("Meal name already exists.");
      return;
    }

    ctx.session.mealCreate = {
      state: MealCreateState.Collecting,
      name: parsedName,
      ingredients: [],
    };

    await ctx.reply(
      'Meal creation started. Send ingredient lines as "<barcode or alias> <amount>". Send "done" when finished.',
    );
  });

  composer.on("message", async (ctx, next) => {
    if (ctx.session.mealCreate.state !== MealCreateState.Collecting) {
      await next();
      return;
    }

    const mealName = ctx.session.mealCreate.name;
    if (!mealName) {
      resetMealFlow(ctx);
      await ctx.reply("Meal session expired. Start again with /meal_create.");
      return;
    }

    const text = getMessageText(ctx).trim();
    if (!text) {
      await ctx.reply("Send ingredient entries or send done.");
      return;
    }

    if (DONE_REGEX.test(text)) {
      if (!ctx.session.mealCreate.ingredients.length) {
        await ctx.reply("No valid ingredients yet. Add at least one ingredient before done.");
        return;
      }

      const totals = calculateTotals(ctx.session.mealCreate.ingredients);
      await repository.saveMeal({
        name: mealName,
        ingredients: ctx.session.mealCreate.ingredients,
        totalProtein: totals.totalProtein,
        totalCalories: totals.totalCalories,
        chatId: ctx.chat.id,
        userId: ctx.from?.id,
        username: ctx.from?.username,
        date: new Date().toISOString(),
      });

      resetMealFlow(ctx);

      await ctx.reply(
        `Saved meal ${mealName}. protein: ${formatNutrition(totals.totalProtein)} | calories: ${formatNutrition(totals.totalCalories)}`,
      );
      return;
    }

    const lines = text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (!lines.length) {
      await ctx.reply("Send ingredient entries or send done.");
      return;
    }

    const submittedItems = await repository.listSubmittedItems();
    const errors: string[] = [];
    let validCount = 0;

    for (const line of lines) {
      const parsed = parseIngredientLine(line);
      if (!parsed) {
        errors.push(`Invalid entry: ${line}`);
        continue;
      }

      const item = resolveSubmittedItem(submittedItems, parsed.reference);
      if (!item) {
        errors.push(`Item not found: ${parsed.reference}`);
        continue;
      }

      const ingredient: SavedMealIngredient = {
        barcode: item.barcode,
        alias: item.alias,
        productName: item.productName,
        quantity: item.quantity,
        amount: parsed.amount,
        proteins100g: item.nutritionFacts.proteins100g,
        energyKcal100g: item.nutritionFacts.energyKcal100g,
      };

      upsertLatestIngredient(ctx, ingredient);
      validCount += 1;
    }

    const responseLines: string[] = [];
    if (validCount > 0) {
      responseLines.push(`Accepted ${validCount} entr${validCount === 1 ? "y" : "ies"}.`);
    }
    if (errors.length > 0) {
      responseLines.push(...errors);
    }

    if (!responseLines.length) {
      responseLines.push("No valid entries found.");
    }

    await ctx.reply(responseLines.join("\n"));
  });

  return composer;
};

const parseMealName = (raw: string): string | null => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  const quotedMatch = trimmed.match(/^"(.+)"$/);
  if (quotedMatch) {
    const value = quotedMatch[1]?.trim();
    return value ? value : null;
  }

  return /^\S+$/.test(trimmed) ? trimmed : null;
};

const parseIngredientLine = (line: string): { reference: string; amount: number } | null => {
  const match = line.match(/^(.*\S)\s+([+-]?(?:\d+(?:\.\d+)?|\.\d+))$/);
  if (!match) {
    return null;
  }

  const reference = (match[1] ?? "").trim();
  const amount = Number(match[2]);

  if (!reference || !Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  return { reference, amount };
};

const resolveSubmittedItem = (
  submittedItems: SubmittedItem[],
  reference: string,
): SubmittedItem | null => {
  const normalized = reference.trim();
  if (!normalized) {
    return null;
  }

  return (
    submittedItems.find((item) => item.barcode === normalized) ??
    submittedItems.find((item) => item.alias?.trim() === normalized) ??
    null
  );
};

const upsertLatestIngredient = (ctx: MyContext, ingredient: SavedMealIngredient): void => {
  const current = ctx.session.mealCreate.ingredients;
  const next = current.filter((entry) => entry.barcode !== ingredient.barcode);
  next.push(ingredient);
  ctx.session.mealCreate.ingredients = next;
};

const calculateTotals = (
  ingredients: SavedMealIngredient[],
): { totalProtein: number; totalCalories: number } => {
  let totalProtein = 0;
  let totalCalories = 0;

  for (const ingredient of ingredients) {
    const proteinPer100 = ingredient.proteins100g ?? 0;
    const caloriesPer100 = ingredient.energyKcal100g ?? 0;
    totalProtein += (ingredient.amount / 100) * proteinPer100;
    totalCalories += (ingredient.amount / 100) * caloriesPer100;
  }

  return {
    totalProtein,
    totalCalories,
  };
};

const formatNutrition = (value: number): string => {
  if (!Number.isFinite(value)) {
    return "0";
  }

  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
};

const resetMealFlow = (ctx: MyContext): void => {
  ctx.session.mealCreate = {
    state: MealCreateState.Idle,
    ingredients: [],
  };
};

const getMessageText = (ctx: MyContext): string => {
  const message = ctx.message;
  if (!message) {
    return "";
  }

  if ("text" in message && typeof message.text === "string") {
    return message.text;
  }

  if ("caption" in message && typeof message.caption === "string") {
    return message.caption;
  }

  return "";
};
