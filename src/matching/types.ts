import type { NormalizedMealItem } from "../meal";
import type { RetrievedFoodCandidate } from "../resolution/types";
import type { FoodSource } from "../source-router";

export type MatchStatus = "accepted" | "needs_review" | "unresolved";

export type CandidateScoreBreakdown = {
  nameScore: number;
  brandScore: number;
  preparationScore: number;
  packagingScore: number;
  barcodeScore: number;
  sourcePreferenceScore: number;
  nutrientScore: number;
  penaltyScore: number;
  total: number;
  reasons: string[];
};

export type ScoredCandidate = {
  candidate: RetrievedFoodCandidate;
  score: number;
  breakdown: CandidateScoreBreakdown;
};

export type CandidateMatcherOptions = {
  preferredSource?: FoodSource;
  acceptedScore?: number;
  reviewScore?: number;
  minimumLead?: number;
};

export type CandidateSelection = {
  item: NormalizedMealItem;
  status: MatchStatus;
  bestCandidate: ScoredCandidate | null;
  scoredCandidates: ScoredCandidate[];
  thresholds: {
    acceptedScore: number;
    reviewScore: number;
    minimumLead: number;
  };
};
