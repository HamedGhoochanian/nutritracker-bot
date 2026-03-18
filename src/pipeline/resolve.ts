import { z } from "zod";
import { logger } from "../logger";
import type { LlmClientPort } from "../llm";
import type { OpenFoodFactsClient } from "../openfoodfacts";
import type { UsdaFoodClient } from "../usda";
import { ResolvedMealSchema } from "./types";
import type { NormalizedMeal, ResolvedCandidate, ResolvedMeal, ResolvedMealItem } from "./types";

const DISAMBIGUATION_SCHEMA = z.object({
  selected_candidate_id: z.string().min(1),
  confidence: z.number().min(0).max(1),
});

const DISAMBIGUATION_PROMPT = [
  "You are selecting the best food match for a personal fitness tracker.",
  "Return JSON only.",
  "Schema:",
  '{"selected_candidate_id":"string","confidence":0.8}',
  "Pick one candidate id from the provided candidates.",
].join("\n");

const NUTRITION_ESTIMATE_SCHEMA = z.object({
  calories_per_100: z.number().nonnegative().nullable(),
  protein_g_per_100: z.number().nonnegative().nullable(),
  fiber_g_per_100: z.number().nonnegative().nullable(),
  confidence: z.number().min(0).max(1),
});

const NUTRITION_ESTIMATE_PROMPT = [
  "Estimate nutrition for a food item and return JSON only.",
  "Schema:",
  '{"calories_per_100":123.4,"protein_g_per_100":3.2,"fiber_g_per_100":2.1,"confidence":0.8}',
  "Rules:",
  "- values are per 100g or per 100ml according to unit",
  "- for piece items, still estimate as if converted to weight basis per 100g",
  "- use null when unknown",
  "- confidence must be 0..1",
  "- no markdown",
].join("\n");

const estimateNutrientsWithLlm = async (
  item: NormalizedMeal["items"][number],
  llmClient: LlmClientPort,
): Promise<ResolvedCandidate> => {
  const payload = await llmClient.generateJson(
    `${NUTRITION_ESTIMATE_PROMPT}\nInput:\n${JSON.stringify(
      {
        food_name: item.food_name,
        quantity: item.quantity,
        unit: item.unit,
        original_quantity: item.original_quantity,
        original_unit: item.original_unit,
        preparation: item.preparation,
        brand: item.brand,
      },
      null,
      2,
    )}`,
  );
  const parsed = NUTRITION_ESTIMATE_SCHEMA.parse(payload);

  return {
    id: `llm:${item.food_name}`,
    source: "llm",
    name: item.food_name,
    brand: item.brand,
    score: parsed.confidence,
    raw: {
      nutriments: {
        "energy-kcal_100g": parsed.calories_per_100,
        proteins_100g: parsed.protein_g_per_100,
        fiber_100g: parsed.fiber_g_per_100,
      },
    },
  };
};

const normalizeFoodText = (value: string): string => {
  return value.toLowerCase().replace(/[_-]+/g, " ");
};

const normalizeSearchQuery = (value: string): string => {
  const normalized = normalizeFoodText(value).replace(/[^a-z0-9 ]/g, " ");
  const tokens = normalized
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1);

  const query = tokens.join(" ").trim();
  if (query.length > 0) {
    return query;
  }

  return value.trim();
};

const normalizeToken = (token: string): string => {
  if (token.length > 3 && token.endsWith("s")) {
    return token.slice(0, -1);
  }

  return token;
};

const tokenize = (value: string): Set<string> => {
  const cleaned = normalizeFoodText(value).replace(/[^a-z0-9 ]/g, " ");
  const tokens = cleaned
    .split(/\s+/)
    .map((token) => token.trim())
    .map((token) => normalizeToken(token))
    .filter((token) => token.length > 1);
  return new Set(tokens);
};

const overlapRatio = (a: Set<string>, b: Set<string>): number => {
  if (a.size === 0) {
    return 0;
  }

  let overlap = 0;
  for (const token of a) {
    if (b.has(token)) {
      overlap += 1;
    }
  }

  return overlap / a.size;
};

const symmetricOverlapRatio = (a: Set<string>, b: Set<string>): number => {
  return (overlapRatio(a, b) + overlapRatio(b, a)) / 2;
};

const clamp01 = (value: number): number => {
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return value;
};

const scoreCandidate = (
  item: NormalizedMeal["items"][number],
  candidate: Omit<ResolvedCandidate, "score">,
): number => {
  const itemTokens = tokenize(item.food_name);
  const candidateTokens = tokenize(candidate.name);
  const nameScore = symmetricOverlapRatio(itemTokens, candidateTokens);

  let brandScore = 0;
  if (item.brand !== null && candidate.brand !== null) {
    const itemBrandTokens = tokenize(item.brand);
    const candidateBrandTokens = tokenize(candidate.brand);
    brandScore = overlapRatio(itemBrandTokens, candidateBrandTokens);
  }

  let sourceScore = 0;
  if (item.is_branded_guess) {
    if (candidate.source === "off") {
      sourceScore = 1;
    }
  } else if (candidate.source === "usda") {
    sourceScore = 1;
  }

  let brandPresenceScore = 0;
  if (item.is_branded_guess) {
    if (candidate.brand !== null) {
      brandPresenceScore = 1;
    }
  } else if (candidate.brand === null) {
    brandPresenceScore = 1;
  }

  const score = clamp01(
    nameScore * 0.67 +
      brandScore * 0.1 +
      sourceScore * 0.08 +
      brandPresenceScore * 0.1 +
      item.confidence * 0.05,
  );
  return score;
};

const isAmbiguous = (topCandidates: ResolvedCandidate[]): boolean => {
  const top1 = topCandidates[0];
  const top2 = topCandidates[1];
  if (top1 === undefined) {
    return false;
  }

  if (top1.score < 0.75) {
    return true;
  }

  if (top2 === undefined) {
    return false;
  }

  return top1.score - top2.score < 0.08;
};

const toUsdaCandidates = (
  foods: Array<Record<string, unknown>>,
  item: NormalizedMeal["items"][number],
): ResolvedCandidate[] => {
  const result: ResolvedCandidate[] = [];
  for (const food of foods) {
    const fdcId = food.fdcId;
    const description = food.description;
    if (typeof fdcId !== "number" || typeof description !== "string") {
      continue;
    }

    const brandOwner = food.brandOwner;
    const rawCandidate: Omit<ResolvedCandidate, "score"> = {
      id: `usda:${String(fdcId)}`,
      source: "usda",
      name: description,
      brand: typeof brandOwner === "string" ? brandOwner : null,
      raw: food,
    };
    result.push({ ...rawCandidate, score: scoreCandidate(item, rawCandidate) });
  }
  return result;
};

const toOffCandidates = (
  products: Array<Record<string, unknown>>,
  item: NormalizedMeal["items"][number],
): ResolvedCandidate[] => {
  const result: ResolvedCandidate[] = [];
  for (const product of products) {
    const code = product.code;
    const productName = product.product_name;
    if (typeof code !== "string" || typeof productName !== "string") {
      continue;
    }

    const brands = product.brands;
    const rawCandidate: Omit<ResolvedCandidate, "score"> = {
      id: `off:${code}`,
      source: "off",
      name: productName,
      brand: typeof brands === "string" ? brands : null,
      raw: product,
    };
    result.push({ ...rawCandidate, score: scoreCandidate(item, rawCandidate) });
  }
  return result;
};

const disambiguateWithLlm = async (
  item: NormalizedMeal["items"][number],
  candidates: ResolvedCandidate[],
  llmClient: LlmClientPort,
): Promise<{ selectedId: string; confidence: number }> => {
  const payload = await llmClient.generateJson(
    `${DISAMBIGUATION_PROMPT}\nInput:\n${JSON.stringify(
      {
        item,
        candidates: candidates.map((candidate) => ({
          id: candidate.id,
          source: candidate.source,
          name: candidate.name,
          brand: candidate.brand,
          score: candidate.score,
        })),
      },
      null,
      2,
    )}`,
  );
  const parsed = DISAMBIGUATION_SCHEMA.parse(payload);
  return { selectedId: parsed.selected_candidate_id, confidence: parsed.confidence };
};

const resolveItem = async (
  item: NormalizedMeal["items"][number],
  usdaClient: UsdaFoodClient,
  offClient: OpenFoodFactsClient,
  llmClient: LlmClientPort,
): Promise<ResolvedMealItem> => {
  const query = normalizeSearchQuery(item.food_name);
  logger.debug({
    event: "pipeline.resolve.item.request",
    foodName: item.food_name,
    unit: item.unit,
    query,
  });

  let llmCandidate: ResolvedCandidate | null = null;
  try {
    llmCandidate = await estimateNutrientsWithLlm(item, llmClient);
  } catch (error: unknown) {
    logger.warn({
      event: "pipeline.resolve.llm.failed",
      foodName: item.food_name,
      message: error instanceof Error ? error.message : String(error),
    });
  }

  const candidates = llmCandidate === null ? [] : [llmCandidate];
  const selected = llmCandidate;
  const decisionSource = llmCandidate === null ? "none" : "llm";
  const disambiguationConfidence = llmCandidate === null ? null : llmCandidate.score;

  logger.debug({
    event: "pipeline.resolve.selected",
    foodName: item.food_name,
    decisionSource,
    selectedCandidateId: selected?.id,
  });

  return {
    ...item,
    top_candidates: candidates,
    selected_candidate: selected,
    decision_source: decisionSource,
    disambiguation_confidence: disambiguationConfidence,
  };
};

export const resolveNormalizedMeal = async (
  normalizedMeal: NormalizedMeal,
  usdaClient: UsdaFoodClient,
  offClient: OpenFoodFactsClient,
  llmClient: LlmClientPort,
): Promise<ResolvedMeal> => {
  logger.debug({ event: "pipeline.resolve.request", itemCount: normalizedMeal.items.length });
  const resolvedItems: ResolvedMealItem[] = [];

  for (const item of normalizedMeal.items) {
    const resolved = await resolveItem(item, usdaClient, offClient, llmClient);
    resolvedItems.push(resolved);
  }

  const resolvedMeal = ResolvedMealSchema.parse({ items: resolvedItems });
  logger.debug({ event: "pipeline.resolve.response", itemCount: resolvedMeal.items.length });
  return resolvedMeal;
};
