import { Database } from "bun:sqlite";
import { logger } from "../logger";
import type { BotRepositoryPort } from "./ports";
import { SaveMealInputSchema, SavedConsumptionSchema, SavedMealSchema } from "./types";
import type { SaveMealInput, SavedConsumption, SavedMeal } from "./types";

type MealRow = {
  id: string;
  meal_text: string;
  pipeline_json: string;
  created_at: string;
};

type ConsumptionRow = {
  id: string;
  meal_id: string;
  consumed_at: string;
};

type PipelinePayload = {
  parsed: SaveMealInput["parsed"];
  normalized: SaveMealInput["normalized"];
  resolved: SaveMealInput["resolved"];
  computed: SaveMealInput["computed"];
  totals: SaveMealInput["totals"];
};

export class BotRepository implements BotRepositoryPort {
  private constructor(private readonly db: Database) {}

  static async create(dbPath = "db.sqlite"): Promise<BotRepository> {
    const db = new Database(dbPath);
    db.exec("PRAGMA foreign_keys = ON");
    db.exec("PRAGMA journal_mode = WAL");
    db.exec("PRAGMA busy_timeout = 5000");

    db.exec(`
      CREATE TABLE IF NOT EXISTS meals (
        id TEXT PRIMARY KEY,
        meal_text TEXT NOT NULL,
        pipeline_json TEXT NOT NULL CHECK (json_valid(pipeline_json)),
        created_at TEXT NOT NULL
      ) STRICT
    `);

    db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS meals_meal_text_uq
      ON meals(meal_text)
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS consumption (
        id TEXT PRIMARY KEY,
        meal_id TEXT NOT NULL,
        consumed_at TEXT NOT NULL,
        FOREIGN KEY (meal_id) REFERENCES meals(id) ON DELETE CASCADE
      ) STRICT
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS consumption_time_idx
      ON consumption(consumed_at DESC)
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS consumption_meal_time_idx
      ON consumption(meal_id, consumed_at DESC)
    `);

    const repo = new BotRepository(db);
    return repo;
  }

  private mapMealRow(row: MealRow): SavedMeal {
    const parsedPipeline = JSON.parse(row.pipeline_json) as PipelinePayload;
    const meal = SavedMealSchema.parse({
      id: row.id,
      meal_text: row.meal_text,
      parsed: parsedPipeline.parsed,
      normalized: parsedPipeline.normalized,
      resolved: parsedPipeline.resolved,
      computed: parsedPipeline.computed,
      totals: parsedPipeline.totals,
      created_at: row.created_at,
    });
    return meal;
  }

  async saveMeal(input: SaveMealInput): Promise<SavedMeal> {
    const payload = SaveMealInputSchema.parse(input);

    const meal = {
      id: crypto.randomUUID(),
      meal_text: payload.meal_text,
      pipeline_json: JSON.stringify({
        parsed: payload.parsed,
        normalized: payload.normalized,
        resolved: payload.resolved,
        computed: payload.computed,
        totals: payload.totals,
      }),
      created_at: new Date().toISOString(),
    };

    const statement = this.db.query(
      "INSERT INTO meals (id, meal_text, pipeline_json, created_at) VALUES (?, ?, ?, ?)",
    );
    statement.run(meal.id, meal.meal_text, meal.pipeline_json, meal.created_at);

    logger.debug({
      event: "repository.meal.saved",
      mealId: meal.id,
      itemCount: payload.computed.items.length,
    });

    return this.mapMealRow(meal);
  }

  async getMeals(): Promise<SavedMeal[]> {
    const rows = this.db
      .query("SELECT id, meal_text, pipeline_json, created_at FROM meals ORDER BY created_at ASC")
      .all() as MealRow[];
    return rows.map((row) => this.mapMealRow(row));
  }

  async findMealByText(mealText: string): Promise<SavedMeal | null> {
    const row = this.db
      .query(
        "SELECT id, meal_text, pipeline_json, created_at FROM meals WHERE meal_text = ? LIMIT 1",
      )
      .get(mealText) as MealRow | null;
    if (row === null) {
      return null;
    }
    return this.mapMealRow(row);
  }

  async saveConsumption(mealId: string): Promise<SavedConsumption> {
    const consumption = {
      id: crypto.randomUUID(),
      meal_id: mealId,
      consumed_at: new Date().toISOString(),
    };

    const statement = this.db.query(
      "INSERT INTO consumption (id, meal_id, consumed_at) VALUES (?, ?, ?)",
    );
    statement.run(consumption.id, consumption.meal_id, consumption.consumed_at);

    logger.debug({
      event: "repository.consumption.saved",
      consumptionId: consumption.id,
      mealId: consumption.meal_id,
    });

    const parsed = SavedConsumptionSchema.parse(consumption);
    return parsed;
  }

  async getConsumption(): Promise<SavedConsumption[]> {
    const rows = this.db
      .query("SELECT id, meal_id, consumed_at FROM consumption ORDER BY consumed_at ASC")
      .all() as ConsumptionRow[];
    return rows.map((row) => SavedConsumptionSchema.parse(row));
  }
}
