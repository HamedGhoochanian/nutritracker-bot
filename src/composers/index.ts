import { Composer } from "grammy";
import type { BarcodeReaderPort } from "../barcode/barcodeReader";
import type { OpenFoodFactsClientPort } from "../openfoodfacts/client";
import type { ItemRepositoryPort } from "../repositories";
import type { MyContext } from "../types/context";
import { createSubmitItemComposer } from "./itemManager";

type AllComposersDeps = {
  token: string;
  repository: ItemRepositoryPort;
  offClient: OpenFoodFactsClientPort;
  barcodeReader: BarcodeReaderPort;
};

export const createAllComposers = ({
  token,
  repository,
  offClient,
  barcodeReader,
}: AllComposersDeps): Composer<MyContext> => {
  const composer = new Composer<MyContext>();

  return composer.use(createSubmitItemComposer({ token, repository, offClient, barcodeReader }));
};
