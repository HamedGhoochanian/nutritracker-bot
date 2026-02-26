import { Bot, session } from "grammy";
import { BarcodeReader } from "./barcode";
import type { BarcodeReaderPort } from "./barcode/barcodeReader";
import { logger } from "./logger";
import { OpenFoodFactsClient } from "./openfoodfacts";
import type { OpenFoodFactsClientPort } from "./openfoodfacts/client";
import type { BotRepositoryPort } from "./repositories";
import { requireTargetUsername } from "../middleware/requireTargetUsername";
import { createAllComposers } from "./composers";
import type { MyContext } from "./types/context";
import { initialSessionData } from "./types/session";

export type CreateBotDeps = {
  token: string;
  targetUsername: string;
  repository: BotRepositoryPort;
  offClient?: OpenFoodFactsClientPort;
  barcodeReader?: BarcodeReaderPort;
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
