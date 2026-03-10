import type { NormalizedMeal } from "../meal";
import type {
  AggregatedMealNutrition,
  ComputedMealItemNutrition,
  MealNutritionAggregatorPort,
  MealNutritionTotals,
} from "./types";
import { zeroCanonicalNutrients } from "./computeItemNutrition";

export class MealNutritionAggregator implements MealNutritionAggregatorPort {
  aggregateMealNutrition(
    meal: NormalizedMeal,
    items: ComputedMealItemNutrition[],
  ): AggregatedMealNutrition {
    return aggregateMealNutrition(meal, items);
  }
}

export const aggregateMealNutrition = (
  meal: NormalizedMeal,
  items: ComputedMealItemNutrition[],
): AggregatedMealNutrition => {
  const totals = items.reduce<MealNutritionTotals>((accumulator, item) => {
    if (!item.nutrients) {
      return accumulator;
    }

    accumulator.caloriesKcal = roundTotal(accumulator.caloriesKcal + item.nutrients.caloriesKcal);
    accumulator.proteinG = roundTotal(accumulator.proteinG + item.nutrients.proteinG);
    accumulator.fiberG = roundTotal(accumulator.fiberG + item.nutrients.fiberG);
    accumulator.carbsG = roundTotal(accumulator.carbsG + item.nutrients.carbsG);
    accumulator.fatG = roundTotal(accumulator.fatG + item.nutrients.fatG);
    return accumulator;
  }, zeroCanonicalNutrients());

  const computedItemCount = items.filter((item) => item.status === "computed").length;
  const reviewItemCount = items.filter((item) => item.status === "needs_review").length;
  const unresolvedItemCount = items.filter((item) => item.status === "unresolved").length;
  const includedItemCount = items.filter((item) => item.nutrients !== null).length;
  const warnings = [
    ...new Set(items.flatMap((item) => item.warnings)),
    ...(unresolvedItemCount > 0 ? ["meal_contains_unresolved_items"] : []),
    ...(reviewItemCount > 0 ? ["meal_contains_review_items"] : []),
  ];

  return {
    meal,
    items,
    totals,
    includedItemCount,
    computedItemCount,
    reviewItemCount,
    unresolvedItemCount,
    warnings,
  };
};

const roundTotal = (value: number): number => {
  return Number(value.toFixed(2));
};
