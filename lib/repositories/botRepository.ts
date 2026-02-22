import { JSONFilePreset } from "lowdb/node";

export type LoggedMessage = {
  id: number;
  chatId: number;
  userId?: number;
  username?: string;
  firstName?: string;
  text?: string;
  caption?: string;
  date: string;
};

export type SavedProduct = {
  productId: string;
  productName: string;
  chatId: number;
  userId?: number;
  username?: string;
  date: string;
};

type DbSchema = {
  messages: LoggedMessage[];
  products: SavedProduct[];
};

export class BotRepository {
  private constructor(private readonly db: Awaited<ReturnType<typeof JSONFilePreset<DbSchema>>>) {}

  static async create(dbPath = "db.json"): Promise<BotRepository> {
    const db = await JSONFilePreset<DbSchema>(dbPath, { messages: [], products: [] });
    const repo = new BotRepository(db);
    await repo.ensureSchema();
    return repo;
  }

  async logMessage(entry: LoggedMessage): Promise<void> {
    this.db.data.messages.push(entry);
    await this.db.write();
  }

  async saveProduct(entry: SavedProduct): Promise<void> {
    this.db.data.products.push(entry);
    await this.db.write();
  }

  private async ensureSchema(): Promise<void> {
    let changed = false;

    if (!this.db.data.messages) {
      this.db.data.messages = [];
      changed = true;
    }

    if (!this.db.data.products) {
      this.db.data.products = [];
      changed = true;
    }

    if (changed) {
      await this.db.write();
    }
  }
}
