import { describe, expect, it } from "@jest/globals";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runMealPipeline } from "../../src/pipeline";
import { BotRepository } from "../../src/repositories";

describe("runMealPipeline", () => {
  it("runs all stages and saves meal", async () => {
    const llmClient = {
      generateJson: async (prompt: string) => {
        if (prompt.includes("Meal text:")) {
          return {
            items: [
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

        return { selected_candidate_id: "usda:2", confidence: 0.9 };
      },
    };

    const usdaClient = {
      searchFoods: async () => ({
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
      }),
    };

    const offClient = {
      searchProducts: async () => ({ products: [] }),
    };

    const dir = await mkdtemp(join(tmpdir(), "nutritracker-run-"));
    const dbPath = join(dir, "db.json");
    const repository = await BotRepository.create(dbPath);

    const result = await runMealPipeline("one banana", {
      llmClient,
      usdaClient: usdaClient as never,
      offClient: offClient as never,
      repository,
    });

    expect(result.meal_id).toBeTruthy();

    const meals = await repository.getMeals();
    expect(meals).toHaveLength(1);
    expect(meals[0]?.id).toBe(result.meal_id);
    expect(meals[0]?.totals.calories).toBeCloseTo(89);
  });
});
