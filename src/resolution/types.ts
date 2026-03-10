import type { NormalizedMealItem } from "../meal";
import type { OffProduct, OpenFoodFactsClientPort } from "../openfoodfacts";
import type { SourceRouteDecision, SourceRouteQuery } from "../source-router";
import type { UsdaFoodClientPort, UsdaFoodItem, UsdaSearchResultFood } from "../usda";

export type CandidateNutrientBasis = "per_100g" | "per_100ml" | "per_serving" | "unknown";

export type CandidateNutrientPreview = {
  caloriesKcal: number | null;
  proteinG: number | null;
  fiberG: number | null;
  carbsG: number | null;
  fatG: number | null;
  basis: CandidateNutrientBasis;
  basisAmount: number | null;
  basisUnit: "g" | "ml" | "serving" | "unknown";
};

export type RetrievedFoodCandidate = {
  source: "openfoodfacts" | "usda";
  sourceId: string;
  name: string;
  displayName: string;
  brand: string | null;
  category: string | null;
  quantityText: string | null;
  barcode: string | null;
  dataType: string | null;
  servingSize: number | null;
  servingUnit: string | null;
  householdServingText: string | null;
  nutrientPreview: CandidateNutrientPreview;
  raw: OffProduct | UsdaSearchResultFood | UsdaFoodItem;
};

export type ResolutionAttempt = {
  source: "openfoodfacts" | "usda";
  query: SourceRouteQuery;
  candidates: RetrievedFoodCandidate[];
};

export type ResolutionExecutorDependencies = {
  openFoodFactsClient: OpenFoodFactsClientPort;
  usdaClient: UsdaFoodClientPort;
};

export type RoutedItemResolution = {
  item: NormalizedMealItem;
  decision: SourceRouteDecision;
  attempts: ResolutionAttempt[];
  usedFallback: boolean;
  selection: import("../matching").CandidateSelection;
};

export interface CandidateResolutionExecutorPort {
  fetchCandidates(query: SourceRouteQuery): Promise<ResolutionAttempt>;
  fetchPrimaryCandidates(decision: SourceRouteDecision): Promise<ResolutionAttempt>;
  fetchFallbackCandidates(decision: SourceRouteDecision): Promise<ResolutionAttempt>;
  resolveRoutedItem(
    decision: SourceRouteDecision,
    options?: import("../matching").CandidateMatcherOptions,
  ): Promise<RoutedItemResolution>;
}
