import type { Context, MiddlewareFn } from "grammy";
import { logger } from "../src/logger";

export const requireTargetUsername = <C extends Context>(
  targetUsername: string,
): MiddlewareFn<C> => {
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
