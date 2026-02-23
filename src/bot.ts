import { Bot, session } from "grammy";
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
import { initialSessionData } from "./types/session";

export type CreateBotDeps = {
  token: string;
  targetUsername: string;
  repository: BotRepositoryLike;
  offClient?: OpenFoodFactsClientLike;
  barcodeReader?: BarcodeReaderLike;
};

export const createBot = ({
  token,
  targetUsername,
  repository,
  offClient = new OpenFoodFactsClient({ baseUrl: "https://world.openfoodfacts.net" }),
  barcodeReader = new BarcodeReader(),
}: CreateBotDeps): Bot<MyContext> => {
  const bot = new Bot<MyContext>(token);

  bot.use(
    session({
      initial: initialSessionData,
    }),
  );
  bot.use(requireTargetUsername(targetUsername));
  bot.use(createAllComposers({ token, repository, offClient, barcodeReader }));

  return bot;
};

export const startBot = async (bot: Bot<MyContext>): Promise<void> => {
  logger.info({ event: "bot.starting" });
  await bot.start();
  logger.info({ event: "bot.started" });
};
