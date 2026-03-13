import { logger } from "../logger";
import { NormalizedMealSchema } from "./types";
import type { NormalizedMeal, NormalizedMealItem, ParsedMeal } from "./types";

const UNIT_ALIASES: Record<string, "g" | "ml" | "piece"> = {
  g: "g",
  gram: "g",
  grams: "g",
  kg: "g",
  ml: "ml",
  milliliter: "ml",
  milliliters: "ml",
  millilitre: "ml",
  millilitres: "ml",
  l: "ml",
  liter: "ml",
  liters: "ml",
  litre: "ml",
  litres: "ml",
  cup: "ml",
  cups: "ml",
  tbsp: "ml",
  tablespoon: "ml",
  tablespoons: "ml",
  tsp: "ml",
  teaspoon: "ml",
  teaspoons: "ml",
  piece: "piece",
  pieces: "piece",
  banana: "piece",
  bananas: "piece",
  whole: "piece",
};

const UNIT_MULTIPLIERS: Record<string, number> = {
  g: 1,
  gram: 1,
  grams: 1,
  kg: 1000,
  ml: 1,
  milliliter: 1,
  milliliters: 1,
  millilitre: 1,
  millilitres: 1,
  l: 1000,
  liter: 1000,
  liters: 1000,
  litre: 1000,
  litres: 1000,
  cup: 240,
  cups: 240,
  tbsp: 15,
  tablespoon: 15,
  tablespoons: 15,
  tsp: 5,
  teaspoon: 5,
  teaspoons: 5,
  piece: 1,
  pieces: 1,
  banana: 1,
  bananas: 1,
  whole: 1,
};

const normalizeUnit = (unit: string): "g" | "ml" | "piece" => {
  const cleaned = unit.trim().toLowerCase();
  const normalized = UNIT_ALIASES[cleaned];
  if (normalized !== undefined) {
    return normalized;
  }

  return "piece";
};

const convertQuantity = (quantity: number, unit: string): number => {
  const cleaned = unit.trim().toLowerCase();
  const multiplier = UNIT_MULTIPLIERS[cleaned];
  if (multiplier !== undefined) {
    return quantity * multiplier;
  }

  return quantity;
};

const normalizeItem = (item: ParsedMeal["items"][number]): NormalizedMealItem => {
  const normalizedUnit = normalizeUnit(item.unit);
  const normalizedQuantity = convertQuantity(item.quantity, item.unit);

  const normalized: NormalizedMealItem = {
    food_name: item.food_name,
    quantity: normalizedQuantity,
    unit: normalizedUnit,
    original_quantity: item.quantity,
    original_unit: item.unit,
    preparation: item.preparation,
    brand: item.brand,
    is_branded_guess: item.is_branded_guess,
    confidence: item.confidence,
  };

  logger.debug({
    event: "pipeline.normalize.item",
    foodName: item.food_name,
    originalQuantity: item.quantity,
    originalUnit: item.unit,
    normalizedQuantity,
    normalizedUnit,
  });

  return normalized;
};

export const normalizeParsedMeal = (parsedMeal: ParsedMeal): NormalizedMeal => {
  logger.debug({ event: "pipeline.normalize.request", itemCount: parsedMeal.items.length });
  const payload = {
    items: parsedMeal.items.map((item) => normalizeItem(item)),
  };
  const normalized = NormalizedMealSchema.parse(payload);
  logger.debug({ event: "pipeline.normalize.response", itemCount: normalized.items.length });
  return normalized;
};
