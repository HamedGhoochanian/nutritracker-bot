import { Composer } from "grammy";
import type { MyContext } from "../types/context";
import type {
  BarcodeReaderLike,
  BotRepositoryLike,
  OpenFoodFactsClientLike,
} from "../types/dependencies";
import { createMessageLoggerComposer } from "./messageLogger";
import { createSubmitItemComposer } from "./itemManager";

type AllComposersDeps = {
  token: string;
  repository: BotRepositoryLike;
  offClient: OpenFoodFactsClientLike;
  barcodeReader: BarcodeReaderLike;
};

export const createAllComposers = ({
  token,
  repository,
  offClient,
  barcodeReader,
}: AllComposersDeps): Composer<MyContext> => {
  const composer = new Composer<MyContext>();

  composer.use(createSubmitItemComposer({ token, repository, offClient, barcodeReader }));
  composer.use(createMessageLoggerComposer({ repository }));

  return composer;
};
