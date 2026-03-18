import { logger } from "../logger";
import type { LlmClientPort } from "../llm";
import type { OpenFoodFactsClient } from "../openfoodfacts";
import type { BotRepositoryPort } from "../repositories";
import type { UsdaFoodClient } from "../usda";
import { aggregateMealNutrients } from "./aggregate";
import { computeMealNutrients } from "./compute";
import { normalizeParsedMeal } from "./normalize";
import { parseMealText } from "./parse";
import { resolveNormalizedMeal } from "./resolve";
import type { Nutrients } from "./types";

type RunMealPipelineDeps = {
  llmClient: LlmClientPort;
  nutritionLlmClient: LlmClientPort;
  usdaClient: UsdaFoodClient;
  offClient: OpenFoodFactsClient;
  repository: BotRepositoryPort;
};

export class MealPipeline {
  constructor(private readonly deps: RunMealPipelineDeps) {}

  async run(mealText: string): Promise<{ meal_id: string; totals: Nutrients }> {
    logger.debug({ event: "pipeline.run.start", mealText });

    const skipCache = process.env.SKIP_CACHE === "1";
    if (!skipCache) {
      const existingMeal = await this.deps.repository.findMealByText(mealText);
      if (existingMeal !== null) {
        await this.deps.repository.saveConsumption(existingMeal.id);
        logger.debug({ event: "pipeline.run.end", mealId: existingMeal.id, cacheHit: true });
        return { meal_id: existingMeal.id, totals: existingMeal.totals };
      }
    }

    const parsed = await parseMealText(mealText, this.deps.llmClient);
    const normalized = normalizeParsedMeal(parsed);
    const resolved = await resolveNormalizedMeal(
      normalized,
      this.deps.usdaClient,
      this.deps.offClient,
      this.deps.nutritionLlmClient,
    );
    const computed = computeMealNutrients(resolved);
    const totals = aggregateMealNutrients(computed);

    const saved = await this.deps.repository.saveMeal({
      meal_text: mealText,
      parsed,
      normalized,
      resolved,
      computed,
      totals,
    });
    await this.deps.repository.saveConsumption(saved.id);

    logger.debug({ event: "pipeline.run.end", mealId: saved.id, cacheHit: false });
    return { meal_id: saved.id, totals };
  }
}
