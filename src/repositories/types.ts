import { z } from "zod";
import {
  CandidateSourceSchema,
  ComputedMealSchema,
  NormalizedMealSchema,
  NutrientsSchema,
  ParsedMealSchema,
  ResolutionDecisionSourceSchema,
  ResolvedMealSchema,
} from "../pipeline/types";

export const SaveMealInputSchema = z.object({
  meal_text: z.string().min(1),
  parsed: ParsedMealSchema,
  normalized: NormalizedMealSchema,
  resolved: ResolvedMealSchema,
  computed: ComputedMealSchema,
  totals: NutrientsSchema,
});

const SavedResolvedCandidateSchema = z.object({
  id: z.string().min(1),
  source: CandidateSourceSchema,
  name: z.string().min(1),
  brand: z.string().nullable(),
  score: z.number().min(0).max(1),
});

const SavedResolvedMealItemSchema = z.object({
  food_name: z.string().min(1),
  quantity: z.number().positive(),
  unit: z.enum(["g", "ml", "piece"]),
  original_quantity: z.number().positive(),
  original_unit: z.string().min(1),
  preparation: z.string().nullable(),
  brand: z.string().nullable(),
  is_branded_guess: z.boolean(),
  confidence: z.number().min(0).max(1),
  top_candidates: z.array(SavedResolvedCandidateSchema).max(5),
  selected_candidate: SavedResolvedCandidateSchema.nullable(),
  decision_source: ResolutionDecisionSourceSchema,
  disambiguation_confidence: z.number().min(0).max(1).nullable(),
});

const SavedResolvedMealSchema = z.object({
  items: z.array(SavedResolvedMealItemSchema).min(1),
});

const SavedComputedMealItemSchema = z.object({
  food_name: z.string().min(1),
  quantity: z.number().positive(),
  unit: z.enum(["g", "ml", "piece"]),
  nutrients_per_100: NutrientsSchema.nullable(),
  nutrients_total: NutrientsSchema.nullable(),
  scale_factor: z.number().positive().nullable(),
});

const SavedComputedMealSchema = z.object({
  items: z.array(SavedComputedMealItemSchema).min(1),
});

export const SavedMealSchema = z.object({
  meal_text: z.string().min(1),
  parsed: ParsedMealSchema,
  normalized: NormalizedMealSchema,
  resolved: SavedResolvedMealSchema,
  computed: SavedComputedMealSchema,
  totals: NutrientsSchema,
  id: z.string().min(1),
  created_at: z.string().min(1),
});

export const RepositoryDbSchema = z.object({
  meals: z.array(SavedMealSchema),
});

export type SaveMealInput = z.infer<typeof SaveMealInputSchema>;
export type SavedMeal = z.infer<typeof SavedMealSchema>;
export type RepositoryDb = z.infer<typeof RepositoryDbSchema>;
