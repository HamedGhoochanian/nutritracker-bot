import type { ParsedMeal, NormalizedMeal } from "../meal";
import type { ComputedMealItemNutrition, AggregatedMealNutrition } from "../nutrition";
import type { RoutedItemResolution } from "../resolution";
import type { MealRouteDecision } from "../source-router";

export type SaveMealRecordInput = {
  input: string;
  parsedMeal: ParsedMeal;
  normalizedMeal: NormalizedMeal;
  routeDecision: MealRouteDecision;
  itemResolutions: RoutedItemResolution[];
  computedItems: ComputedMealItemNutrition[];
  aggregatedMeal: AggregatedMealNutrition;
};

export type PersistedMealRecord = SaveMealRecordInput & {
  id: string;
  createdAt: string;
};

export type BotRepositoryDbSchema = {
  messages: unknown[];
  products: unknown[];
  submittedItems: unknown[];
  meals: PersistedMealRecord[];
};
