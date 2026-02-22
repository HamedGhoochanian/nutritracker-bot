import { describe, expect, it } from "bun:test";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { BarcodeReader } from "../../lib/barcode";

const fixturesDir = path.resolve("tests/fixtures/barcodes");
const supportedExt = new Set([".jpg", ".jpeg", ".png", ".webp", ".bmp", ".gif"]);

const fixtureFiles = existsSync(fixturesDir)
  ? readdirSync(fixturesDir)
      .filter((name) => supportedExt.has(path.extname(name).toLowerCase()))
      .sort()
  : [];

describe("BarcodeReader fixture dataset", () => {
  const reader = new BarcodeReader();

  if (fixtureFiles.length === 0) {
    it("is ready for fixture images", () => {
      expect(true).toBe(true);
    });
    return;
  }

  for (const fileName of fixtureFiles) {
    it(`reads barcode from ${fileName}`, async () => {
      const filePath = path.join(fixturesDir, fileName);
      const expectedBarcode = path.parse(fileName).name;

      const detectedBarcode = await reader.readFromFile(filePath);
      expect(detectedBarcode).toBe(expectedBarcode);
    });
  }
});
