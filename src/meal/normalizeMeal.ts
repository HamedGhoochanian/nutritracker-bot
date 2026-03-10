import {
  COUNT_UNITS,
  HOUSEHOLD_UNITS,
  MASS_UNITS,
  VOLUME_UNITS,
  type MealNormalizerPort,
  type NormalizedAmount,
  type NormalizedMeal,
  type NormalizedMealItem,
  type ParsedMassUnit,
  type ParsedMeal,
  type ParsedMealItem,
  type ParsedUnit,
  type ParsedVolumeUnit,
} from "./types";

const GRAMS_PER_KILOGRAM = 1000;
const GRAMS_PER_OUNCE = 28.349523125;
const GRAMS_PER_POUND = 453.59237;
const MILLILITERS_PER_LITER = 1000;
const MILLILITERS_PER_FLUID_OUNCE = 29.5735295625;

const MASS_CONVERSIONS: Record<ParsedMassUnit, number> = {
  g: 1,
  kg: GRAMS_PER_KILOGRAM,
  oz: GRAMS_PER_OUNCE,
  lb: GRAMS_PER_POUND,
};

const VOLUME_CONVERSIONS: Record<ParsedVolumeUnit, number> = {
  ml: 1,
  l: MILLILITERS_PER_LITER,
  "fl oz": MILLILITERS_PER_FLUID_OUNCE,
};

export class MealNormalizer implements MealNormalizerPort {
  normalizeMeal(meal: ParsedMeal): NormalizedMeal {
    return normalizeMeal(meal);
  }
}

export const normalizeMeal = (meal: ParsedMeal): NormalizedMeal => {
  return {
    rawInput: meal.rawInput,
    items: meal.items.map(normalizeMealItem),
    parserModel: meal.parserModel,
  };
};

export const normalizeMealItem = (item: ParsedMealItem): NormalizedMealItem => {
  return {
    ...item,
    normalizedAmount: normalizeAmount(item),
    normalizationWarnings: buildNormalizationWarnings(item),
  };
};

const normalizeAmount = (item: ParsedMealItem): NormalizedAmount => {
  const { amount } = item;

  switch (amount.kind) {
    case "mass":
      return {
        kind: "mass",
        value: amount.value * MASS_CONVERSIONS[amount.unit],
        unit: "g",
        sourceUnit: amount.unit,
        wasConverted: amount.unit !== "g",
      };
    case "volume":
      return {
        kind: "volume",
        value: amount.value * VOLUME_CONVERSIONS[amount.unit],
        unit: "ml",
        sourceUnit: amount.unit,
        wasConverted: amount.unit !== "ml",
      };
    case "household":
    case "count":
      return {
        kind: "discrete",
        value: amount.value,
        unit: amount.unit,
        sourceUnit: amount.unit,
        requiresFoodDensity: true,
      };
    case "unknown":
      return {
        kind: "unknown",
        value: amount.value,
        unit: "unknown",
      };
  }
};

const buildNormalizationWarnings = (item: ParsedMealItem): string[] => {
  const warnings: string[] = [];

  if (item.amount.kind === "unknown") {
    warnings.push("missing_deterministic_amount");
  }

  if (item.amount.kind === "household" || item.amount.kind === "count") {
    warnings.push("requires_food_specific_resolution");
  }

  if (item.quantity === null) {
    warnings.push("missing_quantity");
  }

  return warnings;
};

export const isNormalizedMetricAmount = (
  amount: NormalizedAmount,
): amount is Extract<NormalizedAmount, { kind: "mass" | "volume" }> => {
  return amount.kind === "mass" || amount.kind === "volume";
};

export const isParsedMassUnit = (unit: ParsedUnit): unit is ParsedMassUnit => {
  return (MASS_UNITS as readonly string[]).includes(unit);
};

export const isParsedVolumeUnit = (unit: ParsedUnit): unit is ParsedVolumeUnit => {
  return (VOLUME_UNITS as readonly string[]).includes(unit);
};

export const isDiscreteUnit = (unit: ParsedUnit): boolean => {
  return (
    (HOUSEHOLD_UNITS as readonly string[]).includes(unit) ||
    (COUNT_UNITS as readonly string[]).includes(unit)
  );
};
