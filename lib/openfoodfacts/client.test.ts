import { describe, expect, it } from "bun:test";
import { AxiosError, AxiosHeaders } from "axios";
import { OpenFoodFactsApiError, OpenFoodFactsClient } from "./client";

type MockResponse<T> = { data: T };

const setMockRequest = <T>(
  client: OpenFoodFactsClient,
  impl: (config: { url?: string; params?: unknown }) => Promise<MockResponse<T>>,
) => {
  (client as unknown as { http: { request: typeof impl } }).http = { request: impl };
};

describe("OpenFoodFactsClient", () => {
  it("returns null for empty product id", async () => {
    const client = new OpenFoodFactsClient();
    setMockRequest(client, async () => {
      throw new Error("request should not be called");
    });

    const product = await client.getProduct("   ");
    expect(product).toBeNull();
  });

  it("gets a product by id with fields", async () => {
    const client = new OpenFoodFactsClient();

    setMockRequest(client, async (config) => {
      expect(config.url).toBe("/api/v2/product/3017624010701.json");
      expect(config.params).toEqual({ fields: "product_name,brands" });
      return {
        data: {
          status: 1,
          product: { product_name: "Nutella", brands: "Ferrero" },
        },
      };
    });

    const product = await client.getProduct("3017624010701", ["product_name", "brands"]);
    expect(product?.product_name).toBe("Nutella");
    expect(product?.brands).toBe("Ferrero");
  });

  it("builds search query and joins fields", async () => {
    const client = new OpenFoodFactsClient();

    setMockRequest(client, async (config) => {
      expect(config.url).toBe("/api/v2/search");
      expect(config.params).toEqual({
        search_terms: "nutella",
        fields: "code,product_name",
        page: 1,
      });
      return { data: { products: [] } };
    });

    const response = await client.searchProducts({
      search_terms: "nutella",
      fields: ["code", "product_name"],
      page: 1,
    });

    expect(response.products).toEqual([]);
  });

  it("retries on 429 and succeeds", async () => {
    const client = new OpenFoodFactsClient({ retries: 1, retryDelayMs: 0 });
    let callCount = 0;

    setMockRequest(client, async () => {
      callCount += 1;
      if (callCount === 1) {
        throw new AxiosError("rate limited", "ERR_BAD_RESPONSE", undefined, undefined, {
          data: { status: 0 },
          status: 429,
          statusText: "Too Many Requests",
          headers: {},
          config: { headers: new AxiosHeaders() },
        });
      }

      return {
        data: {
          status: 1,
          product: { product_name: "Nutella" },
        },
      };
    });

    const product = await client.getProduct("3017624010701");
    expect(callCount).toBe(2);
    expect(product?.product_name).toBe("Nutella");
  });

  it("throws OpenFoodFactsApiError on non-retriable error", async () => {
    const client = new OpenFoodFactsClient({ retries: 0 });

    setMockRequest(client, async () => {
      throw new AxiosError("not found", "ERR_BAD_REQUEST", undefined, undefined, {
        data: { status: 0, status_verbose: "product not found" },
        status: 404,
        statusText: "Not Found",
        headers: {},
        config: { headers: new AxiosHeaders() },
      });
    });

    await expect(client.getProduct("0000")).rejects.toBeInstanceOf(OpenFoodFactsApiError);
  });
});
