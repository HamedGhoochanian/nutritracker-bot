import { z } from "zod";
import { logger } from "../logger";
import { ComputedMealSchema, NutrientsSchema } from "./types";
import type {
  ComputedMeal,
  ComputedMealItem,
  Nutrients,
  ResolvedMeal,
  ResolvedMealItem,
} from "./types";

const NullableNumberSchema = z.coerce
  .number()
  .refine((value) => Number.isFinite(value))
  .nullable();

const UsdaNutrientSchema = z
  .object({
    nutrientNumber: z.string(),
    value: z.coerce.number().refine((value) => Number.isFinite(value)),
  })
  .passthrough();

const UsdaFoodNutrientsSchema = z.array(UsdaNutrientSchema);

const OffNutrimentsSchema = z
  .object({
    "energy-kcal_100g": NullableNumberSchema.optional(),
    proteins_100g: NullableNumberSchema.optional(),
    fiber_100g: NullableNumberSchema.optional(),
  })
  .passthrough();

const extractUsdaNutrientsPer100 = (item: ResolvedMealItem): Nutrients | null => {
  const selected = item.selected_candidate;
  if (selected === null) {
    return null;
  }

  const rawFoodNutrients = selected.raw.foodNutrients;
  const parsed = UsdaFoodNutrientsSchema.safeParse(rawFoodNutrients);
  if (!parsed.success) {
    return null;
  }

  let calories: number | null = null;
  let protein: number | null = null;
  let fiber: number | null = null;

  for (const nutrient of parsed.data) {
    if (nutrient.nutrientNumber === "208") {
      calories = nutrient.value;
      continue;
    }

    if (nutrient.nutrientNumber === "203") {
      protein = nutrient.value;
      continue;
    }

    if (nutrient.nutrientNumber === "291") {
      fiber = nutrient.value;
    }
  }

  const nutrients = NutrientsSchema.parse({
    calories,
    protein_g: protein,
    fiber_g: fiber,
  });

  if (nutrients.calories === null && nutrients.protein_g === null && nutrients.fiber_g === null) {
    return null;
  }

  return nutrients;
};

const extractOffNutrientsPer100 = (item: ResolvedMealItem): Nutrients | null => {
  const selected = item.selected_candidate;
  if (selected === null) {
    return null;
  }

  const rawNutriments = selected.raw.nutriments;
  const parsed = OffNutrimentsSchema.safeParse(rawNutriments);
  if (!parsed.success) {
    return null;
  }

  let calories: number | null = null;
  if (parsed.data["energy-kcal_100g"] !== undefined) {
    calories = parsed.data["energy-kcal_100g"];
  }

  let protein: number | null = null;
  if (parsed.data.proteins_100g !== undefined) {
    protein = parsed.data.proteins_100g;
  }

  let fiber: number | null = null;
  if (parsed.data.fiber_100g !== undefined) {
    fiber = parsed.data.fiber_100g;
  }

  const nutrients = NutrientsSchema.parse({
    calories,
    protein_g: protein,
    fiber_g: fiber,
  });

  if (nutrients.calories === null && nutrients.protein_g === null && nutrients.fiber_g === null) {
    return null;
  }

  return nutrients;
};

const getScaleFactor = (item: ResolvedMealItem): number => {
  if (item.unit === "piece") {
    return item.quantity;
  }

  return item.quantity / 100;
};

const scaleNutrients = (nutrientsPer100: Nutrients, scaleFactor: number): Nutrients => {
  let calories: number | null = null;
  if (nutrientsPer100.calories !== null) {
    calories = nutrientsPer100.calories * scaleFactor;
  }

  let protein: number | null = null;
  if (nutrientsPer100.protein_g !== null) {
    protein = nutrientsPer100.protein_g * scaleFactor;
  }

  let fiber: number | null = null;
  if (nutrientsPer100.fiber_g !== null) {
    fiber = nutrientsPer100.fiber_g * scaleFactor;
  }

  return NutrientsSchema.parse({
    calories,
    protein_g: protein,
    fiber_g: fiber,
  });
};

const computeItem = (item: ResolvedMealItem): ComputedMealItem => {
  const selected = item.selected_candidate;
  if (selected === null) {
    logger.debug({
      event: "pipeline.compute.item",
      foodName: item.food_name,
      status: "no_candidate",
    });
    return {
      ...item,
      nutrients_per_100: null,
      nutrients_total: null,
      scale_factor: null,
    };
  }

  let nutrientsPer100: Nutrients | null = null;
  if (selected.source === "usda") {
    nutrientsPer100 = extractUsdaNutrientsPer100(item);
  }

  if (selected.source === "off" || selected.source === "llm") {
    nutrientsPer100 = extractOffNutrientsPer100(item);
  }

  if (nutrientsPer100 === null) {
    logger.debug({
      event: "pipeline.compute.item",
      foodName: item.food_name,
      source: selected.source,
      selectedCandidateId: selected.id,
      status: "no_nutrients",
    });
    return {
      ...item,
      nutrients_per_100: null,
      nutrients_total: null,
      scale_factor: null,
    };
  }

  const scaleFactor = getScaleFactor(item);
  const nutrientsTotal = scaleNutrients(nutrientsPer100, scaleFactor);
  logger.debug({
    event: "pipeline.compute.item",
    foodName: item.food_name,
    source: selected.source,
    selectedCandidateId: selected.id,
    quantity: item.quantity,
    unit: item.unit,
    scaleFactor,
    nutrientsPer100,
    nutrientsTotal,
  });

  return {
    ...item,
    nutrients_per_100: nutrientsPer100,
    nutrients_total: nutrientsTotal,
    scale_factor: scaleFactor,
  };
};

export const computeMealNutrients = (resolvedMeal: ResolvedMeal): ComputedMeal => {
  logger.debug({ event: "pipeline.compute.request", itemCount: resolvedMeal.items.length });
  const computed = ComputedMealSchema.parse({
    items: resolvedMeal.items.map((item) => computeItem(item)),
  });
  logger.debug({ event: "pipeline.compute.response", itemCount: computed.items.length });
  return computed;
};
