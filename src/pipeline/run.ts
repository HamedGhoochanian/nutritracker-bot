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

type RunMealPipelineDeps = {
  llmClient: LlmClientPort;
  usdaClient: UsdaFoodClient;
  offClient: OpenFoodFactsClient;
  repository: BotRepositoryPort;
};

export const runMealPipeline = async (
  mealText: string,
  deps: RunMealPipelineDeps,
): Promise<{ meal_id: string }> => {
  logger.debug({ event: "pipeline.run.start", mealText });

  const parsed = await parseMealText(mealText, deps.llmClient);
  const normalized = normalizeParsedMeal(parsed);
  const resolved = await resolveNormalizedMeal(
    normalized,
    deps.usdaClient,
    deps.offClient,
    deps.llmClient,
  );
  const computed = computeMealNutrients(resolved);
  const totals = aggregateMealNutrients(computed);

  const saved = await deps.repository.saveMeal({
    meal_text: mealText,
    parsed,
    normalized,
    resolved,
    computed,
    totals,
  });

  logger.debug({ event: "pipeline.run.end", mealId: saved.id });
  return { meal_id: saved.id };
};
