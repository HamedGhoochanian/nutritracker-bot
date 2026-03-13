import { Bot } from "grammy";
import { logger } from "./logger";
import { MealNormalizer, GeminiMealParser } from "./meal";
import { OpenFoodFactsClient } from "./openfoodfacts";
import { processMealText } from "./pipeline";
import { BotRepository } from "./repositories";
import { CandidateResolutionExecutor } from "./resolution";
import { SourceRouter } from "./source-router";
import { UsdaFoodClient } from "./usda";

export * from "./meal";
export * from "./matching";
export * from "./nutrition";
export * from "./openfoodfacts";
export * from "./pipeline";
export * from "./repositories";
export * from "./resolution";
export * from "./source-router";
export * from "./usda";

const requireEnv = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
};

const formatWorkflowResult = (result: Awaited<ReturnType<typeof processMealText>>): string => {
  const itemLines = result.computedItems.map((item) => {
    const chosen = item.selection.bestCandidate?.candidate;
    const nutrients = item.nutrients;
    const source = chosen ? `${chosen.source}:${chosen.sourceId}` : "none";

    if (!nutrients) {
      return `- ${item.item.foodName}: ${item.status} (${source})`;
    }

    return [
      `- ${item.item.foodName}: ${item.status} (${source})`,
      `${nutrients.caloriesKcal} kcal`,
      `P ${nutrients.proteinG}g`,
      `C ${nutrients.carbsG}g`,
      `F ${nutrients.fatG}g`,
      `Fi ${nutrients.fiberG}g`,
    ].join(" | ");
  });

  return [
    `Parsed ${result.parsedMeal.items.length} item(s)`,
    ...itemLines,
    "",
    `Total: ${result.aggregatedMeal.totals.caloriesKcal} kcal | P ${result.aggregatedMeal.totals.proteinG}g | C ${result.aggregatedMeal.totals.carbsG}g | F ${result.aggregatedMeal.totals.fatG}g | Fi ${result.aggregatedMeal.totals.fiberG}g`,
    `Computed ${result.aggregatedMeal.computedItemCount}, review ${result.aggregatedMeal.reviewItemCount}, unresolved ${result.aggregatedMeal.unresolvedItemCount}`,
  ].join("\n");
};

async function run(): Promise<void> {
  const botToken = requireEnv("BOT_TOKEN");
  const targetUsername = requireEnv("TARGET_USERNAME").replace(/^@/, "");

  const mealParser = new GeminiMealParser();
  const mealNormalizer = new MealNormalizer();
  const sourceRouter = new SourceRouter();
  const openFoodFactsClient = new OpenFoodFactsClient();
  const usdaClient = new UsdaFoodClient();
  const resolutionExecutor = new CandidateResolutionExecutor({
    openFoodFactsClient,
    usdaClient,
  });
  const repository = await BotRepository.create();

  const bot = new Bot(botToken);

  await bot.api.setMyCommands([{ command: "submit", description: "Submit a meal description" }]);

  bot.command("submit", async (ctx) => {
    if (ctx.from?.username !== targetUsername) {
      await ctx.reply("Unauthorized");
      return;
    }

    const text = ctx.message?.text ?? "";
    const mealText = text.replace(/^\/submit(?:@\w+)?\s*/i, "").trim();
    if (!mealText) {
      await ctx.reply("Usage: /submit <meal description>");
      return;
    }

    try {
      const result = await processMealText(
        mealText,
        {
          mealParser,
          mealNormalizer,
          sourceRouter,
          resolutionExecutor,
          repository,
          saveMeal: true,
        },
        {
          saveMeal: true,
        },
      );

      await ctx.reply(formatWorkflowResult(result));
    } catch (error: unknown) {
      logger.error({
        event: "telegram.submit.failed",
        username: ctx.from?.username,
        error: error instanceof Error ? error.message : String(error),
      });
      await ctx.reply("Failed to process meal");
    }
  });

  bot.catch((error) => {
    logger.error({
      event: "telegram.bot.error",
      error: error.error instanceof Error ? error.error.message : String(error.error),
    });
  });

  logger.info({ event: "telegram.bot.start", username: targetUsername });
  await bot.start();
}

await run();
