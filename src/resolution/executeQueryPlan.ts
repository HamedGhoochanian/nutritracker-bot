import { selectBestCandidate } from "../matching";
import type { CandidateMatcherOptions } from "../matching";
import type { OffProduct, OpenFoodFactsClientPort } from "../openfoodfacts";
import type { SourceRouteDecision, SourceRouteQuery } from "../source-router";
import type { UsdaFoodClientPort, UsdaFoodItem, UsdaSearchResultFood } from "../usda";
import type {
  CandidateResolutionExecutorPort,
  CandidateNutrientPreview,
  ResolutionAttempt,
  ResolutionExecutorDependencies,
  RetrievedFoodCandidate,
  RoutedItemResolution,
} from "./types";

const OFF_PRODUCT_FIELDS = [
  "code",
  "product_name",
  "generic_name",
  "brands",
  "categories",
  "quantity",
  "nutriments",
] as const;

export class CandidateResolutionExecutor implements CandidateResolutionExecutorPort {
  constructor(private readonly dependencies: ResolutionExecutorDependencies) {}

  async fetchCandidates(query: SourceRouteQuery): Promise<ResolutionAttempt> {
    if (query.source === "openfoodfacts") {
      return fetchOpenFoodFactsCandidates(query, this.dependencies.openFoodFactsClient);
    }

    return fetchUsdaCandidates(query, this.dependencies.usdaClient);
  }

  async fetchPrimaryCandidates(decision: SourceRouteDecision): Promise<ResolutionAttempt> {
    return this.fetchCandidates(decision.queryPlan.primary);
  }

  async fetchFallbackCandidates(decision: SourceRouteDecision): Promise<ResolutionAttempt> {
    return this.fetchCandidates(decision.queryPlan.fallback);
  }

  async resolveRoutedItem(
    decision: SourceRouteDecision,
    options: CandidateMatcherOptions = {},
  ): Promise<RoutedItemResolution> {
    const primaryAttempt = await this.fetchPrimaryCandidates(decision);
    const primarySelection = selectBestCandidate(decision.item, primaryAttempt.candidates, {
      ...options,
      preferredSource: options.preferredSource ?? decision.primarySource,
    });

    if (primarySelection.status === "accepted") {
      return {
        item: decision.item,
        decision,
        attempts: [primaryAttempt],
        usedFallback: false,
        selection: primarySelection,
      };
    }

    const fallbackAttempt = await this.fetchFallbackCandidates(decision);
    const combinedCandidates = dedupeCandidates([
      ...primaryAttempt.candidates,
      ...fallbackAttempt.candidates,
    ]);
    const finalSelection = selectBestCandidate(decision.item, combinedCandidates, {
      ...options,
      preferredSource: options.preferredSource ?? decision.primarySource,
    });

    return {
      item: decision.item,
      decision,
      attempts: [primaryAttempt, fallbackAttempt],
      usedFallback: true,
      selection: finalSelection,
    };
  }
}

export const fetchOpenFoodFactsCandidates = async (
  query: Extract<SourceRouteQuery, { source: "openfoodfacts" }>,
  client: OpenFoodFactsClientPort,
): Promise<ResolutionAttempt> => {
  const countryClient = client.forCountry(query.country);

  if (query.mode === "barcode_lookup") {
    const product = await countryClient.getProduct(query.barcode ?? "", OFF_PRODUCT_FIELDS);
    return {
      source: "openfoodfacts",
      query,
      candidates: product ? [mapOffProductToCandidate(product)] : [],
    };
  }

  const response = await countryClient.searchProducts(query.searchParams ?? {});
  return {
    source: "openfoodfacts",
    query,
    candidates: (response.products ?? []).map(mapOffProductToCandidate),
  };
};

export const fetchUsdaCandidates = async (
  query: Extract<SourceRouteQuery, { source: "usda" }>,
  client: UsdaFoodClientPort,
): Promise<ResolutionAttempt> => {
  const response = await client.searchFoods(query.searchCriteria);
  return {
    source: "usda",
    query,
    candidates: (response.foods ?? []).map(mapUsdaFoodToCandidate),
  };
};

export const mapOffProductToCandidate = (product: OffProduct): RetrievedFoodCandidate => {
  const name = stringifyFirst(
    product.product_name,
    product.generic_name,
    product.code,
    "unknown off product",
  );
  const brand = normalizeNullableString(product.brands);
  const category = normalizeNullableString(product.categories);
  const quantityText = normalizeNullableString(product.quantity);
  const nutrientPreview = extractOffNutrientPreview(product.nutriments);

  return {
    source: "openfoodfacts",
    sourceId: String(product.code ?? name),
    name,
    displayName: [brand, name].filter(Boolean).join(" "),
    brand,
    category,
    quantityText,
    barcode: normalizeNullableString(product.code),
    dataType: "OpenFoodFactsProduct",
    servingSize: null,
    servingUnit: null,
    householdServingText: quantityText,
    nutrientPreview,
    raw: product,
  };
};

export const mapUsdaFoodToCandidate = (
  food: UsdaSearchResultFood | UsdaFoodItem,
): RetrievedFoodCandidate => {
  const name = normalizeNullableString(food.description) ?? "unknown usda food";
  const brand = normalizeNullableString(extractString(food, "brandOwner"));
  const category = normalizeNullableString(
    extractString(food, "brandedFoodCategory") ?? extractString(food, "dataType"),
  );
  const quantityText = normalizeNullableString(extractString(food, "householdServingFullText"));
  const servingSize = extractNumber(food, "servingSize");
  const servingUnit = normalizeNullableString(extractString(food, "servingSizeUnit"));

  return {
    source: "usda",
    sourceId: String(food.fdcId),
    name,
    displayName: [brand, name].filter(Boolean).join(" "),
    brand,
    category,
    quantityText,
    barcode: normalizeNullableString(extractString(food, "gtinUpc")),
    dataType: normalizeNullableString(food.dataType),
    servingSize,
    servingUnit,
    householdServingText: quantityText,
    nutrientPreview: extractUsdaNutrientPreview(food),
    raw: food,
  };
};

const extractOffNutrientPreview = (
  nutriments: Record<string, unknown> | undefined,
): CandidateNutrientPreview => {
  const basis = inferOffNutrientBasis(nutriments);
  const basisUnit: CandidateNutrientPreview["basisUnit"] =
    basis === "per_100g"
      ? "g"
      : basis === "per_100ml"
        ? "ml"
        : basis === "per_serving"
          ? "serving"
          : "unknown";

  return {
    caloriesKcal:
      readNumber(nutriments, "energy-kcal_100g") ??
      readNumber(nutriments, "energy-kcal_100ml") ??
      readNumber(nutriments, "energy-kcal_serving") ??
      readNumber(nutriments, "energy-kcal"),
    proteinG:
      readNumber(nutriments, "proteins_100g") ??
      readNumber(nutriments, "proteins_100ml") ??
      readNumber(nutriments, "proteins_serving"),
    fiberG:
      readNumber(nutriments, "fiber_100g") ??
      readNumber(nutriments, "fiber_100ml") ??
      readNumber(nutriments, "fiber_serving"),
    carbsG:
      readNumber(nutriments, "carbohydrates_100g") ??
      readNumber(nutriments, "carbohydrates_100ml") ??
      readNumber(nutriments, "carbohydrates_serving"),
    fatG:
      readNumber(nutriments, "fat_100g") ??
      readNumber(nutriments, "fat_100ml") ??
      readNumber(nutriments, "fat_serving"),
    basis,
    basisAmount: basis === "per_serving" ? 1 : basis === "unknown" ? null : 100,
    basisUnit,
  };
};

const inferOffNutrientBasis = (
  nutriments: Record<string, unknown> | undefined,
): "per_100g" | "per_100ml" | "per_serving" | "unknown" => {
  if (!nutriments) {
    return "unknown";
  }
  if (Object.keys(nutriments).some((key) => key.endsWith("_100g"))) {
    return "per_100g";
  }
  if (Object.keys(nutriments).some((key) => key.endsWith("_100ml"))) {
    return "per_100ml";
  }
  if (Object.keys(nutriments).some((key) => key.endsWith("_serving"))) {
    return "per_serving";
  }
  return "unknown";
};

const extractUsdaNutrientPreview = (
  food: UsdaSearchResultFood | UsdaFoodItem,
): CandidateNutrientPreview => {
  const nutrients = Array.isArray(food.foodNutrients) ? food.foodNutrients : [];
  const protein = nutrients.find((entry) => nutrientMatches(entry, [203], ["protein"]));
  const fiber = nutrients.find((entry) => nutrientMatches(entry, [291], ["fiber", "fibre"]));
  const calories = nutrients.find((entry) => nutrientMatches(entry, [208, 1008], ["energy"]));
  const carbs = nutrients.find((entry) => nutrientMatches(entry, [205], ["carbohydrate"]));
  const fat = nutrients.find((entry) => nutrientMatches(entry, [204], ["total lipid", "fat"]));
  const basis = inferUsdaNutrientBasis(food);
  const basisAmount = basis === "per_serving" ? 1 : basis === "unknown" ? null : 100;
  const basisUnit: CandidateNutrientPreview["basisUnit"] =
    basis === "per_100ml"
      ? "ml"
      : basis === "per_serving"
        ? "serving"
        : basis === "unknown"
          ? "unknown"
          : "g";

  return {
    caloriesKcal: extractNutrientAmount(calories),
    proteinG: extractNutrientAmount(protein),
    fiberG: extractNutrientAmount(fiber),
    carbsG: extractNutrientAmount(carbs),
    fatG: extractNutrientAmount(fat),
    basis,
    basisAmount,
    basisUnit,
  };
};

const inferUsdaNutrientBasis = (
  food: UsdaSearchResultFood | UsdaFoodItem,
): CandidateNutrientPreview["basis"] => {
  const servingSize = extractNumber(food, "servingSize");
  const servingUnit = normalizeNullableString(extractString(food, "servingSizeUnit"));

  if (food.dataType === "Branded" && servingSize && servingUnit) {
    return "per_serving";
  }

  if (food.dataType === "Branded") {
    return "per_serving";
  }

  return "per_100g";
};

const nutrientMatches = (nutrient: unknown, numbers: number[], names: string[]): boolean => {
  if (!nutrient || typeof nutrient !== "object") {
    return false;
  }

  const record = nutrient as Record<string, unknown>;
  const numericCode = typeof record.number === "number" ? record.number : Number(record.number);
  const nestedNumber =
    typeof (record.nutrient as { number?: unknown } | undefined)?.number === "string"
      ? Number((record.nutrient as { number?: string }).number)
      : Number((record.nutrient as { number?: unknown } | undefined)?.number);
  const name = normalizeNullableString(
    typeof record.name === "string"
      ? record.name
      : typeof (record.nutrient as { name?: unknown } | undefined)?.name === "string"
        ? ((record.nutrient as { name?: string }).name ?? null)
        : null,
  );

  return (
    numbers.includes(numericCode) ||
    numbers.includes(nestedNumber) ||
    names.some((part) => name?.includes(part))
  );
};

const extractNutrientAmount = (nutrient: unknown): number | null => {
  if (!nutrient || typeof nutrient !== "object") {
    return null;
  }

  const value = (nutrient as { amount?: unknown }).amount;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
};

const readNumber = (record: Record<string, unknown> | undefined, key: string): number | null => {
  if (!record) {
    return null;
  }

  const value = record[key];
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const normalizeNullableString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const extractString = (record: Record<string, unknown>, key: string): string | null => {
  return normalizeNullableString(record[key]);
};

const extractNumber = (record: Record<string, unknown>, key: string): number | null => {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
};

const stringifyFirst = (...values: Array<unknown>): string => {
  for (const value of values) {
    const normalized = normalizeNullableString(value);
    if (normalized) {
      return normalized;
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return "unknown";
};

const dedupeCandidates = (candidates: RetrievedFoodCandidate[]): RetrievedFoodCandidate[] => {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = `${candidate.source}:${candidate.sourceId}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};
