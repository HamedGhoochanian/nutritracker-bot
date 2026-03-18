import { logger } from "../logger";
import { NormalizedMealSchema } from "./types";
import type { NormalizedMeal, NormalizedMealItem, ParsedMeal } from "./types";

const normalizeItem = (item: ParsedMeal["items"][number]): NormalizedMealItem => {
  const normalized: NormalizedMealItem = {
    food_name: item.food_name,
    quantity: item.normalized_quantity,
    unit: item.normalized_unit,
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
    normalizedQuantity: item.normalized_quantity,
    normalizedUnit: item.normalized_unit,
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
