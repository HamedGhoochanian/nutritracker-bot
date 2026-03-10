import type { PersistedMealRecord, SaveMealRecordInput } from "./types";

export interface BotRepositoryPort {
  saveMeal(record: SaveMealRecordInput): Promise<PersistedMealRecord>;
}
