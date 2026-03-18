import { Bot } from "grammy";
import { OpenRouterClient } from "./llm";
import { logger } from "./logger";
import { OpenFoodFactsClient } from "./openfoodfacts";
import { MealPipeline } from "./pipeline";
import { BotRepository } from "./repositories";
import { UsdaFoodClient } from "./usda";

const main = async (): Promise<void> => {
  const token = process.env.BOT_TOKEN;
  if (token === undefined) {
    throw new Error("BOT_TOKEN is required");
  }

  const targetUsername = process.env.TARGET_USERNAME;
  if (targetUsername === undefined) {
    throw new Error("TARGET_USERNAME is required");
  }

  const llmClient = new OpenRouterClient();
  const nutritionLlmClient = new OpenRouterClient({ model: "google/gemini-3-flash-preview" });
  const usdaClient = new UsdaFoodClient();
  const offClient = new OpenFoodFactsClient();

  let dbPath = "db.sqlite";
  if (process.env.DB_PATH !== undefined) {
    dbPath = process.env.DB_PATH;
  }

  const repository = await BotRepository.create(dbPath);
  const pipeline = new MealPipeline({
    llmClient,
    nutritionLlmClient,
    usdaClient,
    offClient,
    repository,
  });

  const bot = new Bot(token);

  bot.use(async (ctx, next) => {
    if (ctx.from?.username !== targetUsername) {
      return;
    }
    await next();
  });

  bot.command("submit", async (ctx) => {
    const mealText = ctx.match.trim();
    if (mealText.length === 0) {
      await ctx.reply("Usage: /submit <meal text>");
      return;
    }

    try {
      const result = await pipeline.run(mealText);
      let calories = "n/a";
      if (result.totals.calories !== null) {
        calories = result.totals.calories.toFixed(2);
      }

      let protein = "n/a";
      if (result.totals.protein_g !== null) {
        protein = result.totals.protein_g.toFixed(2);
      }

      let fiber = "n/a";
      if (result.totals.fiber_g !== null) {
        fiber = result.totals.fiber_g.toFixed(2);
      }

      await ctx.reply(
        `Saved meal: ${result.meal_id}\nCalories: ${calories}\nProtein (g): ${protein}\nFiber (g): ${fiber}`,
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error({ event: "bot.submit.error", message });
      await ctx.reply("Failed to submit meal");
    }
  });

  await bot.start();
};

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
