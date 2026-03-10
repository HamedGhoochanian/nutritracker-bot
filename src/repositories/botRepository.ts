import { JSONFilePreset } from "lowdb/node";
import type { BotRepositoryPort } from "./ports";
import type {} from "./types";

// eslint-disable-next-line
type DbSchema = {};

export class BotRepository implements BotRepositoryPort {
  private constructor(private readonly db: Awaited<ReturnType<typeof JSONFilePreset<DbSchema>>>) {}

  static async create(dbPath = "db.json"): Promise<BotRepository> {
    const db = await JSONFilePreset<DbSchema>(dbPath, {});
    const repo = new BotRepository(db);
    return repo;
  }
}
