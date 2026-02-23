import type { LoggedMessage, SavedProduct } from "../../lib/repositories/botRepository";

export type BotRepositoryLike = {
  logMessage(entry: LoggedMessage): Promise<void>;
  saveProduct(entry: SavedProduct): Promise<void>;
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
