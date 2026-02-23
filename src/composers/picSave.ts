import { Composer } from "grammy";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { logger } from "../../lib/logger";
import type { MyContext } from "../types/context";
import type {
  BarcodeReaderLike,
  BotRepositoryLike,
  OpenFoodFactsClientLike,
} from "../types/dependencies";

type PicSaveDeps = {
  token: string;
  imageSaveDir: string;
  repository: BotRepositoryLike;
  offClient: OpenFoodFactsClientLike;
  barcodeReader: BarcodeReaderLike;
};

export const createPicSaveComposer = ({
  token,
  imageSaveDir,
  repository,
  offClient,
  barcodeReader,
}: PicSaveDeps): Composer<MyContext> => {
  const composer = new Composer<MyContext>();

  composer.hears(/^pic_save\b/i, async (ctx) => {
    const message = ctx.message;
    if (!message || !("photo" in message)) {
      await ctx.reply("Send an image with caption starting with pic_save.");
      return;
    }

    const photos = "photo" in message ? message.photo : undefined;
    const biggestPhoto = photos?.at(-1);
    if (!biggestPhoto) {
      await ctx.reply("No photo found in this message.");
      return;
    }

    try {
      logger.info({
        event: "pic_save.download_started",
        fileId: biggestPhoto.file_id,
        timestamp: new Date().toISOString(),
      });
      await mkdir(imageSaveDir, { recursive: true });
      const file = await ctx.api.getFile(biggestPhoto.file_id);
      const filePath = file.file_path;

      if (!filePath) {
        await ctx.reply("Could not resolve file path for this image.");
        return;
      }

      const fileUrl = `https://api.telegram.org/file/bot${token}/${filePath}`;
      const res = await fetch(fileUrl);
      if (!res.ok) {
        throw new Error(`Telegram file download failed with ${res.status}`);
      }

      const fileBytes = await res.arrayBuffer();
      const barcode = await barcodeReader.readFromImage(fileBytes);

      if (barcode) {
        logger.info({ event: "pic_save.barcode_detected", barcode });
        const productName = await offClient.getProductNameById(barcode);
        if (productName) {
          await repository.saveProduct({
            productId: barcode,
            productName,
            chatId: ctx.chat.id,
            userId: ctx.from?.id,
            username: ctx.from?.username,
            date: new Date().toISOString(),
          });
          await ctx.reply(`Detected barcode: ${barcode}\nProduct: ${productName}`);
        } else {
          await ctx.reply(`Detected barcode: ${barcode}, but product was not found.`);
        }
      } else {
        await ctx.reply("No barcode detected in this image.");
      }

      const extension = path.extname(filePath) || ".jpg";
      const localFileName = `photo_${message.message_id}_${Date.now()}${extension}`;
      const localPath = path.join(imageSaveDir, localFileName);
      await Bun.write(localPath, fileBytes);

      logger.info({ event: "pic_save.download_completed", localPath });
      await ctx.reply(`Saved image to ${localPath}`);
    } catch (err) {
      logger.error({ event: "pic_save.download_failed", err });
      await ctx.reply("Failed to download and save this image.");
    }
  });

  return composer;
};
