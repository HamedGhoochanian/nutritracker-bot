import { describe, expect, it } from "@jest/globals";
import { routeNormalizedMeal, routeNormalizedMealItem } from "../../src/source-router";
import type { NormalizedMeal, NormalizedMealItem } from "../../src/meal";

const createNormalizedItem = (overrides: Partial<NormalizedMealItem> = {}): NormalizedMealItem => ({
  rawText: "banana",
  foodName: "banana",
  quantity: 1,
  unit: "piece",
  amount: { kind: "count", value: 1, unit: "piece" },
  preparation: null,
  brand: null,
  packagingHint: null,
  isBrandedGuess: false,
  confidence: 0.95,
  normalizedAmount: {
    kind: "discrete",
    value: 1,
    unit: "piece",
    sourceUnit: "piece",
    requiresFoodDensity: true,
  },
  normalizationWarnings: ["requires_food_specific_resolution"],
  ...overrides,
});

describe("routeNormalizedMealItem", () => {
  it("routes generic foods to USDA first with OFF fallback", () => {
    const decision = routeNormalizedMealItem(
      createNormalizedItem({
        rawText: "400 ml whole milk",
        foodName: "milk",
        quantity: 400,
        unit: "ml",
        amount: { kind: "volume", value: 400, unit: "ml" },
        preparation: "whole",
        normalizedAmount: {
          kind: "volume",
          value: 400,
          unit: "ml",
          sourceUnit: "ml",
          wasConverted: false,
        },
        normalizationWarnings: [],
      }),
    );

    expect(decision.classification).toBe("generic");
    expect(decision.primarySource).toBe("usda");
    expect(decision.fallbackSource).toBe("openfoodfacts");
    expect(decision.reasons).toEqual(
      expect.arrayContaining(["generic_food", "preparation_heavy", "metric_amount"]),
    );
    expect(decision.queryPlan.primary).toMatchObject({
      source: "usda",
      mode: "search",
      searchCriteria: {
        query: "milk, whole",
        dataType: ["Foundation", "SR Legacy", "Survey (FNDDS)"],
      },
    });
  });

  it("routes branded packaged foods to OFF first", () => {
    const decision = routeNormalizedMealItem(
      createNormalizedItem({
        rawText: "1 Snickers bar",
        foodName: "snickers bar",
        brand: "Snickers",
        packagingHint: "bar",
        isBrandedGuess: true,
        normalizedAmount: {
          kind: "discrete",
          value: 1,
          unit: "bar",
          sourceUnit: "bar",
          requiresFoodDensity: true,
        },
      }),
    );

    expect(decision.classification).toBe("likely_branded");
    expect(decision.primarySource).toBe("openfoodfacts");
    expect(decision.fallbackSource).toBe("usda");
    expect(decision.reasons).toEqual(
      expect.arrayContaining([
        "explicit_brand",
        "branded_guess",
        "packaging_hint",
        "packaged_unit",
      ]),
    );
    expect(decision.queryPlan.primary).toMatchObject({
      source: "openfoodfacts",
      mode: "search",
      queryText: "Snickers snickers bar bar",
    });
    expect(decision.queryPlan.fallback).toMatchObject({
      source: "usda",
      searchCriteria: {
        query: "snickers bar",
        brandOwner: "Snickers",
        dataType: ["Branded"],
      },
    });
  });

  it("routes barcode-like text to OFF barcode lookup first", () => {
    const decision = routeNormalizedMealItem(
      createNormalizedItem({
        rawText: "3017624010701 nutella jar",
        foodName: "nutella",
        brand: "Nutella",
        packagingHint: "jar",
        isBrandedGuess: true,
        normalizedAmount: {
          kind: "discrete",
          value: 1,
          unit: "jar",
          sourceUnit: "jar",
          requiresFoodDensity: true,
        },
      }),
    );

    expect(decision.classification).toBe("barcode_like");
    expect(decision.primarySource).toBe("openfoodfacts");
    expect(decision.queryPlan.primary).toEqual({
      source: "openfoodfacts",
      mode: "barcode_lookup",
      barcode: "3017624010701",
      queryText: "Nutella nutella jar",
      country: "world",
    });
  });

  it("keeps ambiguous low-confidence items heuristic-first with fallback", () => {
    const decision = routeNormalizedMealItem(
      createNormalizedItem({
        rawText: "protein yogurt",
        foodName: "protein yogurt",
        confidence: 0.55,
        normalizedAmount: {
          kind: "discrete",
          value: 1,
          unit: "serving",
          sourceUnit: "serving",
          requiresFoodDensity: true,
        },
      }),
      { lowConfidenceThreshold: 0.7 },
    );

    expect(decision.strategy).toBe("heuristic_first_with_fallback");
    expect(decision.classification).toBe("ambiguous");
    expect(decision.primarySource).toBe("usda");
    expect(decision.fallbackSource).toBe("openfoodfacts");
    expect(decision.reasons).toEqual(
      expect.arrayContaining([
        "requires_food_specific_resolution",
        "low_parser_confidence",
        "product_wording",
      ]),
    );
  });
});

describe("routeNormalizedMeal", () => {
  it("routes every item in a normalized meal", () => {
    const meal: NormalizedMeal = {
      rawInput: "banana and snickers bar",
      parserModel: "gemini-3.1-flash",
      items: [
        createNormalizedItem(),
        createNormalizedItem({
          rawText: "1 snickers bar",
          foodName: "snickers bar",
          brand: "Snickers",
          packagingHint: "bar",
          isBrandedGuess: true,
          normalizedAmount: {
            kind: "discrete",
            value: 1,
            unit: "bar",
            sourceUnit: "bar",
            requiresFoodDensity: true,
          },
        }),
      ],
    };

    const decision = routeNormalizedMeal(meal);

    expect(decision.meal).toBe(meal);
    expect(decision.items).toHaveLength(2);
    expect(decision.items[0]?.primarySource).toBe("usda");
    expect(decision.items[1]?.primarySource).toBe("openfoodfacts");
  });
});
