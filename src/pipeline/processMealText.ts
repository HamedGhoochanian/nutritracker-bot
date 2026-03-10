import { aggregateMealNutrition, computeItemNutrition } from "../nutrition";
import type {
  ProcessMealTextDependencies,
  ProcessMealTextOptions,
  ProcessMealTextResult,
} from "./types";

export const processMealText = async (
  input: string,
  dependencies: ProcessMealTextDependencies,
  options: ProcessMealTextOptions = {},
): Promise<ProcessMealTextResult> => {
  const parsedMeal = await dependencies.mealParser.parseMeal(input);
  const normalizedMeal = dependencies.mealNormalizer.normalizeMeal(parsedMeal);
  const routeDecision = dependencies.sourceRouter.routeMeal(normalizedMeal);
  const itemResolutions = await Promise.all(
    routeDecision.items.map((decision) =>
      dependencies.resolutionExecutor.resolveRoutedItem(decision, options.matcher),
    ),
  );
  const computedItems = itemResolutions.map((resolution) => computeItemNutrition(resolution));
  const aggregatedMeal = aggregateMealNutrition(normalizedMeal, computedItems);

  let savedMeal = null;
  const shouldSave = options.saveMeal ?? dependencies.saveMeal ?? Boolean(dependencies.repository);
  if (shouldSave && dependencies.repository) {
    savedMeal = await dependencies.repository.saveMeal({
      input,
      parsedMeal,
      normalizedMeal,
      routeDecision,
      itemResolutions,
      computedItems,
      aggregatedMeal,
    });
  }

  return {
    input,
    parsedMeal,
    normalizedMeal,
    routeDecision,
    itemResolutions,
    computedItems,
    aggregatedMeal,
    savedMeal,
  };
};
