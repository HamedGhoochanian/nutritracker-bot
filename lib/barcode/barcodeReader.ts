import { readBarcodes } from "zxing-wasm/reader";
import type { ReadInputBarcodeFormat, ReadResult } from "zxing-wasm/reader";
import { logger } from "../logger";

const FOOD_BARCODE_FORMATS: ReadInputBarcodeFormat[] = [
  "EAN-13",
  "EAN-8",
  "UPC-A",
  "UPC-E",
  "DataBar",
  "DataBarExpanded",
  "DataBarLimited",
  "ITF",
  "Code128",
];

const isLikelyProductBarcode = (value: string): boolean => {
  return /^(\d{8}|\d{12}|\d{13}|\d{14})$/.test(value);
};

const pickBestBarcode = (results: ReadResult[]): string | null => {
  const texts = results
    .map((result) => result.text?.trim())
    .filter((text): text is string => Boolean(text));

  const numeric = texts.find(isLikelyProductBarcode);
  if (numeric) {
    return numeric;
  }

  return texts.at(0) ?? null;
};

export class BarcodeReader {
  async readFromImage(image: ArrayBuffer): Promise<string | null> {
    const prioritizedResults = await readBarcodes(image, {
      tryHarder: true,
      maxNumberOfSymbols: 8,
      formats: FOOD_BARCODE_FORMATS,
    });

    const results = prioritizedResults.length
      ? prioritizedResults
      : await readBarcodes(image, {
          tryHarder: true,
          maxNumberOfSymbols: 8,
        });

    const barcode = pickBestBarcode(results);

    if (!barcode) {
      logger.info({ event: "barcode.not_found" });
      return null;
    }

    const selected = results.find((result) => result.text?.trim() === barcode);
    logger.info({ event: "barcode.found", barcode, format: selected?.format });
    return barcode;
  }

  async readFromFile(filePath: string): Promise<string | null> {
    const fileBytes = await Bun.file(filePath).arrayBuffer();
    return this.readFromImage(fileBytes);
  }
}
