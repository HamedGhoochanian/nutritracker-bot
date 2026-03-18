import { describe, expect, it } from "@jest/globals";
import { computeMealNutrients } from "../../src/pipeline/compute";

describe("computeMealNutrients", () => {
  it("computes nutrients from usda candidate", () => {
    const computed = computeMealNutrients({
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
          top_candidates: [],
          selected_candidate: {
            id: "usda:1",
            source: "usda",
            name: "Milk",
            brand: null,
            score: 0.9,
            raw: {
              foodNutrients: [
                { nutrientNumber: "208", value: 60 },
                { nutrientNumber: "203", value: 3.2 },
                { nutrientNumber: "291", value: 0 },
              ],
            },
          },
          decision_source: "rule",
          disambiguation_confidence: null,
        },
      ],
    });

    expect(computed.items[0]?.scale_factor).toBe(4);
    expect(computed.items[0]?.nutrients_total?.calories).toBe(240);
    expect(computed.items[0]?.nutrients_total?.protein_g).toBe(12.8);
    expect(computed.items[0]?.nutrients_total?.fiber_g).toBe(0);
  });

  it("computes nutrients from off candidate", () => {
    const computed = computeMealNutrients({
      items: [
        {
          food_name: "protein bar",
          quantity: 50,
          unit: "g",
          original_quantity: 50,
          original_unit: "g",
          preparation: null,
          brand: "brand",
          is_branded_guess: true,
          confidence: 0.9,
          top_candidates: [],
          selected_candidate: {
            id: "off:1",
            source: "off",
            name: "Protein Bar",
            brand: "Brand",
            score: 0.9,
            raw: {
              nutriments: {
                "energy-kcal_100g": 380,
                proteins_100g: 25,
                fiber_100g: 8,
              },
            },
          },
          decision_source: "rule",
          disambiguation_confidence: null,
        },
      ],
    });

    expect(computed.items[0]?.scale_factor).toBe(0.5);
    expect(computed.items[0]?.nutrients_total?.calories).toBe(190);
    expect(computed.items[0]?.nutrients_total?.protein_g).toBe(12.5);
    expect(computed.items[0]?.nutrients_total?.fiber_g).toBe(4);
  });

  it("uses piece quantity as direct scale", () => {
    const computed = computeMealNutrients({
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
          confidence: 0.9,
          top_candidates: [],
          selected_candidate: {
            id: "usda:2",
            source: "usda",
            name: "Banana",
            brand: null,
            score: 0.9,
            raw: {
              foodNutrients: [
                { nutrientNumber: "208", value: 89 },
                { nutrientNumber: "203", value: 1.1 },
                { nutrientNumber: "291", value: 2.6 },
              ],
            },
          },
          decision_source: "rule",
          disambiguation_confidence: null,
        },
      ],
    });

    expect(computed.items[0]?.scale_factor).toBe(1);
    expect(computed.items[0]?.nutrients_total?.calories).toBe(89);
  });
});
