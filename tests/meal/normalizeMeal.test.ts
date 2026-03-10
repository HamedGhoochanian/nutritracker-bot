import { describe, expect, it } from "@jest/globals";
import { normalizeMeal, normalizeMealItem } from "../../src/meal/normalizeMeal";
import type { ParsedMeal, ParsedMealItem } from "../../src/meal/types";

const createParsedItem = (overrides: Partial<ParsedMealItem> = {}): ParsedMealItem => ({
  rawText: "400ml whole milk",
  foodName: "milk",
  quantity: 400,
  unit: "ml",
  amount: { kind: "volume", value: 400, unit: "ml" },
  preparation: "whole",
  brand: null,
  packagingHint: null,
  isBrandedGuess: false,
  confidence: 0.95,
  ...overrides,
});

describe("normalizeMealItem", () => {
  it("keeps grams unchanged", () => {
    const normalized = normalizeMealItem(
      createParsedItem({
        rawText: "400 g chicken",
        foodName: "chicken breast",
        quantity: 400,
        unit: "g",
        amount: { kind: "mass", value: 400, unit: "g" },
      }),
    );

    expect(normalized.normalizedAmount).toEqual({
      kind: "mass",
      value: 400,
      unit: "g",
      sourceUnit: "g",
      wasConverted: false,
    });
    expect(normalized.normalizationWarnings).toEqual([]);
  });

  it("converts kilograms and ounces into grams", () => {
    const kilograms = normalizeMealItem(
      createParsedItem({
        rawText: "0.5 kg rice",
        foodName: "rice",
        quantity: 0.5,
        unit: "kg",
        amount: { kind: "mass", value: 0.5, unit: "kg" },
      }),
    );

    const ounces = normalizeMealItem(
      createParsedItem({
        rawText: "2 oz cheese",
        foodName: "cheese",
        quantity: 2,
        unit: "oz",
        amount: { kind: "mass", value: 2, unit: "oz" },
      }),
    );

    expect(kilograms.normalizedAmount).toEqual({
      kind: "mass",
      value: 500,
      unit: "g",
      sourceUnit: "kg",
      wasConverted: true,
    });
    expect(ounces.normalizedAmount).toEqual({
      kind: "mass",
      value: 56.69904625,
      unit: "g",
      sourceUnit: "oz",
      wasConverted: true,
    });
  });

  it("converts liters and fluid ounces into milliliters", () => {
    const liters = normalizeMealItem(
      createParsedItem({
        rawText: "1.5 l juice",
        foodName: "juice",
        quantity: 1.5,
        unit: "l",
        amount: { kind: "volume", value: 1.5, unit: "l" },
      }),
    );

    const fluidOunces = normalizeMealItem(
      createParsedItem({
        rawText: "12 fl oz soda",
        foodName: "soda",
        quantity: 12,
        unit: "fl oz",
        amount: { kind: "volume", value: 12, unit: "fl oz" },
      }),
    );

    expect(liters.normalizedAmount).toEqual({
      kind: "volume",
      value: 1500,
      unit: "ml",
      sourceUnit: "l",
      wasConverted: true,
    });
    expect(fluidOunces.normalizedAmount).toEqual({
      kind: "volume",
      value: 354.88235475,
      unit: "ml",
      sourceUnit: "fl oz",
      wasConverted: true,
    });
  });

  it("keeps household and count units unresolved for food-aware resolution", () => {
    const household = normalizeMealItem(
      createParsedItem({
        rawText: "1 tbsp peanut butter",
        foodName: "peanut butter",
        quantity: 1,
        unit: "tbsp",
        amount: { kind: "household", value: 1, unit: "tbsp" },
      }),
    );

    const count = normalizeMealItem(
      createParsedItem({
        rawText: "1 banana",
        foodName: "banana",
        quantity: 1,
        unit: "piece",
        amount: { kind: "count", value: 1, unit: "piece" },
      }),
    );

    expect(household.normalizedAmount).toEqual({
      kind: "discrete",
      value: 1,
      unit: "tbsp",
      sourceUnit: "tbsp",
      requiresFoodDensity: true,
    });
    expect(household.normalizationWarnings).toEqual(["requires_food_specific_resolution"]);

    expect(count.normalizedAmount).toEqual({
      kind: "discrete",
      value: 1,
      unit: "piece",
      sourceUnit: "piece",
      requiresFoodDensity: true,
    });
    expect(count.normalizationWarnings).toEqual(["requires_food_specific_resolution"]);
  });

  it("marks unknown quantities and units with warnings", () => {
    const normalized = normalizeMealItem(
      createParsedItem({
        rawText: "some berries",
        foodName: "berries",
        quantity: null,
        unit: "unknown",
        amount: { kind: "unknown", value: null, unit: "unknown" },
      }),
    );

    expect(normalized.normalizedAmount).toEqual({
      kind: "unknown",
      value: null,
      unit: "unknown",
    });
    expect(normalized.normalizationWarnings).toEqual([
      "missing_deterministic_amount",
      "missing_quantity",
    ]);
  });
});

describe("normalizeMeal", () => {
  it("normalizes every meal item while preserving top-level fields", () => {
    const meal: ParsedMeal = {
      rawInput: "400ml milk and 1 banana",
      parserModel: "gemini-3.1-flash",
      items: [
        createParsedItem(),
        createParsedItem({
          rawText: "1 banana",
          foodName: "banana",
          quantity: 1,
          unit: "piece",
          amount: { kind: "count", value: 1, unit: "piece" },
          preparation: null,
        }),
      ],
    };

    const normalized = normalizeMeal(meal);

    expect(normalized.rawInput).toBe(meal.rawInput);
    expect(normalized.parserModel).toBe(meal.parserModel);
    expect(normalized.items).toHaveLength(2);
    expect(normalized.items[0]?.normalizedAmount).toEqual({
      kind: "volume",
      value: 400,
      unit: "ml",
      sourceUnit: "ml",
      wasConverted: false,
    });
    expect(normalized.items[1]?.normalizedAmount).toEqual({
      kind: "discrete",
      value: 1,
      unit: "piece",
      sourceUnit: "piece",
      requiresFoodDensity: true,
    });
  });
});
