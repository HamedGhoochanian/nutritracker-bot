import { describe, expect, it } from "@jest/globals";
import { resolveNormalizedMeal } from "../../src/pipeline/resolve";

describe("resolveNormalizedMeal", () => {
  it("uses rule selection when top candidate is clear", async () => {
    const usdaClient = {
      searchFoods: async () => ({
        foods: [
          { fdcId: 1, description: "Banana, raw" },
          { fdcId: 2, description: "Apple, raw" },
        ],
      }),
    };
    const offClient = {
      searchProducts: async () => ({
        products: [{ code: "111", product_name: "Banana chips", brands: "SnackCo" }],
      }),
    };
    const geminiClient = {
      generateJson: async () => ({ selected_candidate_id: "off:111", confidence: 0.7 }),
    };

    const resolved = await resolveNormalizedMeal(
      {
        items: [
          {
            food_name: "banana",
            quantity: 1,
            unit: "piece",
            original_quantity: 1,
            original_unit: "piece",
            preparation: null,
            brand: null,
            is_branded_guess: false,
            confidence: 0.99,
          },
        ],
      },
      usdaClient as never,
      offClient as never,
      geminiClient,
    );

    expect(resolved.items[0]?.decision_source).toBe("rule");
    expect(resolved.items[0]?.selected_candidate?.id).toBe("usda:1");
    expect(resolved.items[0]?.top_candidates[0]?.source).toBe("usda");
  });

  it("uses llm selection when ambiguous", async () => {
    const usdaClient = {
      searchFoods: async () => ({ foods: [{ fdcId: 1, description: "Yogurt, plain" }] }),
    };
    const offClient = {
      searchProducts: async () => ({
        products: [
          { code: "111", product_name: "Greek Yogurt", brands: "BrandA" },
          { code: "222", product_name: "Yoghurt Natural", brands: "BrandB" },
        ],
      }),
    };
    const geminiClient = {
      generateJson: async () => ({ selected_candidate_id: "off:111", confidence: 0.88 }),
    };

    const resolved = await resolveNormalizedMeal(
      {
        items: [
          {
            food_name: "yogurt parfait",
            quantity: 200,
            unit: "g",
            original_quantity: 200,
            original_unit: "g",
            preparation: null,
            brand: null,
            is_branded_guess: false,
            confidence: 0.8,
          },
        ],
      },
      usdaClient as never,
      offClient as never,
      geminiClient,
    );

    expect(resolved.items[0]?.decision_source).toBe("llm");
    expect(resolved.items[0]?.selected_candidate?.id).toBe("off:111");
    expect(resolved.items[0]?.disambiguation_confidence).toBe(0.88);
  });

  it("falls back to top candidate when llm selection is invalid", async () => {
    const usdaClient = {
      searchFoods: async () => ({ foods: [{ fdcId: 1, description: "Milk, whole" }] }),
    };
    const offClient = {
      searchProducts: async () => ({
        products: [{ code: "111", product_name: "Whole Milk", brands: "BrandM" }],
      }),
    };
    const geminiClient = {
      generateJson: async () => ({ selected_candidate_id: "off:999", confidence: 0.9 }),
    };

    const resolved = await resolveNormalizedMeal(
      {
        items: [
          {
            food_name: "whole milk",
            quantity: 400,
            unit: "ml",
            original_quantity: 400,
            original_unit: "ml",
            preparation: null,
            brand: null,
            is_branded_guess: false,
            confidence: 0.9,
          },
        ],
      },
      usdaClient as never,
      offClient as never,
      geminiClient,
    );

    expect(resolved.items[0]?.decision_source).toBe("rule");
    expect(resolved.items[0]?.selected_candidate?.id).toBe("usda:1");
    expect(resolved.items[0]?.top_candidates).toHaveLength(2);
  });

  it("normalizes separators before search", async () => {
    let queryUsed = "";
    const usdaClient = {
      searchFoods: async ({ query }: { query: string }) => {
        queryUsed = query;
        return { foods: [{ fdcId: 9, description: "Peanut butter, smooth" }] };
      },
    };
    const offClient = {
      searchProducts: async () => ({ products: [] }),
    };
    const geminiClient = {
      generateJson: async () => ({ selected_candidate_id: "usda:9", confidence: 0.9 }),
    };

    const resolved = await resolveNormalizedMeal(
      {
        items: [
          {
            food_name: "pure peanut-butter",
            quantity: 15,
            unit: "ml",
            original_quantity: 1,
            original_unit: "tbsp",
            preparation: null,
            brand: null,
            is_branded_guess: false,
            confidence: 0.95,
          },
        ],
      },
      usdaClient as never,
      offClient as never,
      geminiClient,
    );

    expect(queryUsed).toBe("pure peanut butter");
    expect(resolved.items[0]?.selected_candidate?.id).toBe("usda:9");
  });
});
