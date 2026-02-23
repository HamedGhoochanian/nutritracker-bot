import { Bot, session } from "grammy";
import path from "node:path";
import { BarcodeReader } from "../lib/barcode";
import { logger } from "../lib/logger";
import { OpenFoodFactsClient } from "../lib/openfoodfacts";
import { requireTargetUsername } from "../middleware/requireTargetUsername";
import { createAllComposers } from "./composers";
import type { MyContext } from "./types/context";
import type {
  BarcodeReaderLike,
  BotRepositoryLike,
  OpenFoodFactsClientLike,
} from "./types/dependencies";
import type { SessionData } from "./types/session";

export type CreateBotDeps = {
  token: string;
  targetUsername: string;
  repository: BotRepositoryLike;
  offClient?: OpenFoodFactsClientLike;
  barcodeReader?: BarcodeReaderLike;
  imageSaveDir?: string;
};

export const createBot = ({
  token,
  targetUsername,
  repository,
  offClient = new OpenFoodFactsClient({ baseUrl: "https://world.openfoodfacts.net" }),
  barcodeReader = new BarcodeReader(),
  imageSaveDir = path.resolve("downloads"),
}: CreateBotDeps): Bot<MyContext> => {
  const bot = new Bot<MyContext>(token);

  bot.use(
    session({
      initial: (): SessionData => ({}),
    }),
  );
  bot.use(requireTargetUsername(targetUsername));
  bot.use(createAllComposers({ token, imageSaveDir, repository, offClient, barcodeReader }));

  return bot;
};

export const startBot = async (bot: Bot<MyContext>): Promise<void> => {
  logger.info({ event: "bot.starting" });
  await bot.start();
  logger.info({ event: "bot.started" });
};
