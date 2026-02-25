import { describe, expect, it } from "@jest/globals";
import type { UserFromGetMe } from "grammy/types";
import { createBot } from "../../src/bot";

type SubmittedItem = {
  barcode: string;
  productName: string;
  nutritionFacts: {
    energyKcal100g?: number;
    proteins100g?: number;
    carbohydrates100g?: number;
    fat100g?: number;
    sugars100g?: number;
    fiber100g?: number;
    salt100g?: number;
    sodium100g?: number;
  };
  alias?: string;
  brand?: string;
  quantity?: string;
  chatId: number;
  userId?: number;
  username?: string;
  date: string;
};

const buildTextUpdate = (text: string, username = "allowed_user") => ({
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
    entities: text.startsWith("/")
      ? [{ offset: 0, length: (text.split(" ")[0] ?? text).length, type: "bot_command" as const }]
      : undefined,
  },
});

const buildPhotoUpdate = (username = "allowed_user") => ({
  update_id: 1,
  message: {
    message_id: 11,
    date: Math.floor(Date.now() / 1000),
    chat: { id: 123, type: "private" as const, first_name: "Test" },
    from: {
      id: 42,
      is_bot: false,
      first_name: "Test",
      username,
    },
    photo: [
      {
        file_id: "small-file",
        file_unique_id: "small-unique",
        width: 100,
        height: 100,
        file_size: 10,
      },
      {
        file_id: "large-file",
        file_unique_id: "large-unique",
        width: 300,
        height: 300,
        file_size: 20,
      },
    ],
  },
});

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
  it("handles /item_submit text barcode and alias", async () => {
    const submittedItems: SubmittedItem[] = [];
    const sentTexts: string[] = [];

    const repository = {
      saveProduct: async () => {},
      saveSubmittedItem: async (entry: SubmittedItem) => {
        submittedItems.push(entry);
      },
      listSubmittedItems: async () => submittedItems,
      deleteSubmittedItemByAliasOrBarcode: async () => null,
      findSubmittedItemByAlias: async () => null,
      updateSubmittedItemAtIndex: async () => {},
      logMessage: async () => {},
    };

    const offClient = {
      getProductNameById: async () => null,
      getProduct: async () => ({
        code: "737628064502",
        product_name: "Peanut Butter",
        brands: "Acme",
        quantity: "300 g",
        nutriments: {
          "energy-kcal_100g": 590,
          proteins_100g: 25,
          carbohydrates_100g: 20,
          fat_100g: 50,
        },
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
            message_id: 910,
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

    await bot.handleUpdate(buildTextUpdate("/item_submit") as unknown as BotUpdate);
    await bot.handleUpdate(buildTextUpdate("barcode 737628064502") as unknown as BotUpdate);
    await bot.handleUpdate(buildTextUpdate("my breakfast peanut") as unknown as BotUpdate);

    expect(submittedItems.length).toBe(1);
    expect(submittedItems[0]?.barcode).toBe("737628064502");
    expect(submittedItems[0]?.alias).toBe("my breakfast peanut");
    expect(submittedItems[0]?.nutritionFacts.energyKcal100g).toBe(590);
    expect(sentTexts.some((text) => text.includes("Submit started"))).toBe(true);
    expect(sentTexts.some((text) => text.includes("Found: Peanut Butter"))).toBe(true);
    expect(sentTexts.some((text) => text.includes("Saved Peanut Butter with alias"))).toBe(true);
  });

  it("handles /item_submit photo barcode and skip alias", async () => {
    const submittedItems: SubmittedItem[] = [];
    const sentTexts: string[] = [];

    const repository = {
      saveProduct: async () => {},
      saveSubmittedItem: async (entry: SubmittedItem) => {
        submittedItems.push(entry);
      },
      listSubmittedItems: async () => submittedItems,
      deleteSubmittedItemByAliasOrBarcode: async () => null,
      findSubmittedItemByAlias: async () => null,
      updateSubmittedItemAtIndex: async () => {},
      logMessage: async () => {},
    };

    const offClient = {
      getProductNameById: async () => null,
      getProduct: async () => ({
        code: "5060128612345",
        product_name: "Oat Bar",
        nutriments: {
          proteins_100g: 9,
          fat_100g: 12,
        },
      }),
    };

    const barcodeReader = {
      readFromImage: async () => "5060128612345",
    };

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      return {
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(10),
      } as Response;
    }) as unknown as typeof fetch;

    const bot = createBot({
      token: "TEST_TOKEN",
      targetUsername: "allowed_user",
      repository,
      offClient,
      barcodeReader,
    });
    setTestBotInfo(bot);

    bot.api.config.use(async (prev, method, payload) => {
      if (method === "sendMessage") {
        sentTexts.push(String((payload as { text?: string }).text ?? ""));
        return {
          ok: true,
          result: {
            message_id: 911,
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

      if (method === "getFile") {
        return {
          ok: true,
          result: {
            file_id: String((payload as { file_id: string }).file_id),
            file_unique_id: "uniq",
            file_path: "photos/barcode.jpg",
          },
        } as unknown as Awaited<ReturnType<typeof prev>>;
      }

      return prev(method, payload);
    });

    try {
      await bot.handleUpdate(buildTextUpdate("/item_submit") as unknown as BotUpdate);
      await bot.handleUpdate(buildPhotoUpdate() as unknown as BotUpdate);
      await bot.handleUpdate(buildTextUpdate("skip") as unknown as BotUpdate);
    } finally {
      globalThis.fetch = originalFetch;
    }

    expect(submittedItems.length).toBe(1);
    expect(submittedItems[0]?.barcode).toBe("5060128612345");
    expect(submittedItems[0]?.alias).toBeUndefined();
    expect(sentTexts.some((text) => text.includes("Saved Oat Bar without alias."))).toBe(true);
  });

  it("handles /item_list range and returns selected fields", async () => {
    const sentTexts: string[] = [];
    const listedItems: SubmittedItem[] = [
      {
        barcode: "1001",
        productName: "Item One",
        alias: "one",
        nutritionFacts: { proteins100g: 10, energyKcal100g: 100 },
        chatId: 123,
        date: new Date().toISOString(),
      },
      {
        barcode: "1002",
        productName: "Item Two",
        alias: "two",
        nutritionFacts: { proteins100g: 20, energyKcal100g: 200 },
        chatId: 123,
        date: new Date().toISOString(),
      },
      {
        barcode: "1003",
        productName: "Item Three",
        nutritionFacts: { proteins100g: 30, energyKcal100g: 300 },
        chatId: 123,
        date: new Date().toISOString(),
      },
    ];

    const repository = {
      saveProduct: async () => {},
      saveSubmittedItem: async () => {},
      listSubmittedItems: async () => listedItems,
      deleteSubmittedItemByAliasOrBarcode: async () => null,
      findSubmittedItemByAlias: async () => null,
      updateSubmittedItemAtIndex: async () => {},
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
            message_id: 912,
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

    await bot.handleUpdate(buildTextUpdate("/item_list 2-3") as unknown as BotUpdate);

    expect(sentTexts.length).toBe(1);
    expect(sentTexts[0]?.includes("barcode: 1002")).toBe(true);
    expect(sentTexts[0]?.includes("name: Item Two")).toBe(true);
    expect(sentTexts[0]?.includes("alias: two")).toBe(true);
    expect(sentTexts[0]?.includes("protein: 20")).toBe(true);
    expect(sentTexts[0]?.includes("calories: 200")).toBe(true);
    expect(sentTexts[0]?.includes("barcode: 1003")).toBe(true);
    expect(sentTexts[0]?.includes("barcode: 1001")).toBe(false);
  });

  it("uses default /item_list range of 1-10", async () => {
    const sentTexts: string[] = [];
    const listedItems: SubmittedItem[] = Array.from({ length: 12 }, (_, index) => ({
      barcode: `200${index + 1}`,
      productName: `Item ${index + 1}`,
      alias: `alias-${index + 1}`,
      nutritionFacts: {
        proteins100g: index + 1,
        energyKcal100g: (index + 1) * 10,
      },
      chatId: 123,
      date: new Date().toISOString(),
    }));

    const repository = {
      saveProduct: async () => {},
      saveSubmittedItem: async () => {},
      listSubmittedItems: async () => listedItems,
      deleteSubmittedItemByAliasOrBarcode: async () => null,
      findSubmittedItemByAlias: async () => null,
      updateSubmittedItemAtIndex: async () => {},
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
            message_id: 913,
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

    await bot.handleUpdate(buildTextUpdate("/item_list") as unknown as BotUpdate);

    expect(sentTexts.length).toBe(1);
    expect(sentTexts[0]?.includes("1. barcode: 2001")).toBe(true);
    expect(sentTexts[0]?.includes("10. barcode: 20010")).toBe(true);
    expect(sentTexts[0]?.includes("11. barcode: 20011")).toBe(false);
    expect(sentTexts[0]?.includes("12. barcode: 20012")).toBe(false);
  });

  it("handles /item_delete with alias-first matching", async () => {
    const sentTexts: string[] = [];
    const listedItems: SubmittedItem[] = [
      {
        barcode: "11111",
        productName: "Alias Match Item",
        alias: "22222",
        nutritionFacts: {},
        chatId: 123,
        date: new Date().toISOString(),
      },
      {
        barcode: "22222",
        productName: "Barcode Match Item",
        alias: "second",
        nutritionFacts: {},
        chatId: 123,
        date: new Date().toISOString(),
      },
    ];

    const repository = {
      saveProduct: async () => {},
      saveSubmittedItem: async () => {},
      listSubmittedItems: async () => listedItems,
      deleteSubmittedItemByAliasOrBarcode: async (query: string) => {
        const aliasIndex = listedItems.findIndex((item) => item.alias === query);
        const index =
          aliasIndex >= 0 ? aliasIndex : listedItems.findIndex((item) => item.barcode === query);
        if (index < 0) {
          return null;
        }
        const [deleted] = listedItems.splice(index, 1);
        return deleted ?? null;
      },
      findSubmittedItemByAlias: async () => null,
      updateSubmittedItemAtIndex: async () => {},
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
            message_id: 914,
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

    await bot.handleUpdate(buildTextUpdate("/item_delete 22222") as unknown as BotUpdate);

    expect(sentTexts.some((text) => text.includes("Deleted item: Alias Match Item"))).toBe(true);
    expect(listedItems.length).toBe(1);
    expect(listedItems[0]?.productName).toBe("Barcode Match Item");
  });

  it("handles /item_update with existing alias and replaces item", async () => {
    const sentTexts: string[] = [];
    const listedItems: SubmittedItem[] = [
      {
        barcode: "737628064502",
        productName: "Old Peanut Butter",
        alias: "breakfast",
        nutritionFacts: { energyKcal100g: 500, proteins100g: 20 },
        chatId: 123,
        date: new Date().toISOString(),
      },
    ];
    const savedItems: SubmittedItem[] = [];
    const updatedItems: Array<{ index: number; entry: SubmittedItem }> = [];

    const repository = {
      saveProduct: async () => {},
      saveSubmittedItem: async (entry: SubmittedItem) => {
        savedItems.push(entry);
      },
      listSubmittedItems: async () => listedItems,
      deleteSubmittedItemByAliasOrBarcode: async () => null,
      findSubmittedItemByAlias: async (alias: string) => {
        const index = listedItems.findIndex((item) => item.alias === alias);
        if (index < 0) {
          return null;
        }
        const item = listedItems[index];
        return item ? { item, index } : null;
      },
      updateSubmittedItemAtIndex: async (index: number, entry: SubmittedItem) => {
        listedItems[index] = entry;
        updatedItems.push({ index, entry });
      },
      logMessage: async () => {},
    };

    const offClient = {
      getProductNameById: async () => null,
      getProduct: async () => ({
        code: "5060128612345",
        product_name: "New Oat Bar",
        nutriments: {
          "energy-kcal_100g": 320,
          proteins_100g: 11,
        },
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
            message_id: 915,
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

    await bot.handleUpdate(buildTextUpdate("/item_update breakfast") as unknown as BotUpdate);
    await bot.handleUpdate(buildTextUpdate("barcode 5060128612345") as unknown as BotUpdate);
    await bot.handleUpdate(buildTextUpdate("updated-breakfast") as unknown as BotUpdate);

    expect(savedItems.length).toBe(0);
    expect(updatedItems.length).toBe(1);
    expect(updatedItems[0]?.index).toBe(0);
    expect(listedItems[0]?.productName).toBe("New Oat Bar");
    expect(listedItems[0]?.alias).toBe("updated-breakfast");
    expect(sentTexts.some((text) => text.includes("Updating Old Peanut Butter"))).toBe(true);
  });

  it("ends /item_update flow when alias does not exist", async () => {
    const sentTexts: string[] = [];

    const repository = {
      saveProduct: async () => {},
      saveSubmittedItem: async () => {},
      listSubmittedItems: async () => [],
      deleteSubmittedItemByAliasOrBarcode: async () => null,
      findSubmittedItemByAlias: async () => null,
      updateSubmittedItemAtIndex: async () => {},
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
            message_id: 916,
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

    await bot.handleUpdate(buildTextUpdate("/item_update unknown") as unknown as BotUpdate);
    await bot.handleUpdate(buildTextUpdate("barcode 5060128612345") as unknown as BotUpdate);

    expect(sentTexts.some((text) => text.includes("Alias not found."))).toBe(true);
    expect(sentTexts.some((text) => text.includes("Found:"))).toBe(false);
  });
});
