import { describe, expect, it } from "@jest/globals";
import { aggregateMealNutrients } from "../../src/pipeline/aggregate";

describe("aggregateMealNutrients", () => {
  it("sums computed nutrients", () => {
    const totals = aggregateMealNutrients({
      items: [
        {
          food_name: "milk",
          quantity: 400,
          unit: "ml",
          original_quantity: 400,
          original_unit: "ml",
          preparation: null,
          brand: null,
          is_branded_guess: false,
          confidence: 0.9,
          top_candidates: [],
          selected_candidate: null,
          decision_source: "none",
          disambiguation_confidence: null,
          nutrients_per_100: null,
          nutrients_total: { calories: 240, protein_g: 12.8, fiber_g: 0 },
          scale_factor: 4,
        },
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
          selected_candidate: null,
          decision_source: "none",
          disambiguation_confidence: null,
          nutrients_per_100: null,
          nutrients_total: { calories: 89, protein_g: 1.1, fiber_g: 2.6 },
          scale_factor: 1,
        },
      ],
    });

    expect(totals.calories).toBe(329);
    expect(totals.protein_g).toBeCloseTo(13.9);
    expect(totals.fiber_g).toBeCloseTo(2.6);
  });
});
