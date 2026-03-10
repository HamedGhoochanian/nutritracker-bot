import type { MealNormalizerPort, MealParserPort, NormalizedMeal } from "../meal";
import type { CandidateMatcherOptions } from "../matching";
import type { AggregatedMealNutrition, ComputedMealItemNutrition } from "../nutrition";
import type { BotRepositoryPort, PersistedMealRecord, SaveMealRecordInput } from "../repositories";
import type { RoutedItemResolution } from "../resolution";
import type { MealRouteDecision, SourceRouterPort } from "../source-router";
import type { CandidateResolutionExecutorPort } from "../resolution";

export type ProcessMealTextDependencies = {
  mealParser: MealParserPort;
  mealNormalizer: MealNormalizerPort;
  sourceRouter: SourceRouterPort;
  resolutionExecutor: CandidateResolutionExecutorPort;
  saveMeal?: boolean;
  repository?: BotRepositoryPort;
};

export type ProcessMealTextOptions = {
  matcher?: CandidateMatcherOptions;
  saveMeal?: boolean;
};

export type ProcessMealTextResult = {
  input: string;
  parsedMeal: Awaited<ReturnType<MealParserPort["parseMeal"]>>;
  normalizedMeal: NormalizedMeal;
  routeDecision: MealRouteDecision;
  itemResolutions: RoutedItemResolution[];
  computedItems: ComputedMealItemNutrition[];
  aggregatedMeal: AggregatedMealNutrition;
  savedMeal: PersistedMealRecord | null;
};

export type MealPipelineRecordInput = SaveMealRecordInput;
