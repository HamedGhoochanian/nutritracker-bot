import type { NormalizedMealItem } from "../meal";
import type { RetrievedFoodCandidate } from "../resolution/types";
import type { CandidateMatcherOptions, CandidateScoreBreakdown, ScoredCandidate } from "./types";

const DEFAULT_ACCEPTED_SCORE = 45;
const DEFAULT_REVIEW_SCORE = 28;
const DEFAULT_MINIMUM_LEAD = 6;

export const DEFAULT_MATCH_THRESHOLDS = {
  acceptedScore: DEFAULT_ACCEPTED_SCORE,
  reviewScore: DEFAULT_REVIEW_SCORE,
  minimumLead: DEFAULT_MINIMUM_LEAD,
} as const;

export const scoreCandidate = (
  item: NormalizedMealItem,
  candidate: RetrievedFoodCandidate,
  options: CandidateMatcherOptions = {},
): ScoredCandidate => {
  const itemName = normalizeText(item.foodName);
  const candidateName = normalizeText(candidate.name);
  const itemTokens = tokenize(itemName);
  const candidateTokens = tokenize(`${candidateName} ${normalizeText(candidate.category)}`);
  const overlap = intersectCount(itemTokens, candidateTokens);

  let nameScore = 0;
  const reasons: string[] = [];
  if (itemName && candidateName && itemName === candidateName) {
    nameScore = 35;
    reasons.push("exact_name_match");
  } else if (
    itemName &&
    candidateName &&
    (candidateName.includes(itemName) || itemName.includes(candidateName))
  ) {
    nameScore = 34;
    reasons.push("partial_name_match");
  } else if (itemTokens.length > 0) {
    nameScore = Math.round((overlap / itemTokens.length) * 24);
    if (nameScore > 0) {
      reasons.push("token_name_overlap");
    }
  }

  let brandScore = 0;
  const itemBrand = normalizeText(item.brand);
  const candidateBrand = normalizeText(candidate.brand);
  if (itemBrand && candidateBrand) {
    if (itemBrand === candidateBrand) {
      brandScore = 20;
      reasons.push("exact_brand_match");
    } else if (candidateBrand.includes(itemBrand) || itemBrand.includes(candidateBrand)) {
      brandScore = 12;
      reasons.push("partial_brand_match");
    } else {
      brandScore = -8;
      reasons.push("brand_mismatch");
    }
  } else if (itemBrand && !candidateBrand) {
    brandScore = -6;
    reasons.push("missing_candidate_brand");
  }

  let preparationScore = 0;
  const itemPreparation = normalizeText(item.preparation);
  const preparationHaystack = normalizeText(`${candidate.name} ${candidate.category}`);
  if (itemPreparation) {
    if (preparationHaystack.includes(itemPreparation)) {
      preparationScore = 8;
      reasons.push("preparation_match");
    } else {
      preparationScore = -2;
      reasons.push("preparation_missing");
    }
  }

  let packagingScore = 0;
  const itemPackaging = normalizeText(item.packagingHint);
  const packagingHaystack = normalizeText(
    `${candidate.quantityText} ${candidate.householdServingText} ${candidate.name}`,
  );
  if (itemPackaging && packagingHaystack.includes(itemPackaging)) {
    packagingScore += 8;
    reasons.push("packaging_match");
  }
  if (item.normalizedAmount.kind === "discrete") {
    if (candidate.quantityText || candidate.householdServingText || candidate.servingSize) {
      packagingScore += 5;
      reasons.push("serving_metadata_present");
    } else {
      packagingScore -= 4;
      reasons.push("serving_metadata_missing");
    }
  }

  let barcodeScore = 0;
  if (candidate.barcode && item.rawText.includes(candidate.barcode)) {
    barcodeScore = 25;
    reasons.push("barcode_match");
  }

  const sourcePreferenceScore =
    options.preferredSource && candidate.source === options.preferredSource ? 4 : 0;
  if (sourcePreferenceScore > 0) {
    reasons.push("preferred_source_bonus");
  }

  let nutrientScore = 0;
  if (
    candidate.nutrientPreview.caloriesKcal !== null ||
    candidate.nutrientPreview.proteinG !== null ||
    candidate.nutrientPreview.fiberG !== null
  ) {
    nutrientScore = 3;
    reasons.push("nutrient_preview_present");
  }

  let penaltyScore = 0;
  if (!candidate.name.trim()) {
    penaltyScore -= 10;
    reasons.push("missing_candidate_name");
  }
  if (item.isBrandedGuess && !candidate.brand && candidate.source === "usda") {
    penaltyScore -= 3;
    reasons.push("branded_hint_without_brand");
  }

  const total =
    nameScore +
    brandScore +
    preparationScore +
    packagingScore +
    barcodeScore +
    sourcePreferenceScore +
    nutrientScore +
    penaltyScore;

  const breakdown: CandidateScoreBreakdown = {
    nameScore,
    brandScore,
    preparationScore,
    packagingScore,
    barcodeScore,
    sourcePreferenceScore,
    nutrientScore,
    penaltyScore,
    total,
    reasons,
  };

  return {
    candidate,
    score: total,
    breakdown,
  };
};

export const getMatcherThresholds = (options: CandidateMatcherOptions = {}) => {
  return {
    acceptedScore: options.acceptedScore ?? DEFAULT_ACCEPTED_SCORE,
    reviewScore: options.reviewScore ?? DEFAULT_REVIEW_SCORE,
    minimumLead: options.minimumLead ?? DEFAULT_MINIMUM_LEAD,
  };
};

const tokenize = (value: string): string[] => {
  return normalizeText(value)
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter(Boolean);
};

const intersectCount = (a: string[], b: string[]): number => {
  const bSet = new Set(b);
  return a.filter((token) => bSet.has(token)).length;
};

const normalizeText = (value: string | null | undefined): string => {
  return (value ?? "").trim().toLowerCase();
};
