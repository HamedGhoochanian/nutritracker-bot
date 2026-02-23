import type {
  LoggedMessage,
  SavedProduct,
  SubmittedItem,
} from "../../lib/repositories/botRepository";

export type BotRepositoryLike = {
  logMessage(entry: LoggedMessage): Promise<void>;
  saveProduct(entry: SavedProduct): Promise<void>;
  saveSubmittedItem(entry: SubmittedItem): Promise<void>;
  listSubmittedItems(): Promise<SubmittedItem[]>;
  deleteSubmittedItemByAliasOrBarcode(query: string): Promise<SubmittedItem | null>;
  findSubmittedItemByAlias(alias: string): Promise<{ item: SubmittedItem; index: number } | null>;
  updateSubmittedItemAtIndex(index: number, entry: SubmittedItem): Promise<void>;
};

export type OpenFoodFactsClientLike = {
  getProductNameById(productId: string): Promise<string | null>;
  getProduct(
    productId: string,
    fields?: readonly string[],
  ): Promise<Record<string, unknown> | null>;
};

export type BarcodeReaderLike = {
  readFromImage(imageBytes: ArrayBuffer): Promise<string | null>;
};
