import { describe, expect, it } from "@jest/globals";
import {
  normalizeMeal,
  type MealNormalizerPort,
  type MealParserPort,
  type ParsedMeal,
} from "../../src/meal";
import { processMealText } from "../../src/pipeline";
import type {
  BotRepositoryPort,
  PersistedMealRecord,
  SaveMealRecordInput,
} from "../../src/repositories";
import { CandidateResolutionExecutor } from "../../src/resolution";
import { SourceRouter } from "../../src/source-router";
import type { OpenFoodFactsClientPort } from "../../src/openfoodfacts";
import type { UsdaFoodClientPort } from "../../src/usda";

class StubMealParser implements MealParserPort {
  constructor(private readonly meal: ParsedMeal) {}

  async parseMeal(): Promise<ParsedMeal> {
    return this.meal;
  }
}

class StubMealNormalizer implements MealNormalizerPort {
  normalizeMeal(meal: ParsedMeal) {
    return normalizeMeal(meal);
  }
}

class MemoryRepository implements BotRepositoryPort {
  public saved: PersistedMealRecord[] = [];

  async saveMeal(record: SaveMealRecordInput): Promise<PersistedMealRecord> {
    const persisted: PersistedMealRecord = {
      ...record,
      id: `meal-${this.saved.length + 1}`,
      createdAt: "2026-03-10T00:00:00.000Z",
    };
    this.saved.push(persisted);
    return persisted;
  }
}

const createOpenFoodFactsClientMock = (): OpenFoodFactsClientPort => ({
  async getProduct(productId: string) {
    if (productId === "5000159407236") {
      return {
        code: productId,
        product_name: "Snickers bar",
        brands: "Snickers",
        quantity: "50 g",
        nutriments: {
          "energy-kcal_100g": 488,
          proteins_100g: 8,
          fiber_100g: 2.5,
          carbohydrates_100g: 60,
          fat_100g: 24,
        },
      };
    }

    return null;
  },
  async searchProducts(params) {
    const query = String(params.search_terms ?? "").toLowerCase();
    if (query.includes("snickers")) {
      return {
        products: [
          {
            code: "5000159407236",
            product_name: "Snickers bar",
            brands: "Snickers",
            quantity: "50 g",
            nutriments: {
              "energy-kcal_serving": 244,
              proteins_serving: 4,
              fiber_serving: 1.25,
              carbohydrates_serving: 30,
              fat_serving: 12,
            },
          },
        ],
      };
    }

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
  async searchFoods(criteria) {
    const query = criteria.query.toLowerCase();
    if (query.includes("milk")) {
      return {
        foods: [
          {
            fdcId: 100,
            description: "Milk, whole",
            dataType: "Branded",
            servingSize: 100,
            servingSizeUnit: "ml",
            householdServingFullText: "100 ml",
            foodNutrients: [
              { nutrient: { number: "208", name: "Energy" }, amount: 61 },
              { nutrient: { number: "203", name: "Protein" }, amount: 3.2 },
              { nutrient: { number: "291", name: "Fiber" }, amount: 0 },
              { nutrient: { number: "205", name: "Carbohydrate, by difference" }, amount: 4.8 },
              { nutrient: { number: "204", name: "Total lipid (fat)" }, amount: 3.3 },
            ],
          },
        ],
        currentPage: 1,
        totalHits: 1,
        totalPages: 1,
      };
    }

    if (query.includes("banana")) {
      return {
        foods: [
          {
            fdcId: 101,
            description: "Banana, raw",
            dataType: "Branded",
            servingSize: 1,
            servingSizeUnit: "g",
            householdServingFullText: "1 serving",
            foodNutrients: [
              { nutrient: { number: "208", name: "Energy" }, amount: 105 },
              { nutrient: { number: "203", name: "Protein" }, amount: 1.3 },
              { nutrient: { number: "291", name: "Fiber" }, amount: 3.1 },
              { nutrient: { number: "205", name: "Carbohydrate, by difference" }, amount: 27 },
              { nutrient: { number: "204", name: "Total lipid (fat)" }, amount: 0.4 },
            ],
          },
        ],
        currentPage: 1,
        totalHits: 1,
        totalPages: 1,
      };
    }

    return { foods: [], currentPage: 0, totalHits: 0, totalPages: 0 };
  },
});

describe("processMealText", () => {
  it("processes text input through meal totals and persistence", async () => {
    const parsedMeal: ParsedMeal = {
      rawInput: "400ml of whole milk with a banana and one snickers bar",
      parserModel: "gemini-3.1-flash",
      items: [
        {
          rawText: "400ml of whole milk",
          foodName: "milk",
          quantity: 400,
          unit: "ml",
          amount: { kind: "volume", value: 400, unit: "ml" },
          preparation: "whole",
          brand: null,
          packagingHint: null,
          isBrandedGuess: false,
          confidence: 0.98,
        },
        {
          rawText: "a banana",
          foodName: "banana",
          quantity: 1,
          unit: "piece",
          amount: { kind: "count", value: 1, unit: "piece" },
          preparation: null,
          brand: null,
          packagingHint: null,
          isBrandedGuess: false,
          confidence: 0.99,
        },
        {
          rawText: "one snickers bar",
          foodName: "snickers bar",
          quantity: 1,
          unit: "bar",
          amount: { kind: "count", value: 1, unit: "bar" },
          preparation: null,
          brand: "Snickers",
          packagingHint: "bar",
          isBrandedGuess: true,
          confidence: 0.97,
        },
      ],
    };

    const repository = new MemoryRepository();
    const result = await processMealText("meal text", {
      mealParser: new StubMealParser(parsedMeal),
      mealNormalizer: new StubMealNormalizer(),
      sourceRouter: new SourceRouter(),
      resolutionExecutor: new CandidateResolutionExecutor({
        openFoodFactsClient: createOpenFoodFactsClientMock(),
        usdaClient: createUsdaClientMock(),
      }),
      repository,
      saveMeal: true,
    });

    expect(result.aggregatedMeal.computedItemCount).toBe(3);
    expect(result.aggregatedMeal.unresolvedItemCount).toBe(0);
    expect(result.aggregatedMeal.totals).toEqual({
      caloriesKcal: 593,
      proteinG: 18.1,
      fiberG: 4.35,
      carbsG: 76.2,
      fatG: 25.6,
    });
    expect(result.savedMeal?.aggregatedMeal.totals).toEqual(result.aggregatedMeal.totals);
    expect(repository.saved).toHaveLength(1);
  });

  it("uses fallback and still returns totals when primary source is weak", async () => {
    const parsedMeal: ParsedMeal = {
      rawInput: "protein yogurt",
      parserModel: "gemini-3.1-flash",
      items: [
        {
          rawText: "protein yogurt",
          foodName: "protein yogurt",
          quantity: 1,
          unit: "serving",
          amount: { kind: "count", value: 1, unit: "serving" },
          preparation: null,
          brand: "Oikos",
          packagingHint: "container",
          isBrandedGuess: true,
          confidence: 0.55,
        },
      ],
    };

    const offClient: OpenFoodFactsClientPort = {
      async getProduct() {
        return null;
      },
      async searchProducts() {
        return {
          products: [
            {
              code: "weak-off",
              product_name: "Protein snack",
              brands: "Unknown",
              quantity: "40 g",
              nutriments: {
                "energy-kcal_100g": 100,
                proteins_100g: 5,
                carbohydrates_100g: 10,
                fat_100g: 2,
                fiber_100g: 1,
              },
            },
          ],
        };
      },
      async getProductsByBarcodePrefix() {
        return { products: [] };
      },
      forCountry() {
        return this;
      },
    };

    const usdaClient: UsdaFoodClientPort = {
      async getFood() {
        return null;
      },
      async searchFoods() {
        return {
          foods: [
            {
              fdcId: 303,
              description: "Protein yogurt",
              dataType: "Branded",
              brandOwner: "Oikos",
              servingSize: 1,
              servingSizeUnit: "g",
              householdServingFullText: "1 serving",
              foodNutrients: [
                { nutrient: { number: "208", name: "Energy" }, amount: 150 },
                { nutrient: { number: "203", name: "Protein" }, amount: 15 },
                { nutrient: { number: "291", name: "Fiber" }, amount: 0 },
                { nutrient: { number: "205", name: "Carbohydrate, by difference" }, amount: 10 },
                { nutrient: { number: "204", name: "Total lipid (fat)" }, amount: 3 },
              ],
            },
          ],
          currentPage: 1,
          totalHits: 1,
          totalPages: 1,
        };
      },
    };

    const result = await processMealText("protein yogurt", {
      mealParser: new StubMealParser(parsedMeal),
      mealNormalizer: new StubMealNormalizer(),
      sourceRouter: new SourceRouter({ lowConfidenceThreshold: 0.7 }),
      resolutionExecutor: new CandidateResolutionExecutor({
        openFoodFactsClient: offClient,
        usdaClient,
      }),
    });

    expect(result.itemResolutions[0]?.usedFallback).toBe(true);
    expect(result.aggregatedMeal.totals).toEqual({
      caloriesKcal: 150,
      proteinG: 15,
      fiberG: 0,
      carbsG: 10,
      fatG: 3,
    });
  });

  it("keeps unresolved items visible when nutrients cannot be computed", async () => {
    const parsedMeal: ParsedMeal = {
      rawInput: "1 tbsp peanut butter",
      parserModel: "gemini-3.1-flash",
      items: [
        {
          rawText: "1 tbsp peanut butter",
          foodName: "peanut butter",
          quantity: 1,
          unit: "tbsp",
          amount: { kind: "household", value: 1, unit: "tbsp" },
          preparation: null,
          brand: null,
          packagingHint: null,
          isBrandedGuess: false,
          confidence: 0.95,
        },
      ],
    };

    const usdaClient: UsdaFoodClientPort = {
      async getFood() {
        return null;
      },
      async searchFoods() {
        return {
          foods: [
            {
              fdcId: 401,
              description: "Peanut butter",
              dataType: "Foundation",
              foodNutrients: [
                { nutrient: { number: "208", name: "Energy" }, amount: 588 },
                { nutrient: { number: "203", name: "Protein" }, amount: 25 },
                { nutrient: { number: "291", name: "Fiber" }, amount: 6 },
                { nutrient: { number: "205", name: "Carbohydrate, by difference" }, amount: 20 },
                { nutrient: { number: "204", name: "Total lipid (fat)" }, amount: 50 },
              ],
            },
          ],
          currentPage: 1,
          totalHits: 1,
          totalPages: 1,
        };
      },
    };

    const result = await processMealText("1 tbsp peanut butter", {
      mealParser: new StubMealParser(parsedMeal),
      mealNormalizer: new StubMealNormalizer(),
      sourceRouter: new SourceRouter(),
      resolutionExecutor: new CandidateResolutionExecutor({
        openFoodFactsClient: createOpenFoodFactsClientMock(),
        usdaClient,
      }),
    });

    expect(result.aggregatedMeal.unresolvedItemCount).toBe(1);
    expect(result.aggregatedMeal.totals).toEqual({
      caloriesKcal: 0,
      proteinG: 0,
      fiberG: 0,
      carbsG: 0,
      fatG: 0,
    });
  });
});
