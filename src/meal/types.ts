export const MASS_UNITS = ["g", "kg", "oz", "lb"] as const;
export const VOLUME_UNITS = ["ml", "l", "fl oz"] as const;
export const HOUSEHOLD_UNITS = ["tsp", "tbsp", "cup"] as const;
export const COUNT_UNITS = [
  "piece",
  "slice",
  "serving",
  "can",
  "bottle",
  "packet",
  "bar",
  "container",
  "jar",
  "clove",
] as const;

export type ParsedMassUnit = (typeof MASS_UNITS)[number];
export type ParsedVolumeUnit = (typeof VOLUME_UNITS)[number];
export type ParsedHouseholdUnit = (typeof HOUSEHOLD_UNITS)[number];
export type ParsedCountUnit = (typeof COUNT_UNITS)[number];
export type ParsedUnit =
  | ParsedMassUnit
  | ParsedVolumeUnit
  | ParsedHouseholdUnit
  | ParsedCountUnit
  | "unknown";

export type ParsedAmount =
  | { kind: "mass"; value: number; unit: ParsedMassUnit }
  | { kind: "volume"; value: number; unit: ParsedVolumeUnit }
  | { kind: "household"; value: number; unit: ParsedHouseholdUnit }
  | { kind: "count"; value: number; unit: ParsedCountUnit }
  | { kind: "unknown"; value: number | null; unit: "unknown" };

export type ParsedMealItem = {
  rawText: string;
  foodName: string;
  quantity: number | null;
  unit: ParsedUnit;
  amount: ParsedAmount;
  preparation: string | null;
  brand: string | null;
  packagingHint: string | null;
  isBrandedGuess: boolean;
  confidence: number;
};

export type ParsedMeal = {
  rawInput: string;
  items: ParsedMealItem[];
  parserModel: string;
};

export type NormalizedMetricMassUnit = "g";
export type NormalizedMetricVolumeUnit = "ml";
export type NormalizedDiscreteUnit = ParsedHouseholdUnit | ParsedCountUnit;

export type NormalizedAmount =
  | {
      kind: "mass";
      value: number;
      unit: NormalizedMetricMassUnit;
      sourceUnit: ParsedMassUnit;
      wasConverted: boolean;
    }
  | {
      kind: "volume";
      value: number;
      unit: NormalizedMetricVolumeUnit;
      sourceUnit: ParsedVolumeUnit;
      wasConverted: boolean;
    }
  | {
      kind: "discrete";
      value: number;
      unit: NormalizedDiscreteUnit;
      sourceUnit: ParsedHouseholdUnit | ParsedCountUnit;
      requiresFoodDensity: boolean;
    }
  | { kind: "unknown"; value: number | null; unit: "unknown" };

export type NormalizedMealItem = ParsedMealItem & {
  normalizedAmount: NormalizedAmount;
  normalizationWarnings: string[];
};

export type NormalizedMeal = {
  rawInput: string;
  items: NormalizedMealItem[];
  parserModel: string;
};

export type MealParserOptions = {
  apiKey?: string;
  model?: string;
  timeoutMs?: number;
};

export interface MealParserPort {
  parseMeal(input: string): Promise<ParsedMeal>;
}

export interface MealNormalizerPort {
  normalizeMeal(meal: ParsedMeal): NormalizedMeal;
}
