import type { MyContext } from "../types/context";

export const getMessageText = (ctx: MyContext): string => {
  const message = ctx.message;
  if (!message) {
    return "";
  }

  if ("text" in message && typeof message.text === "string") {
    return message.text;
  }

  if ("caption" in message && typeof message.caption === "string") {
    return message.caption;
  }

  return "";
};
