import { describe, expect, it } from "bun:test";
import type { UserFromGetMe } from "grammy/types";
import { createBot } from "../../src/bot";

type SavedProduct = {
  productId: string;
  productName: string;
  chatId: number;
  userId?: number;
  username?: string;
  date: string;
};

type LoggedMessage = {
  id: number;
  chatId: number;
  userId?: number;
  username?: string;
  firstName?: string;
  text?: string;
  caption?: string;
  date: string;
};

const buildMessageUpdate = (text: string, username = "allowed_user") => {
  const commandEntityLength = text.split(" ")[0]?.length ?? text.length;
  return {
    update_id: 1,
    message: {
      message_id: 10,
      date: Math.floor(Date.now() / 1000),
      chat: { id: 123, type: "private" as const, first_name: "Test" },
      from: {
        id: 42,
        is_bot: false,
        first_name: "Test",
        username,
      },
      text,
      entities: [{ offset: 0, length: commandEntityLength, type: "bot_command" as const }],
    },
  };
};

const setTestBotInfo = (bot: ReturnType<typeof createBot>) => {
  bot.botInfo = {
    id: 999999,
    is_bot: true,
    first_name: "NutriTrackerTest",
    username: "nutritracker_test_bot",
    can_join_groups: true,
    can_read_all_group_messages: false,
    supports_inline_queries: false,
  } as UserFromGetMe;
};

type BotUpdate = Parameters<ReturnType<typeof createBot>["handleUpdate"]>[0];

describe("bot command handlers", () => {
  it("handles /say_name success and saves product", async () => {
    const savedProducts: SavedProduct[] = [];
    const loggedMessages: LoggedMessage[] = [];
    const sentTexts: string[] = [];

    const repository = {
      saveProduct: async (entry: SavedProduct) => {
        savedProducts.push(entry);
      },
      logMessage: async (entry: LoggedMessage) => {
        loggedMessages.push(entry);
      },
    };

    const offClient = {
      getProductNameById: async () => null,
      getProduct: async () => ({
        code: "737628064502",
        product_name: "Peanut Butter",
        brands: "Acme",
      }),
    };

    const bot = createBot({
      token: "TEST_TOKEN",
      targetUsername: "allowed_user",
      repository,
      offClient,
    });
    setTestBotInfo(bot);

    bot.api.config.use(async (prev, method, payload) => {
      if (method === "sendMessage") {
        sentTexts.push(String((payload as { text?: string }).text ?? ""));
        return {
          ok: true,
          result: {
            message_id: 900,
            date: Math.floor(Date.now() / 1000),
            chat: {
              id: (payload as { chat_id: number }).chat_id,
              type: "private" as const,
              first_name: "Test",
            },
            text: String((payload as { text?: string }).text ?? ""),
          },
        } as unknown as Awaited<ReturnType<typeof prev>>;
      }
      return prev(method, payload);
    });

    await bot.handleUpdate(buildMessageUpdate("/say_name 737628064502") as unknown as BotUpdate);

    expect(savedProducts.length).toBe(1);
    expect(savedProducts[0]?.productId).toBe("737628064502");
    expect(savedProducts[0]?.productName).toBe("Peanut Butter");
    expect(sentTexts.some((text) => text.includes("Product: Peanut Butter (Acme)"))).toBeTrue();
    expect(loggedMessages.length).toBe(0);
  });

  it("handles /say_name with missing product id", async () => {
    const savedProducts: SavedProduct[] = [];
    const sentTexts: string[] = [];

    const repository = {
      saveProduct: async (entry: SavedProduct) => {
        savedProducts.push(entry);
      },
      logMessage: async () => {},
    };

    const offClient = {
      getProductNameById: async () => null,
      getProduct: async () => null,
    };

    const bot = createBot({
      token: "TEST_TOKEN",
      targetUsername: "allowed_user",
      repository,
      offClient,
    });
    setTestBotInfo(bot);

    bot.api.config.use(async (prev, method, payload) => {
      if (method === "sendMessage") {
        sentTexts.push(String((payload as { text?: string }).text ?? ""));
        return {
          ok: true,
          result: {
            message_id: 901,
            date: Math.floor(Date.now() / 1000),
            chat: {
              id: (payload as { chat_id: number }).chat_id,
              type: "private" as const,
              first_name: "Test",
            },
            text: String((payload as { text?: string }).text ?? ""),
          },
        } as unknown as Awaited<ReturnType<typeof prev>>;
      }
      return prev(method, payload);
    });

    await bot.handleUpdate(buildMessageUpdate("/say_name") as unknown as BotUpdate);

    expect(savedProducts.length).toBe(0);
    expect(
      sentTexts.some((text) => text.includes("Send a product id after the command")),
    ).toBeTrue();
  });

  it("blocks commands for non-target username", async () => {
    const savedProducts: SavedProduct[] = [];
    const sentTexts: string[] = [];

    const repository = {
      saveProduct: async (entry: SavedProduct) => {
        savedProducts.push(entry);
      },
      logMessage: async () => {},
    };

    const offClient = {
      getProductNameById: async () => null,
      getProduct: async () => ({ product_name: "Hidden" }),
    };

    const bot = createBot({
      token: "TEST_TOKEN",
      targetUsername: "allowed_user",
      repository,
      offClient,
    });
    setTestBotInfo(bot);

    bot.api.config.use(async (prev, method, payload) => {
      if (method === "sendMessage") {
        sentTexts.push(String((payload as { text?: string }).text ?? ""));
      }
      return prev(method, payload);
    });

    await bot.handleUpdate(
      buildMessageUpdate("/say_name 737628064502", "intruder") as unknown as BotUpdate,
    );

    expect(savedProducts.length).toBe(0);
    expect(sentTexts.length).toBe(0);
  });
});
