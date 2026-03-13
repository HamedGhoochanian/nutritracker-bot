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

export const NormalizedUnitSchema = z.enum(["g", "ml", "piece"]);

export const NormalizedMealItemSchema = z.object({
  food_name: z.string().min(1),
  quantity: z.number().positive(),
  unit: NormalizedUnitSchema,
  original_quantity: z.number().positive(),
  original_unit: z.string().min(1),
  preparation: z.string().nullable(),
  brand: z.string().nullable(),
  is_branded_guess: z.boolean(),
  confidence: z.number().min(0).max(1),
});

export const NormalizedMealSchema = z.object({
  items: z.array(NormalizedMealItemSchema).min(1),
});

export const CandidateSourceSchema = z.enum(["usda", "off"]);

export const ResolvedCandidateSchema = z.object({
  id: z.string().min(1),
  source: CandidateSourceSchema,
  name: z.string().min(1),
  brand: z.string().nullable(),
  score: z.number().min(0).max(1),
  raw: z.record(z.string(), z.unknown()),
});

export const ResolutionDecisionSourceSchema = z.enum(["rule", "llm", "none"]);

export const ResolvedMealItemSchema = z.object({
  food_name: z.string().min(1),
  quantity: z.number().positive(),
  unit: NormalizedUnitSchema,
  original_quantity: z.number().positive(),
  original_unit: z.string().min(1),
  preparation: z.string().nullable(),
  brand: z.string().nullable(),
  is_branded_guess: z.boolean(),
  confidence: z.number().min(0).max(1),
  top_candidates: z.array(ResolvedCandidateSchema).max(5),
  selected_candidate: ResolvedCandidateSchema.nullable(),
  decision_source: ResolutionDecisionSourceSchema,
  disambiguation_confidence: z.number().min(0).max(1).nullable(),
});

export const ResolvedMealSchema = z.object({
  items: z.array(ResolvedMealItemSchema).min(1),
});

export const NutrientsSchema = z.object({
  calories: z.number().nonnegative().nullable(),
  protein_g: z.number().nonnegative().nullable(),
  fiber_g: z.number().nonnegative().nullable(),
});

export const ComputedMealItemSchema = ResolvedMealItemSchema.extend({
  nutrients_per_100: NutrientsSchema.nullable(),
  nutrients_total: NutrientsSchema.nullable(),
  scale_factor: z.number().positive().nullable(),
});

export const ComputedMealSchema = z.object({
  items: z.array(ComputedMealItemSchema).min(1),
});

export type ParsedMealItem = z.infer<typeof ParsedMealItemSchema>;
export type ParsedMeal = z.infer<typeof ParsedMealSchema>;
export type NormalizedMealItem = z.infer<typeof NormalizedMealItemSchema>;
export type NormalizedMeal = z.infer<typeof NormalizedMealSchema>;
export type ResolvedCandidate = z.infer<typeof ResolvedCandidateSchema>;
export type ResolvedMealItem = z.infer<typeof ResolvedMealItemSchema>;
export type ResolvedMeal = z.infer<typeof ResolvedMealSchema>;
export type Nutrients = z.infer<typeof NutrientsSchema>;
export type ComputedMealItem = z.infer<typeof ComputedMealItemSchema>;
export type ComputedMeal = z.infer<typeof ComputedMealSchema>;
