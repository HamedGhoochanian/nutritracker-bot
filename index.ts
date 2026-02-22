import { logger } from "./lib/logger";
import { BotRepository } from "./lib/repositories/botRepository";
import { createBot } from "./bot";

const token = process.env.BOT_TOKEN;
const targetUsername = process.env.TARGET_USERNAME?.replace(/^@/, "");

if (!token) {
  throw new Error("BOT_TOKEN is not set. Add it to your .env file.");
}

if (!targetUsername) {
  throw new Error("TARGET_USERNAME is not set. Add it to your .env file.");
}

const repository = await BotRepository.create("db.json");
const bot = createBot({ token, targetUsername, repository });

logger.info({ event: "bot.starting" });
await bot.start();
logger.info({ event: "bot.started" });
