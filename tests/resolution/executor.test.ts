import { describe, expect, it } from "@jest/globals";
import { CandidateResolutionExecutor } from "../../src/resolution";
import { routeNormalizedMealItem } from "../../src/source-router";
import type { NormalizedMealItem } from "../../src/meal";
import type { OpenFoodFactsClientPort } from "../../src/openfoodfacts";
import type { UsdaFoodClientPort } from "../../src/usda";

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

const createOpenFoodFactsClientMock = (): OpenFoodFactsClientPort => ({
  async getProduct() {
    return null;
  },
  async searchProducts() {
    return { products: [] };
  },
  async getProductsByBarcodePrefix() {
    return { products: [] };
  },
  forCountry() {
    return this;
  },
});

const createUsdaClientMock = (): UsdaFoodClientPort => ({
  async getFood() {
    return null;
  },
  async searchFoods() {
    return { foods: [], currentPage: 0, totalHits: 0, totalPages: 0 };
  },
});

describe("CandidateResolutionExecutor", () => {
  it("uses the primary source only when the primary match is accepted", async () => {
    const offClient = createOpenFoodFactsClientMock();
    const usdaClient: UsdaFoodClientPort = {
      ...createUsdaClientMock(),
      async searchFoods(criteria) {
        expect(criteria.query).toBe("banana");
        return {
          foods: [
            {
              fdcId: 1,
              description: "Banana, raw",
              dataType: "Foundation",
              householdServingFullText: "1 medium banana",
              servingSize: 118,
              servingSizeUnit: "g",
              foodNutrients: [
                { nutrient: { number: "208", name: "Energy" }, amount: 89 },
                { nutrient: { number: "203", name: "Protein" }, amount: 1.1 },
                { nutrient: { number: "291", name: "Fiber" }, amount: 2.6 },
              ],
            },
          ],
          currentPage: 1,
          totalHits: 1,
          totalPages: 1,
        };
      },
    };

    const executor = new CandidateResolutionExecutor({
      openFoodFactsClient: offClient,
      usdaClient,
    });
    const decision = routeNormalizedMealItem(createNormalizedItem(), {
      lowConfidenceThreshold: 0.7,
    });

    const resolved = await executor.resolveRoutedItem(decision);

    expect(resolved.usedFallback).toBe(false);
    expect(resolved.attempts).toHaveLength(1);
    expect(resolved.selection.status).toBe("accepted");
    expect(resolved.selection.bestCandidate?.candidate.source).toBe("usda");
  });

  it("falls back when the primary source does not produce an accepted match", async () => {
    let offCalls = 0;
    const offClient: OpenFoodFactsClientPort = {
      ...createOpenFoodFactsClientMock(),
      async searchProducts() {
        offCalls += 1;
        return {
          products: [
            {
              code: "5000159407236",
              product_name: "Protein snack",
              brands: "UnknownBrand",
              quantity: "45 g",
            },
          ],
        };
      },
      forCountry() {
        return this;
      },
    };

    let usdaCalls = 0;
    const usdaClient: UsdaFoodClientPort = {
      ...createUsdaClientMock(),
      async searchFoods() {
        usdaCalls += 1;
        return {
          foods: [
            {
              fdcId: 10,
              description: "Protein yogurt",
              dataType: "Foundation",
              householdServingFullText: "1 container",
              servingSize: 150,
              servingSizeUnit: "g",
              foodNutrients: [{ nutrient: { number: "203", name: "Protein" }, amount: 10 }],
            },
          ],
          currentPage: 1,
          totalHits: 1,
          totalPages: 1,
        };
      },
    };

    const executor = new CandidateResolutionExecutor({
      openFoodFactsClient: offClient,
      usdaClient,
    });
    const decision = routeNormalizedMealItem(
      createNormalizedItem({
        rawText: "protein yogurt",
        foodName: "protein yogurt",
        confidence: 0.55,
        brand: "Oikos",
        packagingHint: "container",
        isBrandedGuess: true,
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

    const resolved = await executor.resolveRoutedItem(decision, {
      acceptedScore: 45,
      reviewScore: 28,
    });

    expect(resolved.usedFallback).toBe(true);
    expect(resolved.attempts).toHaveLength(2);
    expect(offCalls + usdaCalls).toBe(2);
    expect(resolved.selection.bestCandidate).not.toBeNull();
  });

  it("uses barcode lookup for OFF barcode routes", async () => {
    let receivedBarcode: string | null = null;
    const offClient: OpenFoodFactsClientPort = {
      ...createOpenFoodFactsClientMock(),
      async getProduct(productId) {
        receivedBarcode = productId;
        return {
          code: productId,
          product_name: "Nutella",
          brands: "Nutella",
          quantity: "350 g",
          nutriments: { "energy-kcal_100g": 539, proteins_100g: 6.3, fiber_100g: 3.4 },
        };
      },
      forCountry() {
        return this;
      },
    };

    const executor = new CandidateResolutionExecutor({
      openFoodFactsClient: offClient,
      usdaClient: createUsdaClientMock(),
    });
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

    const attempt = await executor.fetchPrimaryCandidates(decision);

    expect(receivedBarcode).toBe("3017624010701");
    expect(attempt.candidates[0]).toMatchObject({
      source: "openfoodfacts",
      barcode: "3017624010701",
      nutrientPreview: {
        caloriesKcal: 539,
        proteinG: 6.3,
        fiberG: 3.4,
        basis: "per_100g",
      },
    });
  });
});
