import { JSONFilePreset } from "lowdb/node";
import type { BotRepositoryPort } from "./ports";
import type { BotRepositoryDbSchema, PersistedMealRecord, SaveMealRecordInput } from "./types";

export class BotRepository implements BotRepositoryPort {
  private constructor(
    private readonly db: Awaited<ReturnType<typeof JSONFilePreset<BotRepositoryDbSchema>>>,
  ) {}

  static async create(dbPath = "db.json"): Promise<BotRepository> {
    const db = await JSONFilePreset<BotRepositoryDbSchema>(dbPath, {
      messages: [],
      products: [],
      submittedItems: [],
      meals: [],
    });
    const repo = new BotRepository(db);
    return repo;
  }

  async saveMeal(record: SaveMealRecordInput): Promise<PersistedMealRecord> {
    const mealRecord: PersistedMealRecord = {
      ...record,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };

    this.db.data.meals ??= [];
    this.db.data.meals.push(mealRecord);
    await this.db.write();
    return mealRecord;
  }
}
