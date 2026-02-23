import { Composer } from "grammy";
import { logger } from "../../lib/logger";
import type { LoggedMessage } from "../../lib/repositories/botRepository";
import type { MyContext } from "../types/context";
import type { BotRepositoryLike } from "../types/dependencies";

type MessageLoggerDeps = {
  repository: BotRepositoryLike;
};

export const createMessageLoggerComposer = ({
  repository,
}: MessageLoggerDeps): Composer<MyContext> => {
  const composer = new Composer<MyContext>();

  composer.on("message", async (ctx) => {
    logger.info({
      event: "message.received",
      messageId: ctx.message.message_id,
      from: ctx.from?.username,
      chatId: ctx.chat.id,
      hasText: "text" in ctx.message,
    });
    const entry: LoggedMessage = {
      id: ctx.message.message_id,
      chatId: ctx.chat.id,
      userId: ctx.from?.id,
      username: ctx.from?.username,
      firstName: ctx.from?.first_name,
      text: "text" in ctx.message ? ctx.message.text : undefined,
      caption: "caption" in ctx.message ? ctx.message.caption : undefined,
      date: new Date(ctx.message.date * 1000).toISOString(),
    };

    await repository.logMessage(entry);
    logger.info({ event: "message.logged", messageId: ctx.message.message_id });

    await ctx.reply("Logged.");
  });

  return composer;
};
