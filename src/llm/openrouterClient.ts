import axios from "axios";
import type { AxiosInstance, AxiosRequestConfig } from "axios";
import { z } from "zod";
import { logger } from "../logger";
import type { LlmClientPort } from "./client";
import type { LlmApiErrorOptions, LlmClientOptions } from "./types";

const DEFAULT_BASE_URL = "https://openrouter.ai/api";
const DEFAULT_MODEL = "openai/gpt-oss-120b";

const OpenRouterChoiceSchema = z.object({
  message: z.object({
    content: z.string(),
  }),
});

const OpenRouterResponseSchema = z.object({
  choices: z.tuple([OpenRouterChoiceSchema]).rest(OpenRouterChoiceSchema),
});

export class OpenRouterApiError extends Error {
  readonly status?: number;
  readonly url?: string;
  readonly payload?: unknown;

  constructor(options: LlmApiErrorOptions) {
    super(options.message);
    this.name = "OpenRouterApiError";
    this.status = options.status;
    this.url = options.url;
    this.payload = options.payload;
  }
}

export class OpenRouterClient implements LlmClientPort {
  private readonly http: AxiosInstance;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly retries: number;
  private readonly retryDelayMs: number;

  constructor(options: LlmClientOptions = {}) {
    let baseUrl = DEFAULT_BASE_URL;
    if (options.baseUrl !== undefined) {
      baseUrl = options.baseUrl;
    }

    let timeoutMs = 10000;
    if (options.timeoutMs !== undefined) {
      timeoutMs = options.timeoutMs;
    }

    let retries = 2;
    if (options.retries !== undefined) {
      retries = options.retries;
    }

    let retryDelayMs = 350;
    if (options.retryDelayMs !== undefined) {
      retryDelayMs = options.retryDelayMs;
    }

    this.http = axios.create({
      baseURL: baseUrl,
      timeout: timeoutMs,
    });

    let selectedModel = DEFAULT_MODEL;
    if (options.model !== undefined) {
      selectedModel = options.model;
    }

    this.model = selectedModel;
    this.retries = retries;
    this.retryDelayMs = retryDelayMs;

    const configuredApiKey = options.apiKey;
    if (configuredApiKey !== undefined) {
      this.apiKey = configuredApiKey;
      return;
    }

    const envApiKey = process.env.OPENROUTER_API_KEY;
    if (envApiKey === undefined) {
      throw new OpenRouterApiError({ message: "OpenRouter API key is required" });
    }

    this.apiKey = envApiKey;
  }

  async generateJson(prompt: string): Promise<unknown> {
    logger.debug({ event: "openrouter.generate_json.request", model: this.model });

    const response = await this.request<unknown>({
      method: "POST",
      url: "/v1/chat/completions",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
      data: {
        model: this.model,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      },
    });

    const parsedResponse = OpenRouterResponseSchema.parse(response);
    logger.debug({ event: "openrouter.generate_json.response", model: this.model });
    return JSON.parse(parsedResponse.choices[0].message.content) as unknown;
  }

  private async request<T>(config: AxiosRequestConfig, attempt = 0): Promise<T> {
    try {
      const response = await this.http.request<T>(config);
      return response.data;
    } catch (error: unknown) {
      if (!axios.isAxiosError(error)) {
        throw error;
      }

      const status = error.response?.status;
      const retriable = status === 429 || (status !== undefined && status >= 500);
      if (retriable && attempt < this.retries) {
        const delay = this.retryDelayMs * (attempt + 1);
        logger.warn({ event: "openrouter.http.retry", url: config.url, status, attempt, delay });
        await this.sleep(delay);
        return this.request<T>(config, attempt + 1);
      }

      throw new OpenRouterApiError({
        message: error.message,
        status,
        url: config.url,
        payload: error.response?.data,
      });
    }
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}
