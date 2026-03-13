import { describe, expect, it } from "@jest/globals";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MealPipeline } from "../../src/pipeline";
import { BotRepository } from "../../src/repositories";

describe("MealPipeline", () => {
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
    const pipeline = new MealPipeline({
      llmClient,
      usdaClient: usdaClient as never,
      offClient: offClient as never,
      repository,
    });

    const result = await pipeline.run("one banana");

    expect(result.meal_id).toBeTruthy();

    const meals = await repository.getMeals();
    expect(meals).toHaveLength(1);
    expect(meals[0]?.id).toBe(result.meal_id);
    expect(meals[0]?.totals.calories).toBeCloseTo(89);

    const db = JSON.parse(await readFile(dbPath, "utf8")) as {
      consumption: Array<{ meal_id: string }>;
    };
    expect(db.consumption).toHaveLength(1);
    expect(db.consumption[0]?.meal_id).toBe(result.meal_id);
  });

  it("reuses existing meal and only appends consumption", async () => {
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
    const pipeline = new MealPipeline({
      llmClient,
      usdaClient: usdaClient as never,
      offClient: offClient as never,
      repository,
    });

    const first = await pipeline.run("one banana");
    const second = await pipeline.run("one banana");

    expect(second.meal_id).toBe(first.meal_id);

    const meals = await repository.getMeals();
    expect(meals).toHaveLength(1);

    const db = JSON.parse(await readFile(dbPath, "utf8")) as {
      consumption: Array<{ meal_id: string }>;
    };
    expect(db.consumption).toHaveLength(2);
    expect(db.consumption[0]?.meal_id).toBe(first.meal_id);
    expect(db.consumption[1]?.meal_id).toBe(first.meal_id);
  });
});
