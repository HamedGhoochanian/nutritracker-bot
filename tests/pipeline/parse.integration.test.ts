import { describe, expect, it } from "@jest/globals";
import { parseMealText } from "../../src/pipeline/parse";

describe("pipeline parse integration", () => {
  it("parses meal text into first-stage output", async () => {
    const geminiClient = {
      generateJson: async () => ({
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
      }),
    };

    const parsed = await parseMealText(
      "400ml of whole milk with a banana and one tablespoon of pure peanutbutter",
      geminiClient,
    );

    expect(parsed.items).toHaveLength(3);
    expect(parsed.items.map((item: { food_name: string }) => item.food_name)).toEqual([
      "whole milk",
      "banana",
      "peanut butter",
    ]);
  });
});
