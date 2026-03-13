import { logger } from "../logger";
import { NutrientsSchema } from "./types";
import type { ComputedMeal, Nutrients } from "./types";

const sumNullable = (values: Array<number | null>): number | null => {
  let sum = 0;
  let hasValue = false;

  for (const value of values) {
    if (value === null) {
      continue;
    }

    sum += value;
    hasValue = true;
  }

  if (!hasValue) {
    return null;
  }

  return sum;
};

export const aggregateMealNutrients = (computedMeal: ComputedMeal): Nutrients => {
  const totals = NutrientsSchema.parse({
    calories: sumNullable(computedMeal.items.map((item) => item.nutrients_total?.calories ?? null)),
    protein_g: sumNullable(
      computedMeal.items.map((item) => item.nutrients_total?.protein_g ?? null),
    ),
    fiber_g: sumNullable(computedMeal.items.map((item) => item.nutrients_total?.fiber_g ?? null)),
  });

  logger.debug({ event: "pipeline.aggregate.response", totals });
  return totals;
};
