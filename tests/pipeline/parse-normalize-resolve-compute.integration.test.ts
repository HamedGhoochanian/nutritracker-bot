import { describe, expect, it } from "@jest/globals";
import { computeMealNutrients } from "../../src/pipeline/compute";
import { normalizeParsedMeal } from "../../src/pipeline/normalize";
import { parseMealText } from "../../src/pipeline/parse";
import { resolveNormalizedMeal } from "../../src/pipeline/resolve";

describe("pipeline parse -> normalize -> resolve -> compute integration", () => {
  it("computes nutrients from resolved items", async () => {
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
                confidence: 0.95,
              },
              {
                food_name: "banana",
                quantity: 1,
                unit: "piece",
                preparation: null,
                brand: null,
                is_branded_guess: false,
                confidence: 0.95,
              },
            ],
          };
        }

        return { selected_candidate_id: "usda:banana", confidence: 0.9 };
      },
    };

    const usdaClient = {
      searchFoods: async ({ query }: { query: string }) => {
        if (query === "whole milk") {
          return {
            foods: [
              {
                fdcId: 1,
                description: "Whole Milk",
                foodNutrients: [
                  { nutrientNumber: "208", value: 62 },
                  { nutrientNumber: "203", value: 3.3 },
                  { nutrientNumber: "291", value: 0 },
                ],
              },
            ],
          };
        }

        return {
          foods: [
            {
              fdcId: 2,
              description: "Banana, raw",
              foodNutrients: [
                { nutrientNumber: "208", value: 89 },
                { nutrientNumber: "203", value: 1.1 },
                { nutrientNumber: "291", value: 2.6 },
              ],
            },
          ],
        };
      },
    };

    const offClient = {
      searchProducts: async () => ({ products: [] }),
    };

    const parsed = await parseMealText("400ml of whole milk with a banana", geminiClient);
    const normalized = normalizeParsedMeal(parsed);
    const resolved = await resolveNormalizedMeal(
      normalized,
      usdaClient as never,
      offClient as never,
      geminiClient,
    );
    const computed = computeMealNutrients(resolved);

    expect(computed.items).toHaveLength(2);
    expect(computed.items[0]?.nutrients_total?.calories).toBeCloseTo(248);
    expect(computed.items[0]?.nutrients_total?.protein_g).toBeCloseTo(13.2);
    expect(computed.items[1]?.nutrients_total?.calories).toBeCloseTo(89);
    expect(computed.items[1]?.nutrients_total?.fiber_g).toBeCloseTo(2.6);
  });
});
