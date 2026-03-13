import { describe, expect, it } from "@jest/globals";
import { normalizeParsedMeal } from "../../src/pipeline/normalize";
import { parseMealText } from "../../src/pipeline/parse";
import { resolveNormalizedMeal } from "../../src/pipeline/resolve";

describe("pipeline parse -> normalize -> resolve integration", () => {
  it("resolves normalized meal items against combined candidates", async () => {
    const geminiClient = {
      generateJson: async (prompt: string) => {
        if (prompt.includes("Meal text:")) {
          return {
            items: [
              {
                food_name: "whole milk",
                quantity: 400,
                unit: "ml",
                preparation: null,
                brand: null,
                is_branded_guess: false,
                confidence: 0.94,
              },
              {
                food_name: "banana",
                quantity: 1,
                unit: "piece",
                preparation: null,
                brand: null,
                is_branded_guess: false,
                confidence: 0.99,
              },
              {
                food_name: "peanut butter",
                quantity: 1,
                unit: "tbsp",
                preparation: null,
                brand: null,
                is_branded_guess: false,
                confidence: 0.96,
              },
            ],
          };
        }

        return { selected_candidate_id: "off:pb1", confidence: 0.87 };
      },
    };

    const usdaClient = {
      searchFoods: async ({ query }: { query: string }) => {
        if (query === "whole milk") {
          return { foods: [{ fdcId: 10, description: "Milk, whole" }] };
        }
        if (query === "banana") {
          return { foods: [{ fdcId: 20, description: "Bananas, raw" }] };
        }
        return {
          foods: [
            { fdcId: 30, description: "Peanut butter, smooth" },
            { fdcId: 31, description: "Peanut spread" },
          ],
        };
      },
    };

    const offClient = {
      searchProducts: async ({ search_terms }: { search_terms: string }) => {
        if (search_terms === "whole milk") {
          return { products: [{ code: "milk1", product_name: "Whole Milk", brands: "Farm A" }] };
        }
        if (search_terms === "banana") {
          return { products: [{ code: "ban1", product_name: "Banana", brands: "Fruit Co" }] };
        }
        return {
          products: [
            { code: "pb1", product_name: "Pure Peanut Butter", brands: "Nut Co" },
            { code: "pb2", product_name: "Peanut Butter Crunchy", brands: "Brand X" },
          ],
        };
      },
    };

    const parsed = await parseMealText(
      "400ml of whole milk with a banana and one tablespoon of pure peanutbutter",
      geminiClient,
    );
    const normalized = normalizeParsedMeal(parsed);
    const resolved = await resolveNormalizedMeal(
      normalized,
      usdaClient as never,
      offClient as never,
      geminiClient,
    );

    expect(resolved.items).toHaveLength(3);
    expect(resolved.items[0]?.selected_candidate?.id).toBe("usda:10");
    expect(resolved.items[1]?.selected_candidate?.id).toBe("usda:20");
    expect(resolved.items[2]?.selected_candidate?.id).toBe("usda:30");
  });
});
