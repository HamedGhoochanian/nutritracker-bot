import { JSONFilePreset } from "lowdb/node";
import { logger } from "../logger";
import type { BotRepositoryPort } from "./ports";
import { RepositoryDbSchema, SaveMealInputSchema } from "./types";
import type { RepositoryDb, SaveMealInput, SavedMeal } from "./types";

type StoredCandidate = {
  id: string;
  source: "usda" | "off";
  name: string;
  brand: string | null;
  score: number;
};

type StoredResolvedItem = {
  food_name: string;
  quantity: number;
  unit: "g" | "ml" | "piece";
  original_quantity: number;
  original_unit: string;
  preparation: string | null;
  brand: string | null;
  is_branded_guess: boolean;
  confidence: number;
  top_candidates: StoredCandidate[];
  selected_candidate: StoredCandidate | null;
  decision_source: "rule" | "llm" | "none";
  disambiguation_confidence: number | null;
};

type StoredComputedItem = {
  food_name: string;
  quantity: number;
  unit: "g" | "ml" | "piece";
  nutrients_per_100: {
    calories: number | null;
    protein_g: number | null;
    fiber_g: number | null;
  } | null;
  nutrients_total: {
    calories: number | null;
    protein_g: number | null;
    fiber_g: number | null;
  } | null;
  scale_factor: number | null;
};

type DbSchema = RepositoryDb;

export class BotRepository implements BotRepositoryPort {
  private constructor(private readonly db: Awaited<ReturnType<typeof JSONFilePreset<DbSchema>>>) {}

  static async create(dbPath = "db.json"): Promise<BotRepository> {
    const db = await JSONFilePreset<DbSchema>(dbPath, { meals: [] });
    const dataWithMeals = db.data as { meals?: unknown };
    if (dataWithMeals.meals === undefined) {
      dataWithMeals.meals = [];
    }

    const parsed = RepositoryDbSchema.parse(dataWithMeals);
    db.data = parsed;
    const repo = new BotRepository(db);
    return repo;
  }

  async saveMeal(input: SaveMealInput): Promise<SavedMeal> {
    const payload = SaveMealInputSchema.parse(input);

    const toStoredCandidate = (candidate: {
      id: string;
      source: "usda" | "off";
      name: string;
      brand: string | null;
      score: number;
    }): StoredCandidate => {
      return {
        id: candidate.id,
        source: candidate.source,
        name: candidate.name,
        brand: candidate.brand,
        score: candidate.score,
      };
    };

    const resolved = {
      items: payload.resolved.items.map((item): StoredResolvedItem => {
        let selectedCandidate: StoredCandidate | null = null;
        if (item.selected_candidate !== null) {
          selectedCandidate = toStoredCandidate(item.selected_candidate);
        }

        return {
          food_name: item.food_name,
          quantity: item.quantity,
          unit: item.unit,
          original_quantity: item.original_quantity,
          original_unit: item.original_unit,
          preparation: item.preparation,
          brand: item.brand,
          is_branded_guess: item.is_branded_guess,
          confidence: item.confidence,
          top_candidates: item.top_candidates.map((candidate) => toStoredCandidate(candidate)),
          selected_candidate: selectedCandidate,
          decision_source: item.decision_source,
          disambiguation_confidence: item.disambiguation_confidence,
        };
      }),
    };

    const computed = {
      items: payload.computed.items.map((item): StoredComputedItem => {
        return {
          food_name: item.food_name,
          quantity: item.quantity,
          unit: item.unit,
          nutrients_per_100: item.nutrients_per_100,
          nutrients_total: item.nutrients_total,
          scale_factor: item.scale_factor,
        };
      }),
    };

    const meal = {
      meal_text: payload.meal_text,
      parsed: payload.parsed,
      normalized: payload.normalized,
      resolved,
      computed,
      totals: payload.totals,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    };

    this.db.data.meals.push(meal);
    await this.db.write();
    logger.debug({
      event: "repository.meal.saved",
      mealId: meal.id,
      itemCount: meal.computed.items.length,
    });
    return meal;
  }

  async getMeals(): Promise<SavedMeal[]> {
    return this.db.data.meals;
  }
}
