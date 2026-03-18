import { logger } from "../logger";
import type { LlmClientPort } from "../llm";
import { ParsedMealSchema } from "./types";
import type { ParsedMeal } from "./types";

const PARSE_MEAL_PROMPT = [
  "Extract food items from the meal text and return JSON only.",
  "Return this exact schema:",
  '{"items":[{"food_name":"string","quantity":1,"unit":"string","normalized_quantity":100,"normalized_unit":"g","preparation":null,"brand":null,"is_branded_guess":false,"confidence":0.9}]}',
  "Rules:",
  "- quantity must be numeric and > 0",
  "- normalized_quantity must be numeric and > 0",
  "- normalized_unit must be one of: g, ml, piece",
  "- normalized values must be food-aware (e.g. a teaspoon of peanut butter differs from a teaspoon of milk)",
  "- confidence must be in range 0..1",
  "- if preparation/brand is unknown use null",
  "- do not include markdown or code fences",
].join("\n");

export const parseMealText = async (
  mealText: string,
  llmClient: LlmClientPort,
): Promise<ParsedMeal> => {
  const input = mealText.trim();

  logger.debug({ event: "pipeline.parse.request", mealText: input });
  const payload = await llmClient.generateJson(`${PARSE_MEAL_PROMPT}\nMeal text: ${input}`);
  const parsed = ParsedMealSchema.parse(payload);
  logger.debug({ event: "pipeline.parse.response", itemCount: parsed.items.length });
  return parsed;
};
