import type { CandidateSelection } from "../matching";
import type { CandidateNutrientPreview, RoutedItemResolution } from "../resolution";
import type {
  CanonicalNutrients,
  ComputedMealItemNutrition,
  ConsumedAmount,
  MealNutritionComputerPort,
  NutrientComputationStatus,
} from "./types";

const EMPTY_NUTRIENTS: CanonicalNutrients = {
  caloriesKcal: 0,
  proteinG: 0,
  fiberG: 0,
  carbsG: 0,
  fatG: 0,
};

export class MealNutritionComputer implements MealNutritionComputerPort {
  computeItemNutrition(resolution: RoutedItemResolution): ComputedMealItemNutrition {
    return computeItemNutrition(resolution);
  }
}

export const computeItemNutrition = (
  resolution: RoutedItemResolution,
): ComputedMealItemNutrition => {
  const selection = resolution.selection;
  const best = selection.bestCandidate;

  if (!best) {
    return buildUnresolvedResult(resolution, selection, ["no_candidate_selected"]);
  }

  const scaling = deriveConsumedAmountAndMultiplier(resolution, best.candidate.nutrientPreview);
  if (!scaling) {
    return buildUnresolvedResult(resolution, selection, ["incompatible_amount_and_nutrient_basis"]);
  }

  const nutrients = scaleNutrients(best.candidate.nutrientPreview, scaling.multiplier);
  const status: NutrientComputationStatus =
    selection.status === "accepted"
      ? "computed"
      : selection.status === "needs_review"
        ? "needs_review"
        : "unresolved";
  const warnings = [...scaling.warnings];
  if (selection.status === "needs_review") {
    warnings.push("candidate_needs_review");
  }

  return {
    item: resolution.item,
    resolution,
    selection,
    consumedAmount: scaling.consumedAmount,
    nutrients,
    status,
    warnings,
  };
};

type ScalingResult = {
  consumedAmount: ConsumedAmount;
  multiplier: number;
  warnings: string[];
};

const deriveConsumedAmountAndMultiplier = (
  resolution: RoutedItemResolution,
  nutrientPreview: CandidateNutrientPreview,
): ScalingResult | null => {
  const item = resolution.item;
  const candidate = resolution.selection.bestCandidate?.candidate;
  if (!candidate) {
    return null;
  }

  const basisAmount = nutrientPreview.basisAmount;
  const basisUnit = nutrientPreview.basisUnit;
  if (basisAmount === null || basisAmount <= 0 || nutrientPreview.basis === "unknown") {
    return null;
  }

  if (item.normalizedAmount.kind === "mass") {
    if (basisUnit === "g") {
      return {
        consumedAmount: { kind: "mass", value: item.normalizedAmount.value, unit: "g" },
        multiplier: item.normalizedAmount.value / basisAmount,
        warnings: [],
      };
    }

    if (
      nutrientPreview.basis === "per_serving" &&
      candidate.servingSize &&
      candidate.servingUnit === "g"
    ) {
      return {
        consumedAmount: { kind: "mass", value: item.normalizedAmount.value, unit: "g" },
        multiplier: item.normalizedAmount.value / candidate.servingSize,
        warnings: ["converted_mass_against_serving_size"],
      };
    }

    return null;
  }

  if (item.normalizedAmount.kind === "volume") {
    if (basisUnit === "ml") {
      return {
        consumedAmount: { kind: "volume", value: item.normalizedAmount.value, unit: "ml" },
        multiplier: item.normalizedAmount.value / basisAmount,
        warnings: [],
      };
    }

    if (
      nutrientPreview.basis === "per_serving" &&
      candidate.servingSize &&
      candidate.servingUnit === "ml"
    ) {
      return {
        consumedAmount: { kind: "volume", value: item.normalizedAmount.value, unit: "ml" },
        multiplier: item.normalizedAmount.value / candidate.servingSize,
        warnings: ["converted_volume_against_serving_size"],
      };
    }

    return null;
  }

  if (item.normalizedAmount.kind === "discrete") {
    if (nutrientPreview.basis === "per_serving") {
      return {
        consumedAmount: { kind: "serving", value: item.normalizedAmount.value, unit: "serving" },
        multiplier: item.normalizedAmount.value / basisAmount,
        warnings: [],
      };
    }

    if (
      candidate.servingSize &&
      candidate.servingUnit === basisUnit &&
      (basisUnit === "g" || basisUnit === "ml")
    ) {
      return {
        consumedAmount:
          basisUnit === "g"
            ? {
                kind: "mass",
                value: item.normalizedAmount.value * candidate.servingSize,
                unit: "g",
              }
            : {
                kind: "volume",
                value: item.normalizedAmount.value * candidate.servingSize,
                unit: "ml",
              },
        multiplier: (item.normalizedAmount.value * candidate.servingSize) / basisAmount,
        warnings: ["estimated_from_candidate_serving_size"],
      };
    }

    return null;
  }

  return null;
};

const scaleNutrients = (
  nutrientPreview: CandidateNutrientPreview,
  multiplier: number,
): CanonicalNutrients => {
  return {
    caloriesKcal: roundNutrient((nutrientPreview.caloriesKcal ?? 0) * multiplier),
    proteinG: roundNutrient((nutrientPreview.proteinG ?? 0) * multiplier),
    fiberG: roundNutrient((nutrientPreview.fiberG ?? 0) * multiplier),
    carbsG: roundNutrient((nutrientPreview.carbsG ?? 0) * multiplier),
    fatG: roundNutrient((nutrientPreview.fatG ?? 0) * multiplier),
  };
};

const roundNutrient = (value: number): number => {
  return Number(value.toFixed(2));
};

const buildUnresolvedResult = (
  resolution: RoutedItemResolution,
  selection: CandidateSelection,
  warnings: string[],
): ComputedMealItemNutrition => {
  return {
    item: resolution.item,
    resolution,
    selection,
    consumedAmount: { kind: "unknown", value: resolution.item.quantity, unit: "unknown" },
    nutrients: null,
    status: "unresolved",
    warnings,
  };
};

export const zeroCanonicalNutrients = (): CanonicalNutrients => ({ ...EMPTY_NUTRIENTS });
