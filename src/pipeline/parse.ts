import { logger } from "../logger";
import type { GeminiClientPort } from "../gemini/client";
import { ParsedMealSchema } from "./types";
import type { ParsedMeal } from "./types";

const PARSE_MEAL_PROMPT = [
  "Extract food items from the meal text and return JSON only.",
  "Return this exact schema:",
  '{"items":[{"food_name":"string","quantity":1,"unit":"string","preparation":null,"brand":null,"is_branded_guess":false,"confidence":0.9}]}',
  "Rules:",
  "- quantity must be numeric and > 0",
  "- confidence must be in range 0..1",
  "- if preparation/brand is unknown use null",
  "- do not include markdown or code fences",
].join("\n");

export const parseMealText = async (
  mealText: string,
  geminiClient: GeminiClientPort,
): Promise<ParsedMeal> => {
  const input = mealText.trim();

  logger.debug({ event: "pipeline.parse.request", mealText: input });
  const payload = await geminiClient.generateJson(`${PARSE_MEAL_PROMPT}\nMeal text: ${input}`);
  const parsed = ParsedMealSchema.parse(payload);
  logger.debug({ event: "pipeline.parse.response", itemCount: parsed.items.length });
  return parsed;
};
