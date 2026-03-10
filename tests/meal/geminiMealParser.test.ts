import { describe, expect, it } from "@jest/globals";
import { GeminiMealParser, GeminiMealParserError } from "../../src/meal/geminiMealParser";

type MockResponse<T> = { data: T };

const setMockRequest = <T>(
  parser: GeminiMealParser,
  impl: (config: {
    method?: string;
    url?: string;
    params?: unknown;
    data?: unknown;
  }) => Promise<MockResponse<T>>,
) => {
  (parser as unknown as { http: { request: typeof impl } }).http = { request: impl };
};

describe("GeminiMealParser", () => {
  it("parses a multi-item meal and builds typed amounts", async () => {
    const parser = new GeminiMealParser({ apiKey: "test-key", model: "gemini-3.1-flash" });

    setMockRequest(parser, async (config) => {
      expect(config.method).toBe("POST");
      expect(config.url).toBe("/v1beta/models/gemini-3.1-flash:generateContent");
      expect(config.params).toEqual({ key: "test-key" });
      expect(config.data).toMatchObject({
        generationConfig: { responseMimeType: "application/json", temperature: 0.1 },
      });
      expect(JSON.stringify(config.data)).toContain("400ml of whole milk with a banana");

      return {
        data: {
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      items: [
                        {
                          rawText: "400ml of whole milk",
                          foodName: "milk",
                          quantity: 400,
                          unit: "ml",
                          preparation: "whole",
                          brand: null,
                          packagingHint: null,
                          isBrandedGuess: false,
                          confidence: 0.94,
                        },
                        {
                          rawText: "a banana",
                          foodName: "banana",
                          quantity: 1,
                          unit: "piece",
                          preparation: null,
                          brand: null,
                          packagingHint: null,
                          isBrandedGuess: false,
                          confidence: 0.99,
                        },
                      ],
                    }),
                  },
                ],
              },
            },
          ],
        },
      };
    });

    const meal = await parser.parseMeal("400ml of whole milk with a banana");

    expect(meal.parserModel).toBe("gemini-3.1-flash");
    expect(meal.items).toHaveLength(2);
    expect(meal.items[0]).toMatchObject({
      foodName: "milk",
      quantity: 400,
      unit: "ml",
      amount: { kind: "volume", value: 400, unit: "ml" },
      preparation: "whole",
    });
    expect(meal.items[1]).toMatchObject({
      foodName: "banana",
      quantity: 1,
      unit: "piece",
      amount: { kind: "count", value: 1, unit: "piece" },
    });
  });

  it("accepts JSON wrapped in markdown fences", async () => {
    const parser = new GeminiMealParser({ apiKey: "test-key" });

    setMockRequest(parser, async () => {
      return {
        data: {
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: '```json\n{"items":[{"rawText":"1 tbsp peanut butter","foodName":"peanut butter","quantity":1,"unit":"tbsp","preparation":null,"brand":null,"packagingHint":null,"isBrandedGuess":false,"confidence":0.95}]}\n```',
                  },
                ],
              },
            },
          ],
        },
      };
    });

    const meal = await parser.parseMeal("1 tbsp peanut butter");

    expect(meal.items[0]).toMatchObject({
      foodName: "peanut butter",
      unit: "tbsp",
      amount: { kind: "household", value: 1, unit: "tbsp" },
    });
  });

  it("returns an empty parse for blank input without calling Gemini", async () => {
    const parser = new GeminiMealParser();
    setMockRequest(parser, async () => {
      throw new Error("request should not be called");
    });

    const meal = await parser.parseMeal("   ");

    expect(meal.items).toEqual([]);
  });

  it("rejects invalid Gemini item payloads", async () => {
    const parser = new GeminiMealParser({ apiKey: "test-key" });

    setMockRequest(parser, async () => {
      return {
        data: {
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      items: [
                        {
                          rawText: "banana",
                          quantity: 1,
                          unit: "piece",
                          preparation: null,
                          brand: null,
                          packagingHint: null,
                          isBrandedGuess: false,
                          confidence: 0.9,
                        },
                      ],
                    }),
                  },
                ],
              },
            },
          ],
        },
      };
    });

    await expect(parser.parseMeal("banana")).rejects.toBeInstanceOf(GeminiMealParserError);
  });

  it("throws when the API key is missing", async () => {
    const parser = new GeminiMealParser({ apiKey: undefined });

    await expect(parser.parseMeal("1 apple")).rejects.toBeInstanceOf(GeminiMealParserError);
  });
});
