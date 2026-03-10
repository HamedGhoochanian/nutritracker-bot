import { describe, expect, it } from "@jest/globals";
import { selectBestCandidate } from "../../src/matching";
import type { NormalizedMealItem } from "../../src/meal";
import type { RetrievedFoodCandidate } from "../../src/resolution";

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
  confidence: 0.96,
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

const createCandidate = (
  overrides: Partial<RetrievedFoodCandidate> = {},
): RetrievedFoodCandidate => ({
  source: "usda",
  sourceId: "1",
  name: "Banana, raw",
  displayName: "Banana, raw",
  brand: null,
  category: "Foundation",
  quantityText: null,
  barcode: null,
  dataType: "Foundation",
  servingSize: 118,
  servingUnit: "g",
  householdServingText: "1 medium banana",
  nutrientPreview: {
    caloriesKcal: 89,
    proteinG: 1.1,
    fiberG: 2.6,
    carbsG: 22.8,
    fatG: 0.3,
    basis: "per_100g",
    basisAmount: 100,
    basisUnit: "g",
  },
  raw: { fdcId: 1, description: "Banana, raw" },
  ...overrides,
});

describe("selectBestCandidate", () => {
  it("accepts a strong generic USDA match", () => {
    const item = createNormalizedItem();
    const selection = selectBestCandidate(
      item,
      [
        createCandidate(),
        createCandidate({
          source: "openfoodfacts",
          sourceId: "off-1",
          name: "Banana chips",
          displayName: "Banana chips",
          category: "snacks",
          servingSize: null,
          servingUnit: null,
          householdServingText: null,
        }),
      ],
      { preferredSource: "usda" },
    );

    expect(selection.status).toBe("accepted");
    expect(selection.bestCandidate?.candidate.source).toBe("usda");
    expect(selection.bestCandidate?.breakdown.reasons).toEqual(
      expect.arrayContaining(["preferred_source_bonus", "partial_name_match"]),
    );
  });

  it("prefers branded OFF candidate for branded packaged food", () => {
    const item = createNormalizedItem({
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
    });

    const selection = selectBestCandidate(
      item,
      [
        createCandidate({
          source: "usda",
          sourceId: "usda-10",
          name: "Chocolate bar",
          displayName: "Chocolate bar",
          brand: null,
          category: "Branded",
          servingSize: 50,
          servingUnit: "g",
          householdServingText: "1 bar",
        }),
        createCandidate({
          source: "openfoodfacts",
          sourceId: "off-10",
          name: "Snickers bar",
          displayName: "Snickers Snickers bar",
          brand: "Snickers",
          category: "Chocolate bars",
          quantityText: "50 g",
          servingSize: null,
          servingUnit: null,
          householdServingText: "1 bar",
          raw: { code: "5000159407236", product_name: "Snickers bar" },
        }),
      ],
      { preferredSource: "openfoodfacts" },
    );

    expect(selection.status).toBe("accepted");
    expect(selection.bestCandidate?.candidate.source).toBe("openfoodfacts");
    expect(selection.bestCandidate?.breakdown.reasons).toEqual(
      expect.arrayContaining(["exact_brand_match", "packaging_match", "preferred_source_bonus"]),
    );
  });

  it("gives barcode matches a strong bonus", () => {
    const item = createNormalizedItem({
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
    });

    const selection = selectBestCandidate(item, [
      createCandidate({
        source: "openfoodfacts",
        sourceId: "off-nutella",
        name: "Nutella",
        displayName: "Nutella",
        brand: "Nutella",
        category: "Spreads",
        barcode: "3017624010701",
        quantityText: "350 g",
        householdServingText: "1 tbsp",
        raw: { code: "3017624010701", product_name: "Nutella" },
      }),
    ]);

    expect(selection.status).toBe("accepted");
    expect(selection.bestCandidate?.breakdown.barcodeScore).toBe(25);
  });

  it("marks weak matches as unresolved", () => {
    const item = createNormalizedItem({ foodName: "dragonfruit smoothie bowl" });
    const selection = selectBestCandidate(item, [
      createCandidate({
        sourceId: "weak-1",
        name: "bread",
        displayName: "bread",
        category: "Bakery",
        householdServingText: null,
        servingSize: null,
        servingUnit: null,
        nutrientPreview: {
          caloriesKcal: null,
          proteinG: null,
          fiberG: null,
          carbsG: null,
          fatG: null,
          basis: "unknown",
          basisAmount: null,
          basisUnit: "unknown",
        },
      }),
    ]);

    expect(selection.status).toBe("unresolved");
    expect(selection.bestCandidate?.score).toBeLessThan(selection.thresholds.reviewScore);
  });
});
