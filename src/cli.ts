import { OpenRouterClient } from "./llm";
import { MealPipeline } from "./pipeline";
import { OpenFoodFactsClient } from "./openfoodfacts";
import { BotRepository } from "./repositories";
import { UsdaFoodClient } from "./usda";

const main = async (): Promise<void> => {
  const args = process.argv.slice(2);
  const mealText = args.join(" ").trim();

  if (!mealText) {
    throw new Error('Usage: bun run src/cli.ts "<meal text>"');
  }

  const llmClient = new OpenRouterClient();
  const nutritionLlmClient = new OpenRouterClient({ model: "google/gemini-3-flash-preview" });
  const usdaClient = new UsdaFoodClient();
  const offClient = new OpenFoodFactsClient();
  let dbPath = "db.sqlite";
  if (process.env.DB_PATH !== undefined) {
    dbPath = process.env.DB_PATH;
  }
  const repository = await BotRepository.create(dbPath);
  const pipeline = new MealPipeline({
    llmClient,
    nutritionLlmClient,
    usdaClient,
    offClient,
    repository,
  });
  const result = await pipeline.run(mealText);

  process.stdout.write("RESULT_JSON_START\n");
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.stdout.write("RESULT_JSON_END\n");
};

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
