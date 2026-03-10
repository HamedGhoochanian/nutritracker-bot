import type { NormalizedMealItem } from "../meal";
import type { RetrievedFoodCandidate } from "../resolution/types";
import { getMatcherThresholds, scoreCandidate } from "./scoreCandidate";
import type { CandidateMatcherOptions, CandidateSelection } from "./types";

export const selectBestCandidate = (
  item: NormalizedMealItem,
  candidates: RetrievedFoodCandidate[],
  options: CandidateMatcherOptions = {},
): CandidateSelection => {
  const thresholds = getMatcherThresholds(options);
  const scoredCandidates = candidates
    .map((candidate) => scoreCandidate(item, candidate, options))
    .sort((left, right) => right.score - left.score);

  const bestCandidate = scoredCandidates[0] ?? null;
  const nextBestScore = scoredCandidates[1]?.score ?? Number.NEGATIVE_INFINITY;

  let status: CandidateSelection["status"] = "unresolved";
  if (bestCandidate) {
    const lead = bestCandidate.score - nextBestScore;
    if (bestCandidate.score >= thresholds.acceptedScore && lead >= thresholds.minimumLead) {
      status = "accepted";
    } else if (bestCandidate.score >= thresholds.reviewScore) {
      status = "needs_review";
    }
  }

  return {
    item,
    status,
    bestCandidate,
    scoredCandidates,
    thresholds,
  };
};
