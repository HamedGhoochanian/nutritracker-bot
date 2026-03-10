import type { NormalizedMeal, NormalizedMealItem } from "../meal";
import type { CandidateSelection } from "../matching";
import type { RoutedItemResolution } from "../resolution";

export type CanonicalNutrients = {
  caloriesKcal: number;
  proteinG: number;
  fiberG: number;
  carbsG: number;
  fatG: number;
};

export type NutrientComputationStatus = "computed" | "needs_review" | "unresolved";

export type ConsumedAmount =
  | { kind: "mass"; value: number; unit: "g" }
  | { kind: "volume"; value: number; unit: "ml" }
  | { kind: "serving"; value: number; unit: "serving" }
  | { kind: "unknown"; value: number | null; unit: "unknown" };

export type ComputedMealItemNutrition = {
  item: NormalizedMealItem;
  resolution: RoutedItemResolution;
  selection: CandidateSelection;
  consumedAmount: ConsumedAmount;
  nutrients: CanonicalNutrients | null;
  status: NutrientComputationStatus;
  warnings: string[];
};

export type MealNutritionTotals = CanonicalNutrients;

export type AggregatedMealNutrition = {
  meal: NormalizedMeal;
  items: ComputedMealItemNutrition[];
  totals: MealNutritionTotals;
  includedItemCount: number;
  computedItemCount: number;
  reviewItemCount: number;
  unresolvedItemCount: number;
  warnings: string[];
};

export interface MealNutritionComputerPort {
  computeItemNutrition(resolution: RoutedItemResolution): ComputedMealItemNutrition;
}

export interface MealNutritionAggregatorPort {
  aggregateMealNutrition(
    meal: NormalizedMeal,
    items: ComputedMealItemNutrition[],
  ): AggregatedMealNutrition;
}
