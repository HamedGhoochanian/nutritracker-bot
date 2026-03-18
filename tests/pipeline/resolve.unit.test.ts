import { describe, expect, it } from "@jest/globals";
import { resolveNormalizedMeal } from "../../src/pipeline/resolve";

describe("resolveNormalizedMeal", () => {
  it("builds one llm nutrient candidate per item", async () => {
    const usdaClient = {
      searchFoods: async () => ({ foods: [] }),
    };
    const offClient = {
      searchProducts: async () => ({ products: [] }),
    };
    const llmClient = {
      generateJson: async () => ({
        calories_per_100: 89,
        protein_g_per_100: 1.1,
        fiber_g_per_100: 2.6,
        confidence: 0.92,
      }),
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
      llmClient,
    );

    expect(resolved.items[0]?.decision_source).toBe("llm");
    expect(resolved.items[0]?.selected_candidate?.source).toBe("llm");
    expect(resolved.items[0]?.selected_candidate?.raw.nutriments).toEqual({
      "energy-kcal_100g": 89,
      proteins_100g: 1.1,
      fiber_100g: 2.6,
    });
    expect(resolved.items[0]?.top_candidates).toHaveLength(1);
  });

  it("returns none when llm nutrient response is invalid", async () => {
    const usdaClient = {
      searchFoods: async () => ({ foods: [] }),
    };
    const offClient = {
      searchProducts: async () => ({ products: [] }),
    };
    const llmClient = {
      generateJson: async () => ({
        calories_per_100: -1,
        protein_g_per_100: 1,
        fiber_g_per_100: 1,
        confidence: 0.5,
      }),
    };

    const resolved = await resolveNormalizedMeal(
      {
        items: [
          {
            food_name: "apple",
            quantity: 1,
            unit: "piece",
            original_quantity: 1,
            original_unit: "piece",
            preparation: null,
            brand: null,
            is_branded_guess: false,
            confidence: 0.95,
          },
        ],
      },
      usdaClient as never,
      offClient as never,
      llmClient,
    );

    expect(resolved.items[0]?.decision_source).toBe("none");
    expect(resolved.items[0]?.selected_candidate).toBe(null);
    expect(resolved.items[0]?.top_candidates).toHaveLength(0);
  });
});
