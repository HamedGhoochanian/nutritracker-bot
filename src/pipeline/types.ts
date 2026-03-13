import { z } from "zod";

export const ParsedMealItemSchema = z.object({
  food_name: z.string().min(1),
  quantity: z.number().positive(),
  unit: z.string().min(1),
  preparation: z.string().nullable(),
  brand: z.string().nullable(),
  is_branded_guess: z.boolean(),
  confidence: z.number().min(0).max(1),
});

export const ParsedMealSchema = z.object({
  items: z.array(ParsedMealItemSchema).min(1),
});

export type ParsedMealItem = z.infer<typeof ParsedMealItemSchema>;
export type ParsedMeal = z.infer<typeof ParsedMealSchema>;
