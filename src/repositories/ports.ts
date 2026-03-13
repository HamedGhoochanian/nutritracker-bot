import type { SaveMealInput, SavedMeal } from "./types";

export interface BotRepositoryPort {
  saveMeal(input: SaveMealInput): Promise<SavedMeal>;
  getMeals(): Promise<SavedMeal[]>;
}
