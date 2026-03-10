import type { NormalizedMeal, NormalizedMealItem, NormalizedDiscreteUnit } from "../meal";
import type { OffSearchParams } from "../openfoodfacts";
import type { UsdaFoodDataType, UsdaFoodSearchCriteria } from "../usda";
import type {
  FoodSource,
  MealRouteDecision,
  OpenFoodFactsRouteQuery,
  RouteClassification,
  RoutingReason,
  SourceRouteDecision,
  SourceRouteQuery,
  SourceRouteQueryPlan,
  SourceRouterOptions,
  SourceRouterPort,
  UsdaRouteQuery,
} from "./types";

const DEFAULT_OFF_COUNTRY = "world";
const DEFAULT_OFF_SEARCH_PAGE_SIZE = 10;
const DEFAULT_LOW_CONFIDENCE_THRESHOLD = 0.7;

const PACKAGED_HINTS = new Set<NormalizedDiscreteUnit | string>([
  "can",
  "bottle",
  "packet",
  "bar",
  "container",
  "jar",
]);

const PRODUCT_KEYWORDS = [
  "protein",
  "zero",
  "soda",
  "cola",
  "yogurt",
  "yoghurt",
  "drink",
  "shake",
  "chips",
  "cracker",
  "cookie",
  "cereal",
  "snack",
  "granola",
  "sauce",
  "dressing",
  "powder",
  "supplement",
  "ice cream",
  "energy bar",
  "protein bar",
] as const;

const PREPARATION_KEYWORDS = [
  "raw",
  "cooked",
  "boiled",
  "grilled",
  "fried",
  "roasted",
  "baked",
  "steamed",
  "whole",
  "skimmed",
  "skinless",
] as const;

const GENERIC_FOOD_KEYWORDS = [
  "apple",
  "banana",
  "milk",
  "egg",
  "chicken",
  "rice",
  "beef",
  "oats",
  "bread",
  "yogurt",
  "cheese",
  "potato",
  "salmon",
  "beans",
  "broccoli",
  "berries",
  "peanut butter",
  "spinach",
  "tomato",
  "avocado",
] as const;

const GENERIC_USDA_DATA_TYPES: readonly UsdaFoodDataType[] = [
  "Foundation",
  "SR Legacy",
  "Survey (FNDDS)",
];

const BRANDED_USDA_DATA_TYPES: readonly UsdaFoodDataType[] = ["Branded"];

export class SourceRouter implements SourceRouterPort {
  private readonly offCountry: string;
  private readonly offSearchPageSize: number;
  private readonly lowConfidenceThreshold: number;

  constructor(options: SourceRouterOptions = {}) {
    this.offCountry = options.offCountry ?? DEFAULT_OFF_COUNTRY;
    this.offSearchPageSize = options.offSearchPageSize ?? DEFAULT_OFF_SEARCH_PAGE_SIZE;
    this.lowConfidenceThreshold =
      options.lowConfidenceThreshold ?? DEFAULT_LOW_CONFIDENCE_THRESHOLD;
  }

  routeItem(item: NormalizedMealItem): SourceRouteDecision {
    return routeNormalizedMealItem(item, {
      lowConfidenceThreshold: this.lowConfidenceThreshold,
      offCountry: this.offCountry,
      offSearchPageSize: this.offSearchPageSize,
    });
  }

  routeMeal(meal: NormalizedMeal): MealRouteDecision {
    return {
      meal,
      items: meal.items.map((item) => this.routeItem(item)),
    };
  }
}

export const routeNormalizedMeal = (
  meal: NormalizedMeal,
  options: SourceRouterOptions = {},
): MealRouteDecision => {
  const router = new SourceRouter(options);
  return router.routeMeal(meal);
};

export const routeNormalizedMealItem = (
  item: NormalizedMealItem,
  options: SourceRouterOptions = {},
): SourceRouteDecision => {
  const offCountry = options.offCountry ?? DEFAULT_OFF_COUNTRY;
  const offSearchPageSize = options.offSearchPageSize ?? DEFAULT_OFF_SEARCH_PAGE_SIZE;
  const lowConfidenceThreshold = options.lowConfidenceThreshold ?? DEFAULT_LOW_CONFIDENCE_THRESHOLD;

  const signals = scoreItemSignals(item, lowConfidenceThreshold);
  const classification = classifyItem(
    item,
    signals.offScore,
    signals.usdaScore,
    lowConfidenceThreshold,
  );
  const sources = pickSources(classification, signals.offScore, signals.usdaScore);
  const queryPlan = buildQueryPlan(
    item,
    classification,
    sources.primarySource,
    sources.fallbackSource,
    {
      offCountry,
      offSearchPageSize,
    },
  );

  return {
    item,
    strategy: "heuristic_first_with_fallback",
    classification,
    primarySource: sources.primarySource,
    fallbackSource: sources.fallbackSource,
    reasons: dedupeReasons(signals.reasons),
    confidence: buildDecisionConfidence(signals.offScore, signals.usdaScore),
    queryPlan,
  };
};

const scoreItemSignals = (item: NormalizedMealItem, lowConfidenceThreshold: number) => {
  let offScore = 0;
  let usdaScore = 0;
  const reasons: RoutingReason[] = [];

  const searchableText = buildSearchableText(item);
  const barcode = extractBarcode(searchableText);
  const packagingHint = item.packagingHint?.toLowerCase() ?? null;
  const hasPackagedUnit =
    item.normalizedAmount.kind === "discrete" && PACKAGED_HINTS.has(item.normalizedAmount.unit);
  const hasProductWording = PRODUCT_KEYWORDS.some((keyword) => searchableText.includes(keyword));
  const hasPreparationWording = PREPARATION_KEYWORDS.some((keyword) =>
    searchableText.includes(keyword),
  );
  const looksGenericFood = GENERIC_FOOD_KEYWORDS.some((keyword) =>
    searchableText.includes(keyword),
  );
  const isLowConfidence = item.confidence < lowConfidenceThreshold;
  const isUnderspecified =
    item.foodName.trim().split(/\s+/).length <= 1 && item.foodName.trim().length <= 4;

  if (barcode) {
    offScore += 8;
    reasons.push("barcode_like");
  }

  if (item.brand) {
    offScore += 5;
    reasons.push("explicit_brand");
  }

  if (item.isBrandedGuess) {
    offScore += 4;
    reasons.push("branded_guess");
  }

  if (packagingHint && PACKAGED_HINTS.has(packagingHint)) {
    offScore += 3;
    reasons.push("packaging_hint");
  }

  if (hasPackagedUnit) {
    offScore += 2;
    reasons.push("packaged_unit");
  }

  if (hasProductWording) {
    offScore += 2;
    reasons.push("product_wording");
  }

  if (
    looksGenericFood &&
    !item.brand &&
    !item.isBrandedGuess &&
    !packagingHint &&
    !hasPackagedUnit
  ) {
    usdaScore += 4;
    reasons.push("generic_food");
  }

  if (hasPreparationWording || item.preparation) {
    usdaScore += 2;
    reasons.push("preparation_heavy");
  }

  if (item.normalizedAmount.kind === "mass" || item.normalizedAmount.kind === "volume") {
    usdaScore += 1;
    reasons.push("metric_amount");
  }

  if (item.normalizationWarnings.includes("requires_food_specific_resolution")) {
    offScore += 1;
    usdaScore += 1;
    reasons.push("requires_food_specific_resolution");
  }

  if (isLowConfidence) {
    offScore += 1;
    usdaScore += 1;
    reasons.push("low_parser_confidence");
  }

  if (isUnderspecified) {
    offScore += 1;
    usdaScore += 1;
    reasons.push("underspecified_item");
  }

  return { offScore, usdaScore, reasons, barcode };
};

const classifyItem = (
  item: NormalizedMealItem,
  offScore: number,
  usdaScore: number,
  lowConfidenceThreshold: number,
): RouteClassification => {
  const searchableText = buildSearchableText(item);
  const isLowConfidence = item.confidence < lowConfidenceThreshold;
  if (extractBarcode(searchableText)) {
    return "barcode_like";
  }

  if (isLowConfidence && Math.abs(offScore - usdaScore) <= 2) {
    return "ambiguous";
  }

  if (item.brand || item.isBrandedGuess || item.packagingHint || offScore - usdaScore >= 3) {
    return "likely_branded";
  }

  if (usdaScore - offScore >= 2) {
    return "generic";
  }

  return "ambiguous";
};

const pickSources = (
  classification: RouteClassification,
  offScore: number,
  usdaScore: number,
): { primarySource: FoodSource; fallbackSource: FoodSource } => {
  if (classification === "barcode_like" || classification === "likely_branded") {
    return { primarySource: "openfoodfacts", fallbackSource: "usda" };
  }

  if (classification === "generic") {
    return { primarySource: "usda", fallbackSource: "openfoodfacts" };
  }

  if (offScore > usdaScore) {
    return { primarySource: "openfoodfacts", fallbackSource: "usda" };
  }

  return { primarySource: "usda", fallbackSource: "openfoodfacts" };
};

const buildQueryPlan = (
  item: NormalizedMealItem,
  classification: RouteClassification,
  primarySource: FoodSource,
  fallbackSource: FoodSource,
  options: { offCountry: string; offSearchPageSize: number },
): SourceRouteQueryPlan => {
  return {
    primary: buildSourceQuery(item, classification, primarySource, options),
    fallback: buildSourceQuery(item, classification, fallbackSource, options),
  };
};

const buildSourceQuery = (
  item: NormalizedMealItem,
  classification: RouteClassification,
  source: FoodSource,
  options: { offCountry: string; offSearchPageSize: number },
): SourceRouteQuery => {
  if (source === "openfoodfacts") {
    return buildOpenFoodFactsQuery(item, options.offCountry, options.offSearchPageSize);
  }

  return buildUsdaQuery(item, classification);
};

const buildOpenFoodFactsQuery = (
  item: NormalizedMealItem,
  country: string,
  pageSize: number,
): OpenFoodFactsRouteQuery => {
  const searchableText = buildSearchableText(item);
  const barcode = extractBarcode(searchableText);
  const queryText = buildOffQueryText(item);

  if (barcode) {
    return {
      source: "openfoodfacts",
      mode: "barcode_lookup",
      barcode,
      queryText,
      country,
    };
  }

  const searchParams: OffSearchParams = {
    search_terms: queryText,
    page: 1,
    page_size: pageSize,
    fields: [
      "code",
      "product_name",
      "generic_name",
      "brands",
      "categories",
      "quantity",
      "nutriments",
    ],
  };

  return {
    source: "openfoodfacts",
    mode: "search",
    queryText,
    country,
    searchParams,
  };
};

const buildUsdaQuery = (
  item: NormalizedMealItem,
  classification: RouteClassification,
): UsdaRouteQuery => {
  const queryText = buildUsdaQueryText(item);
  const dataType =
    classification === "likely_branded" ? BRANDED_USDA_DATA_TYPES : GENERIC_USDA_DATA_TYPES;

  const searchCriteria: UsdaFoodSearchCriteria = {
    query: queryText,
    dataType,
    pageNumber: 1,
    pageSize: 10,
  };

  if (classification === "likely_branded" && item.brand) {
    searchCriteria.brandOwner = item.brand;
  }

  return {
    source: "usda",
    mode: "search",
    queryText,
    dataType,
    searchCriteria,
  };
};

const buildDecisionConfidence = (offScore: number, usdaScore: number): number => {
  const delta = Math.abs(offScore - usdaScore);
  const confidence = 0.5 + Math.min(delta, 5) * 0.1;
  return Number(confidence.toFixed(2));
};

const buildSearchableText = (item: NormalizedMealItem): string => {
  return [item.rawText, item.foodName, item.preparation, item.brand, item.packagingHint]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase();
};

const buildOffQueryText = (item: NormalizedMealItem): string => {
  const uniqueParts = [item.brand, item.foodName, item.preparation, item.packagingHint]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.trim())
    .filter((value, index, values) => values.indexOf(value) === index);

  return uniqueParts.join(" ").trim();
};

const buildUsdaQueryText = (item: NormalizedMealItem): string => {
  return [item.foodName, item.preparation]
    .filter((value): value is string => Boolean(value))
    .join(", ");
};

const extractBarcode = (text: string): string | null => {
  const matches = text.match(/\b\d{8,14}\b/g);
  return matches?.[0] ?? null;
};

const dedupeReasons = (reasons: RoutingReason[]): RoutingReason[] => {
  return [...new Set(reasons)];
};
