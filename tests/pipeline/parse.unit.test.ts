import { describe, expect, it } from "@jest/globals";
import { parseMealText } from "../../src/pipeline/parse";

describe("parseMealText", () => {
  it("parses valid gemini payload", async () => {
    const geminiClient = {
      generateJson: async () => ({
        items: [
          {
            food_name: "milk",
            quantity: 400,
            unit: "ml",
            normalized_quantity: 400,
            normalized_unit: "ml",
            preparation: null,
            brand: null,
            is_branded_guess: false,
            confidence: 0.93,
          },
        ],
      }),
    };

    const parsed = await parseMealText("400ml milk", geminiClient);
    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0]?.food_name).toBe("milk");
  });

  it("throws when payload is invalid", async () => {
    const geminiClient = {
      generateJson: async () => ({
        items: [
          {
            food_name: "banana",
            quantity: 1,
            unit: "piece",
            normalized_quantity: 1,
            normalized_unit: "piece",
            preparation: null,
            brand: null,
            is_branded_guess: false,
            confidence: 1.2,
          },
        ],
      }),
    };

    await expect(parseMealText("one banana", geminiClient)).rejects.toThrow();
  });
});
