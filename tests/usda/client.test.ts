import { describe, expect, it } from "@jest/globals";
import { AxiosError, AxiosHeaders } from "axios";
import { UsdaFoodApiError, UsdaFoodClient } from "../../src/usda/client";

type MockResponse<T> = { data: T };

const setMockRequest = <T>(
  client: UsdaFoodClient,
  impl: (config: {
    method?: string;
    url?: string;
    params?: unknown;
    data?: unknown;
  }) => Promise<MockResponse<T>>,
) => {
  (client as unknown as { http: { request: typeof impl } }).http = { request: impl };
};

describe("UsdaFoodClient", () => {
  it("returns null for empty fdc id", async () => {
    const client = new UsdaFoodClient({ apiKey: "test-key" });
    setMockRequest(client, async () => {
      throw new Error("request should not be called");
    });

    const food = await client.getFood("   ");
    expect(food).toBeNull();
  });

  it("gets a food by id and appends api key", async () => {
    const client = new UsdaFoodClient({ apiKey: "test-key" });

    setMockRequest(client, async (config) => {
      expect(config.method).toBe("GET");
      expect(config.url).toBe("/v1/food/534358");
      expect(config.params).toEqual({
        format: "abridged",
        nutrients: "203,204",
        api_key: "test-key",
      });
      return {
        data: {
          fdcId: 534358,
          dataType: "Branded",
          description: "NUT 'N BERRY MIX",
        },
      };
    });

    const food = await client.getFood("534358", { format: "abridged", nutrients: [203, 204] });
    expect(food?.description).toBe("NUT 'N BERRY MIX");
  });

  it("builds search params and joins arrays", async () => {
    const client = new UsdaFoodClient({ apiKey: "test-key" });

    setMockRequest(client, async (config) => {
      expect(config.method).toBe("POST");
      expect(config.url).toBe("/v1/foods/search");
      expect(config.params).toEqual({
        api_key: "test-key",
      });
      expect(config.data).toEqual({
        query: "cheddar cheese",
        dataType: ["Foundation", "SR Legacy"],
        pageNumber: 2,
      });
      return {
        data: {
          totalHits: 1,
          foods: [{ fdcId: 1, description: "CHEDDAR CHEESE", dataType: "Foundation" }],
        },
      };
    });

    const response = await client.searchFoods({
      query: " cheddar cheese ",
      dataType: ["Foundation", "SR Legacy"],
      pageNumber: 2,
    });

    expect(response.foods).toHaveLength(1);
    expect(response.foods?.[0]?.description).toBe("CHEDDAR CHEESE");
  });

  it("retries on 429 and succeeds", async () => {
    const client = new UsdaFoodClient({ apiKey: "test-key", retries: 1, retryDelayMs: 0 });
    let callCount = 0;

    setMockRequest(client, async () => {
      callCount += 1;
      if (callCount === 1) {
        throw new AxiosError("rate limited", "ERR_BAD_RESPONSE", undefined, undefined, {
          data: { error: "too many requests" },
          status: 429,
          statusText: "Too Many Requests",
          headers: {},
          config: { headers: new AxiosHeaders() },
        });
      }

      return {
        data: {
          fdcId: 747448,
          dataType: "Foundation",
          description: "Strawberries, raw",
        },
      };
    });

    const food = await client.getFood(747448);
    expect(callCount).toBe(2);
    expect(food?.description).toBe("Strawberries, raw");
  });

  it("throws when api key is missing", async () => {
    const client = new UsdaFoodClient({ retries: 0 });

    await expect(client.getFood(747448)).rejects.toBeInstanceOf(UsdaFoodApiError);
  });

  it("throws UsdaFoodApiError on non-retriable error", async () => {
    const client = new UsdaFoodClient({ apiKey: "test-key", retries: 0 });

    setMockRequest(client, async () => {
      throw new AxiosError("not found", "ERR_BAD_REQUEST", undefined, undefined, {
        data: { error: "no results found" },
        status: 404,
        statusText: "Not Found",
        headers: {},
        config: { headers: new AxiosHeaders() },
      });
    });

    await expect(client.getFood(0)).rejects.toBeInstanceOf(UsdaFoodApiError);
  });
});
