import { logger } from "./logger.ts";

export * from "./meal";
export * from "./matching";
export * from "./nutrition";
export * from "./openfoodfacts";
export * from "./pipeline";
export * from "./repositories";
export * from "./resolution";
export * from "./source-router";
export * from "./usda";
import { GeminiMealParser } from "./meal";

async function run() {
  const parser: GeminiMealParser = new GeminiMealParser();
  try {
    const results = await parser.parseMeal(
      "3 apples, one banana, one cup of whole milk, two teaspoons of pure peanut butter and one cooked chicken breast",
    );
    console.log(results.items);
  } catch (e) {
    logger.error(e);
  }
}

await run();
