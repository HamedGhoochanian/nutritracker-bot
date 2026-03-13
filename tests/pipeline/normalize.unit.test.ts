import { describe, expect, it } from "@jest/globals";
import { normalizeParsedMeal } from "../../src/pipeline/normalize";

describe("normalizeParsedMeal", () => {
  it("converts tablespoon to ml", () => {
    const normalized = normalizeParsedMeal({
      items: [
        {
          food_name: "peanut butter",
          quantity: 1,
          unit: "tbsp",
          preparation: null,
          brand: null,
          is_branded_guess: false,
          confidence: 0.95,
        },
      ],
    });

    expect(normalized.items[0]?.quantity).toBe(15);
    expect(normalized.items[0]?.unit).toBe("ml");
    expect(normalized.items[0]?.original_unit).toBe("tbsp");
  });

  it("converts cup to ml", () => {
    const normalized = normalizeParsedMeal({
      items: [
        {
          food_name: "milk",
          quantity: 1,
          unit: "cup",
          preparation: null,
          brand: null,
          is_branded_guess: false,
          confidence: 0.9,
        },
      ],
    });

    expect(normalized.items[0]?.quantity).toBe(240);
    expect(normalized.items[0]?.unit).toBe("ml");
  });

  it("keeps piece units", () => {
    const normalized = normalizeParsedMeal({
      items: [
        {
          food_name: "banana",
          quantity: 1,
          unit: "piece",
          preparation: null,
          brand: null,
          is_branded_guess: false,
          confidence: 0.99,
        },
      ],
    });

    expect(normalized.items[0]?.quantity).toBe(1);
    expect(normalized.items[0]?.unit).toBe("piece");
  });
});
