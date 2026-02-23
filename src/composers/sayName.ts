import { Composer } from "grammy";
import { logger } from "../../lib/logger";
import type { MyContext } from "../types/context";
import type { BotRepositoryLike, OpenFoodFactsClientLike } from "../types/dependencies";

type SayNameDeps = {
  repository: BotRepositoryLike;
  offClient: OpenFoodFactsClientLike;
};

export const createSayNameComposer = ({
  repository,
  offClient,
}: SayNameDeps): Composer<MyContext> => {
  const composer = new Composer<MyContext>();

  composer.command("say_name", async (ctx) => {
    const productId = ctx.match.trim();
    logger.info({
      event: "say_name.command_received",
      from: ctx.from?.username,
      chatId: ctx.chat.id,
      productId,
    });

    if (!productId) {
      logger.warn({ event: "say_name.missing_product_id" });
      await ctx.reply("Send a product id after the command, e.g. /say_name 737628064502");
      return;
    }

    try {
      logger.info({ event: "say_name.fetching_product", productId });
      const product = await offClient.getProduct(productId, [
        "code",
        "product_name",
        "product_name_en",
        "generic_name",
        "brands",
        "quantity",
      ]);

      const productName =
        (typeof product?.product_name === "string" && product.product_name) ||
        (typeof product?.product_name_en === "string" && product.product_name_en) ||
        (typeof product?.generic_name === "string" && product.generic_name) ||
        null;

      if (!productName) {
        logger.warn({
          event: "say_name.no_display_name",
          productId,
          code: product?.code,
        });
        await ctx.reply("Product not found for that product id.");
        return;
      }

      await repository.saveProduct({
        productId,
        productName,
        chatId: ctx.chat.id,
        userId: ctx.from?.id,
        username: ctx.from?.username,
        date: new Date().toISOString(),
      });
      logger.info({ event: "say_name.product_saved", productId, productName });

      const brandPart =
        typeof product?.brands === "string" && product.brands ? ` (${product.brands})` : "";
      await ctx.reply(`Product: ${productName}${brandPart}`);
    } catch (err) {
      logger.error({ event: "say_name.fetch_failed", productId, err });
      await ctx.reply("Could not fetch product for that product id.");
    }
  });

  return composer;
};
