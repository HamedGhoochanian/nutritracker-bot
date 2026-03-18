import { describe, expect, it } from "@jest/globals";
import { normalizeParsedMeal } from "../../src/pipeline/normalize";
import { parseMealText } from "../../src/pipeline/parse";

describe("pipeline parse -> normalize integration", () => {
  it("normalizes parsed meal items", async () => {
    const geminiClient = {
      generateJson: async () => ({
        items: [
          {
            food_name: "whole milk",
            quantity: 1,
            unit: "cup",
            normalized_quantity: 240,
            normalized_unit: "ml",
            preparation: null,
            brand: null,
            is_branded_guess: false,
            confidence: 0.94,
          },
          {
            food_name: "banana",
            quantity: 1,
            unit: "piece",
            normalized_quantity: 1,
            normalized_unit: "piece",
            preparation: null,
            brand: null,
            is_branded_guess: false,
            confidence: 0.99,
          },
          {
            food_name: "peanut butter",
            quantity: 1,
            unit: "tbsp",
            normalized_quantity: 16,
            normalized_unit: "g",
            preparation: null,
            brand: null,
            is_branded_guess: false,
            confidence: 0.96,
          },
        ],
      }),
    };

    const parsed = await parseMealText(
      "one cup of whole milk with a banana and one tablespoon of peanut butter",
      geminiClient,
    );
    const normalized = normalizeParsedMeal(parsed);

    expect(normalized.items).toHaveLength(3);
    expect(
      normalized.items.map((item: { food_name: string; quantity: number; unit: string }) => ({
        food_name: item.food_name,
        quantity: item.quantity,
        unit: item.unit,
      })),
    ).toEqual([
      { food_name: "whole milk", quantity: 240, unit: "ml" },
      { food_name: "banana", quantity: 1, unit: "piece" },
      { food_name: "peanut butter", quantity: 16, unit: "g" },
    ]);
  });
});
