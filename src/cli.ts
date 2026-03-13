import { GeminiClient } from "./gemini";
import { parseMealText } from "./pipeline";

const main = async (): Promise<void> => {
  const args = process.argv.slice(2);
  const mealText = args.join(" ").trim();

  if (!mealText) {
    throw new Error('Usage: bun run src/cli.ts "<meal text>"');
  }

  const geminiClient = new GeminiClient();
  const parsedMeal = await parseMealText(mealText, geminiClient);
  process.stdout.write(`${JSON.stringify(parsedMeal, null, 2)}\n`);
};

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
