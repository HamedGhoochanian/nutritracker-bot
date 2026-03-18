import axios from "axios";
import type { AxiosInstance, AxiosRequestConfig } from "axios";
import { Effect, Schedule } from "effect";
import { logger } from "../logger";
import type {
  OffEntityResponse,
  OffLang,
  OffProduct,
  OffProductResponse,
  OffSearchParams,
  OffSearchResponse,
  OpenFoodFactsApiErrorOptions,
  OpenFoodFactsClientOptions,
} from "./types";

const DEFAULT_BASE_URL = "https://world.openfoodfacts.net";
const DEFAULT_USER_AGENT = "NutriTrackerBot/1.0 (contact@example.com)";

export interface OpenFoodFactsClientPort {
  getProduct(
    productId: string,
    fields?: readonly string[],
  ): Promise<Record<string, unknown> | null>;
}

export class OpenFoodFactsApiError extends Error {
  readonly status?: number;
  readonly url?: string;
  readonly payload?: unknown;

  constructor(options: OpenFoodFactsApiErrorOptions) {
    super(options.message);
    this.name = "OpenFoodFactsApiError";
    this.status = options.status;
    this.url = options.url;
    this.payload = options.payload;
  }
}

export class OpenFoodFactsClient implements OpenFoodFactsClientPort {
  private readonly http: AxiosInstance;
  private readonly retries: number;
  private readonly retryDelayMs: number;

  constructor(options: OpenFoodFactsClientOptions = {}) {
    const {
      baseUrl = DEFAULT_BASE_URL,
      userAgent = DEFAULT_USER_AGENT,
      timeoutMs = 10000,
      retries = 2,
      retryDelayMs = 350,
    } = options;

    this.http = axios.create({
      baseURL: baseUrl,
      headers: {
        "User-Agent": userAgent,
      },
      timeout: timeoutMs,
    });

    this.retries = retries;
    this.retryDelayMs = retryDelayMs;
  }

  async getProduct(productId: string, fields?: readonly string[]): Promise<OffProduct | null> {
    const id = productId.trim();
    if (!id) {
      return null;
    }

    const params = fields?.length ? { fields: fields.join(",") } : undefined;
    logger.info({ event: "off.get_product.request", productId: id, fields });
    const data = await this.request<OffProductResponse>({
      method: "GET",
      url: `/api/v2/product/${encodeURIComponent(id)}.json`,
      params,
    });

    if (data.status === 0 || !data.product) {
      logger.info({ event: "off.get_product.not_found", productId: id, status: data.status });
      return null;
    }

    logger.info({ event: "off.get_product.success", productId: id, code: data.product.code });
    return data.product;
  }

  async getProductNameById(productId: string): Promise<string | null> {
    const product = await this.getProduct(productId, ["product_name", "generic_name"]);
    return product?.product_name || product?.generic_name || null;
  }

  async searchProducts(params: OffSearchParams = {}): Promise<OffSearchResponse> {
    const normalized: Record<string, string | number | boolean | undefined> = {};
    for (const [key, value] of Object.entries(params)) {
      if (Array.isArray(value)) {
        normalized[key] = value.join(",");
      } else {
        normalized[key] = value;
      }
    }
    if (params.fields && Array.isArray(params.fields)) {
      normalized.fields = params.fields.join(",");
    }

    return this.request<OffSearchResponse>({
      method: "GET",
      url: "/api/v2/search",
      params: normalized,
    });
  }

  async getProductsByBarcodePrefix(prefix: string): Promise<OffSearchResponse> {
    const value = prefix.trim();
    if (!value) {
      return { products: [] };
    }

    const fill = "x".repeat(Math.max(0, 13 - value.length));
    return this.request<OffSearchResponse>({
      method: "GET",
      url: `/code/${encodeURIComponent(`${value}${fill}`)}.json`,
    });
  }

  async getBrands(): Promise<OffEntityResponse> {
    return this.request<OffEntityResponse>({ method: "GET", url: "/brands.json" });
  }

  async getCategories(): Promise<OffEntityResponse> {
    return this.request<OffEntityResponse>({ method: "GET", url: "/categories.json" });
  }

  async getCountries(): Promise<OffEntityResponse> {
    return this.request<OffEntityResponse>({ method: "GET", url: "/countries.json" });
  }

  async getLabels(): Promise<OffEntityResponse> {
    return this.request<OffEntityResponse>({ method: "GET", url: "/labels.json" });
  }

  async getAdditives(): Promise<OffEntityResponse> {
    return this.request<OffEntityResponse>({ method: "GET", url: "/additives.json" });
  }

  async getAllergens(): Promise<OffEntityResponse> {
    return this.request<OffEntityResponse>({ method: "GET", url: "/allergens.json" });
  }

  async getIngredients(): Promise<OffEntityResponse> {
    return this.request<OffEntityResponse>({ method: "GET", url: "/ingredients.json" });
  }

  forCountry(country: OffLang): OpenFoodFactsClient {
    return new OpenFoodFactsClient({
      baseUrl: `https://${country}.openfoodfacts.org`,
      userAgent: this.http.defaults.headers["User-Agent"] as string,
      timeoutMs: this.http.defaults.timeout,
      retries: this.retries,
      retryDelayMs: this.retryDelayMs,
    });
  }

  private async request<T>(config: AxiosRequestConfig): Promise<T> {
    let attempt = 0;

    const requestEffect = Effect.tryPromise({
      try: async () => {
        logger.debug({ event: "off.http.request", url: config.url, attempt });
        const response = await this.http.request<T>(config);
        logger.debug({ event: "off.http.response", url: config.url, status: response.status });
        return response.data;
      },
      catch: (error) => {
        if (axios.isAxiosError(error)) {
          return new OpenFoodFactsApiError({
            message: error.message,
            status: error.response?.status,
            url: config.url,
            payload: error.response?.data,
          });
        }

        if (error instanceof Error) {
          return new OpenFoodFactsApiError({ message: error.message, url: config.url });
        }

        return new OpenFoodFactsApiError({ message: String(error), url: config.url });
      },
    });

    const retriedEffect = Effect.retry(requestEffect, {
      times: this.retries,
      schedule: Schedule.fixed(`${this.retryDelayMs} millis`),
      while: (error) => {
        const retriable =
          error.status === 429 || (error.status !== undefined && error.status >= 500);
        if (retriable) {
          logger.warn({
            event: "off.http.retry",
            url: config.url,
            status: error.status,
            attempt,
          });
          attempt += 1;
        }
        return retriable;
      },
    });

    const result = await Effect.runPromise(Effect.either(retriedEffect));
    if (result._tag === "Right") {
      return result.right;
    }

    logger.error({ event: "off.http.failed", url: config.url, status: result.left.status });
    throw result.left;
  }
}
