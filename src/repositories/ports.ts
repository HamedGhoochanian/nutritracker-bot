import type { SavedMeal, SubmittedItem } from "./types";

export interface ItemRepositoryPort {
  saveSubmittedItem(entry: SubmittedItem): Promise<void>;
  listSubmittedItems(): Promise<SubmittedItem[]>;
  deleteSubmittedItemByAliasOrBarcode(query: string): Promise<SubmittedItem | null>;
  findSubmittedItemByAlias(alias: string): Promise<{ item: SubmittedItem; index: number } | null>;
  updateSubmittedItemAtIndex(index: number, entry: SubmittedItem): Promise<void>;
}

export interface MealRepositoryPort {
  saveMeal(entry: SavedMeal): Promise<void>;
  findMealByName(name: string): Promise<SavedMeal | null>;
}

export interface BotRepositoryPort extends ItemRepositoryPort, MealRepositoryPort {}
