import axios from "axios";
import type { AxiosInstance, AxiosRequestConfig } from "axios";
import { logger } from "../logger";
import type {
  UsdaFoodApiErrorOptions,
  UsdaFoodClientOptions,
  UsdaFoodItem,
  UsdaFoodsCriteria,
  UsdaFoodListCriteria,
  UsdaFoodSearchCriteria,
  UsdaGetFoodOptions,
  UsdaSearchResult,
} from "./types";

const DEFAULT_BASE_URL = "https://api.nal.usda.gov/fdc";
const DEFAULT_USER_AGENT = "NutriTrackerBot/1.0 (contact@example.com)";

type UsdaQueryValue = string | number | boolean | ReadonlyArray<string | number> | undefined;

export interface UsdaFoodClientPort {
  getFood(fdcId: string | number, options?: UsdaGetFoodOptions): Promise<UsdaFoodItem | null>;
}

export class UsdaFoodApiError extends Error {
  readonly status?: number;
  readonly url?: string;
  readonly payload?: unknown;

  constructor(options: UsdaFoodApiErrorOptions) {
    super(options.message);
    this.name = "UsdaFoodApiError";
    this.status = options.status;
    this.url = options.url;
    this.payload = options.payload;
  }
}

export class UsdaFoodClient implements UsdaFoodClientPort {
  private readonly http: AxiosInstance;
  private readonly apiKey?: string;
  private readonly retries: number;
  private readonly retryDelayMs: number;

  constructor(options: UsdaFoodClientOptions = {}) {
    const {
      apiKey = process.env.USDA_FOODDATA_CENTRAL_API_KEY || process.env.USDA_API_KEY,
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

    this.apiKey = apiKey;
    this.retries = retries;
    this.retryDelayMs = retryDelayMs;
  }

  async getFood(
    fdcId: string | number,
    options: UsdaGetFoodOptions = {},
  ): Promise<UsdaFoodItem | null> {
    const id = String(fdcId).trim();
    if (!id) {
      return null;
    }

    logger.info({ event: "usda.get_food.request", fdcId: id, options });
    const food = await this.request<UsdaFoodItem>({
      method: "GET",
      url: `/v1/food/${encodeURIComponent(id)}`,
      params: this.normalizeQueryParams(options),
    });

    logger.info({ event: "usda.get_food.success", fdcId: id, dataType: food.dataType });
    return food;
  }

  async getFoodDescriptionById(fdcId: string | number): Promise<string | null> {
    const food = await this.getFood(fdcId, { format: "abridged" });
    return food?.description || null;
  }

  async getFoods(criteria: UsdaFoodsCriteria): Promise<UsdaFoodItem[]> {
    return this.request<UsdaFoodItem[]>({
      method: "GET",
      url: "/v1/foods",
      params: this.normalizeQueryParams(criteria),
    });
  }

  async getFoodsByCriteria(criteria: UsdaFoodsCriteria): Promise<UsdaFoodItem[]> {
    return this.request<UsdaFoodItem[]>({
      method: "POST",
      url: "/v1/foods",
      data: criteria,
    });
  }

  async listFoods(criteria: UsdaFoodListCriteria = {}): Promise<UsdaFoodItem[]> {
    return this.request<UsdaFoodItem[]>({
      method: "GET",
      url: "/v1/foods/list",
      params: this.normalizeQueryParams(criteria),
    });
  }

  async listFoodsByCriteria(criteria: UsdaFoodListCriteria): Promise<UsdaFoodItem[]> {
    return this.request<UsdaFoodItem[]>({
      method: "POST",
      url: "/v1/foods/list",
      data: criteria,
    });
  }

  async searchFoods(criteria: UsdaFoodSearchCriteria): Promise<UsdaSearchResult> {
    const query = criteria.query.trim();
    if (!query) {
      return { foods: [], currentPage: 0, totalHits: 0, totalPages: 0 };
    }

    return this.request<UsdaSearchResult>({
      method: "GET",
      url: "/v1/foods/search",
      params: this.normalizeQueryParams({ ...criteria, query }),
    });
  }

  async searchFoodsByCriteria(criteria: UsdaFoodSearchCriteria): Promise<UsdaSearchResult> {
    const query = criteria.query.trim();
    if (!query) {
      return { foods: [], currentPage: 0, totalHits: 0, totalPages: 0 };
    }

    return this.request<UsdaSearchResult>({
      method: "POST",
      url: "/v1/foods/search",
      data: { ...criteria, query },
    });
  }

  private async request<T>(config: AxiosRequestConfig, attempt = 0): Promise<T> {
    const apiKey = this.requireApiKey(config.url);

    try {
      logger.debug({ event: "usda.http.request", url: config.url, attempt });
      const response = await this.http.request<T>({
        ...config,
        params: {
          ...(config.params as Record<string, unknown> | undefined),
          api_key: apiKey,
        },
      });
      logger.debug({ event: "usda.http.response", url: config.url, status: response.status });
      return response.data;
    } catch (error: unknown) {
      if (!axios.isAxiosError(error)) {
        throw error;
      }

      const status = error.response?.status;
      const retriable = status === 429 || (status !== undefined && status >= 500);
      if (retriable && attempt < this.retries) {
        const delay = this.retryDelayMs * (attempt + 1);
        logger.warn({ event: "usda.http.retry", url: config.url, status, attempt, delay });
        await this.sleep(delay);
        return this.request<T>(config, attempt + 1);
      }

      logger.error({ event: "usda.http.failed", url: config.url, status });
      throw new UsdaFoodApiError({
        message: error.message || "USDA FoodData Central request failed",
        status,
        url: config.url,
        payload: error.response?.data,
      });
    }
  }

  private normalizeQueryParams(
    params: Record<string, UsdaQueryValue>,
  ): Record<string, string | number | boolean> {
    const normalized: Record<string, string | number | boolean> = {};

    for (const [key, value] of Object.entries(params)) {
      if (value === undefined) {
        continue;
      }

      if (Array.isArray(value)) {
        if (value.length > 0) {
          normalized[key] = value.join(",");
        }
        continue;
      }

      if (typeof value === "string") {
        const trimmed = value.trim();
        if (trimmed) {
          normalized[key] = trimmed;
        }
        continue;
      }

      normalized[key] = value as string | number | boolean;
    }

    return normalized;
  }

  private requireApiKey(url?: string): string {
    if (this.apiKey) {
      return this.apiKey;
    }

    throw new UsdaFoodApiError({
      message: "USDA API key is required",
      url,
    });
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}
