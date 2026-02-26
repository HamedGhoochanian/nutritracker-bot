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

export type SubmittedNutritionFacts = {
  energyKcal100g?: number;
  proteins100g?: number;
  carbohydrates100g?: number;
  fat100g?: number;
  sugars100g?: number;
  fiber100g?: number;
  salt100g?: number;
  sodium100g?: number;
};

export type SubmittedItem = {
  barcode: string;
  productName: string;
  nutritionFacts: SubmittedNutritionFacts;
  alias?: string;
  brand?: string;
  quantity?: string;
  chatId: number;
  userId?: number;
  username?: string;
  date: string;
};

export type SavedMealIngredient = {
  barcode: string;
  alias?: string;
  productName: string;
  quantity?: string;
  amount: number;
  proteins100g?: number;
  energyKcal100g?: number;
};

export type SavedMeal = {
  name: string;
  ingredients: SavedMealIngredient[];
  totalProtein: number;
  totalCalories: number;
  chatId: number;
  userId?: number;
  username?: string;
  date: string;
};
