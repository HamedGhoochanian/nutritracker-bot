import type { Context, MiddlewareFn } from "grammy";
import { logger } from "../lib/logger";

export const requireTargetUsername = (targetUsername: string): MiddlewareFn<Context> => {
  return async (ctx, next) => {
    const incomingUsername = ctx.from?.username;
    if (incomingUsername !== targetUsername) {
      logger.info({
        event: "auth.blocked",
        incomingUsername,
      });
      return;
    }

    logger.info({ event: "auth.accepted", incomingUsername });
    await next();
  };
};
