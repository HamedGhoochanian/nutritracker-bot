import type { SaveMealInput, SavedConsumption, SavedMeal } from "./types";

export interface BotRepositoryPort {
  saveMeal(input: SaveMealInput): Promise<SavedMeal>;
  getMeals(): Promise<SavedMeal[]>;
  findMealByText(mealText: string): Promise<SavedMeal | null>;
  saveConsumption(mealId: string): Promise<SavedConsumption>;
  getConsumption(): Promise<SavedConsumption[]>;
}
