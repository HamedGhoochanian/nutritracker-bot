import { Composer } from "grammy";
import type { MyContext } from "../types/context";
import type {
  BarcodeReaderLike,
  BotRepositoryLike,
  OpenFoodFactsClientLike,
} from "../types/dependencies";
import { createMessageLoggerComposer } from "./messageLogger";
import { createPicSaveComposer } from "./picSave";
import { createSayNameComposer } from "./sayName";

type AllComposersDeps = {
  token: string;
  imageSaveDir: string;
  repository: BotRepositoryLike;
  offClient: OpenFoodFactsClientLike;
  barcodeReader: BarcodeReaderLike;
};

export const createAllComposers = ({
  token,
  imageSaveDir,
  repository,
  offClient,
  barcodeReader,
}: AllComposersDeps): Composer<MyContext> => {
  const composer = new Composer<MyContext>();

  composer.use(
    createPicSaveComposer({ token, imageSaveDir, repository, offClient, barcodeReader }),
  );
  composer.use(createSayNameComposer({ repository, offClient }));
  composer.use(createMessageLoggerComposer({ repository }));

  return composer;
};
