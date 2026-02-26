import { JSONFilePreset } from "lowdb/node";
import type { BotRepositoryPort } from "./ports";
import type { LoggedMessage, SavedMeal, SavedProduct, SubmittedItem } from "./types";

type DbSchema = {
  messages: LoggedMessage[];
  products: SavedProduct[];
  submittedItems: SubmittedItem[];
  meals: SavedMeal[];
};

export class BotRepository implements BotRepositoryPort {
  private constructor(private readonly db: Awaited<ReturnType<typeof JSONFilePreset<DbSchema>>>) {}

  static async create(dbPath = "db.json"): Promise<BotRepository> {
    const db = await JSONFilePreset<DbSchema>(dbPath, {
      messages: [],
      products: [],
      submittedItems: [],
      meals: [],
    });
    const repo = new BotRepository(db);
    await repo.ensureSchema();
    return repo;
  }

  async saveProduct(entry: SavedProduct): Promise<void> {
    this.db.data.products.push(entry);
    await this.db.write();
  }

  async saveSubmittedItem(entry: SubmittedItem): Promise<void> {
    this.db.data.submittedItems.push(entry);
    await this.db.write();
  }

  async listSubmittedItems(): Promise<SubmittedItem[]> {
    return [...this.db.data.submittedItems];
  }

  async deleteSubmittedItemByAliasOrBarcode(query: string): Promise<SubmittedItem | null> {
    const normalized = query.trim();
    if (!normalized) {
      return null;
    }

    const byAliasIndex = this.db.data.submittedItems.findIndex(
      (item) => item.alias?.trim() === normalized,
    );

    const index =
      byAliasIndex >= 0
        ? byAliasIndex
        : this.db.data.submittedItems.findIndex((item) => item.barcode === normalized);

    if (index < 0) {
      return null;
    }

    const [deleted] = this.db.data.submittedItems.splice(index, 1);
    await this.db.write();
    return deleted ?? null;
  }

  async findSubmittedItemByAlias(
    alias: string,
  ): Promise<{ item: SubmittedItem; index: number } | null> {
    const normalized = alias.trim();
    if (!normalized) {
      return null;
    }

    const index = this.db.data.submittedItems.findIndex(
      (item) => item.alias?.trim() === normalized,
    );
    if (index < 0) {
      return null;
    }

    const item = this.db.data.submittedItems[index];
    if (!item) {
      return null;
    }

    return { item, index };
  }

  async updateSubmittedItemAtIndex(index: number, entry: SubmittedItem): Promise<void> {
    if (!Number.isInteger(index) || index < 0 || index >= this.db.data.submittedItems.length) {
      throw new Error("Invalid submitted item index");
    }

    this.db.data.submittedItems[index] = entry;
    await this.db.write();
  }

  async saveMeal(entry: SavedMeal): Promise<void> {
    this.db.data.meals.push(entry);
    await this.db.write();
  }

  async findMealByName(name: string): Promise<SavedMeal | null> {
    const normalized = name.trim().toLowerCase();
    if (!normalized) {
      return null;
    }

    return this.db.data.meals.find((meal) => meal.name.trim().toLowerCase() === normalized) ?? null;
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

    if (!this.db.data.submittedItems) {
      this.db.data.submittedItems = [];
      changed = true;
    }

    if (!this.db.data.meals) {
      this.db.data.meals = [];
      changed = true;
    }

    if (changed) {
      await this.db.write();
    }
  }
}
