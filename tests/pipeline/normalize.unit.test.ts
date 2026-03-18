import { describe, expect, it } from "@jest/globals";
import { normalizeParsedMeal } from "../../src/pipeline/normalize";

describe("normalizeParsedMeal", () => {
  it("uses llm-provided normalized values", () => {
    const normalized = normalizeParsedMeal({
      items: [
        {
          food_name: "peanut butter",
          quantity: 1,
          unit: "tbsp",
          normalized_quantity: 16,
          normalized_unit: "g",
          preparation: null,
          brand: null,
          is_branded_guess: false,
          confidence: 0.95,
        },
      ],
    });

    expect(normalized.items[0]?.quantity).toBe(16);
    expect(normalized.items[0]?.unit).toBe("g");
    expect(normalized.items[0]?.original_unit).toBe("tbsp");
  });

  it("keeps original quantity and unit for traceability", () => {
    const normalized = normalizeParsedMeal({
      items: [
        {
          food_name: "milk",
          quantity: 1,
          unit: "cup",
          normalized_quantity: 240,
          normalized_unit: "ml",
          preparation: null,
          brand: null,
          is_branded_guess: false,
          confidence: 0.9,
        },
      ],
    });

    expect(normalized.items[0]?.quantity).toBe(240);
    expect(normalized.items[0]?.unit).toBe("ml");
    expect(normalized.items[0]?.original_quantity).toBe(1);
    expect(normalized.items[0]?.original_unit).toBe("cup");
  });

  it("keeps piece units when provided", () => {
    const normalized = normalizeParsedMeal({
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
          confidence: 0.99,
        },
      ],
    });

    expect(normalized.items[0]?.quantity).toBe(1);
    expect(normalized.items[0]?.unit).toBe("piece");
  });
});
