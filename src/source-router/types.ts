import type { NormalizedMeal, NormalizedMealItem } from "../meal";
import type { OffLang, OffSearchParams } from "../openfoodfacts";
import type { UsdaFoodDataType, UsdaFoodSearchCriteria } from "../usda";

export type FoodSource = "openfoodfacts" | "usda";

export type RouteClassification = "barcode_like" | "likely_branded" | "generic" | "ambiguous";

export type RouteStrategy = "heuristic_first_with_fallback";

export type RoutingReason =
  | "barcode_like"
  | "explicit_brand"
  | "branded_guess"
  | "packaging_hint"
  | "packaged_unit"
  | "product_wording"
  | "generic_food"
  | "preparation_heavy"
  | "metric_amount"
  | "requires_food_specific_resolution"
  | "low_parser_confidence"
  | "underspecified_item";

export type OpenFoodFactsRouteQuery = {
  source: "openfoodfacts";
  mode: "barcode_lookup" | "search";
  queryText: string;
  barcode?: string;
  country: OffLang;
  searchParams?: OffSearchParams;
};

export type UsdaRouteQuery = {
  source: "usda";
  mode: "search";
  queryText: string;
  dataType: readonly UsdaFoodDataType[];
  searchCriteria: UsdaFoodSearchCriteria;
};

export type SourceRouteQuery = OpenFoodFactsRouteQuery | UsdaRouteQuery;

export type SourceRouteQueryPlan = {
  primary: SourceRouteQuery;
  fallback: SourceRouteQuery;
};

export type SourceRouteDecision = {
  item: NormalizedMealItem;
  strategy: RouteStrategy;
  classification: RouteClassification;
  primarySource: FoodSource;
  fallbackSource: FoodSource;
  reasons: RoutingReason[];
  confidence: number;
  queryPlan: SourceRouteQueryPlan;
};

export type MealRouteDecision = {
  meal: NormalizedMeal;
  items: SourceRouteDecision[];
};

export type SourceRouterOptions = {
  offCountry?: OffLang;
  offSearchPageSize?: number;
  lowConfidenceThreshold?: number;
};

export interface SourceRouterPort {
  routeItem(item: NormalizedMealItem): SourceRouteDecision;
  routeMeal(meal: NormalizedMeal): MealRouteDecision;
}
