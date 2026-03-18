import { describe, expect, it } from "@jest/globals";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { BotRepository } from "../../src/repositories";

describe("BotRepository", () => {
  it("saves meal to db file", async () => {
    const dir = await mkdtemp(join(tmpdir(), "nutritracker-repo-"));
    const dbPath = join(dir, "db.sqlite");
    const repository = await BotRepository.create(dbPath);

    const saved = await repository.saveMeal({
      meal_text: "one banana",
      parsed: {
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
            confidence: 0.95,
          },
        ],
      },
      normalized: {
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
            confidence: 0.95,
          },
        ],
      },
      resolved: {
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
            confidence: 0.95,
            top_candidates: [],
            selected_candidate: null,
            decision_source: "none",
            disambiguation_confidence: null,
          },
        ],
      },
      computed: {
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
            confidence: 0.95,
            top_candidates: [],
            selected_candidate: null,
            decision_source: "none",
            disambiguation_confidence: null,
            nutrients_per_100: null,
            nutrients_total: null,
            scale_factor: null,
          },
        ],
      },
      totals: {
        calories: null,
        protein_g: null,
        fiber_g: null,
      },
    });

    expect(saved.id).toBeTruthy();
    expect(saved.created_at).toBeTruthy();

    const meals = await repository.getMeals();
    expect(meals).toHaveLength(1);
    expect(meals[0]?.id).toBe(saved.id);
    expect(meals[0]?.meal_text).toBe("one banana");

    const found = await repository.findMealByText("one banana");
    expect(found?.id).toBe(saved.id);

    const consumption = await repository.saveConsumption(saved.id);
    expect(consumption.id).toBeTruthy();
    expect(consumption.meal_id).toBe(saved.id);
    expect(consumption.consumed_at).toBeTruthy();

    const entries = await repository.getConsumption();
    expect(entries).toHaveLength(1);
    expect(entries[0]?.id).toBe(consumption.id);
  });
});
