import axios from "axios";
import type { AxiosInstance, AxiosRequestConfig } from "axios";
import { Effect } from "effect";
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

  constructor(options: LlmClientOptions = {}) {
    let baseUrl = DEFAULT_BASE_URL;
    if (options.baseUrl !== undefined) {
      baseUrl = options.baseUrl;
    }

    let timeoutMs = 20000;
    if (options.timeoutMs !== undefined) {
      timeoutMs = options.timeoutMs;
    }

    let retries = 2;
    if (options.retries !== undefined) {
      retries = options.retries;
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
        provider: { sort: "latency" },
        response_format: { type: "json_object" },
      },
    });

    const parsedResponse = OpenRouterResponseSchema.parse(response);
    logger.debug({ event: "openrouter.generate_json.response", model: this.model });
    return JSON.parse(parsedResponse.choices[0].message.content) as unknown;
  }

  private async request<T>(config: AxiosRequestConfig): Promise<T> {
    let retryAttempt = 0;

    const requestEffect = Effect.tryPromise({
      try: async () => {
        const response = await this.http.request<T>(config);
        return response.data;
      },
      catch: (error) => {
        if (axios.isAxiosError(error)) {
          return new OpenRouterApiError({
            message: error.message,
            status: error.response?.status,
            url: config.url,
            payload: error.response?.data,
          });
        }

        if (error instanceof Error) {
          return new OpenRouterApiError({ message: error.message, url: config.url });
        }

        return new OpenRouterApiError({ message: String(error), url: config.url });
      },
    });

    const retriedEffect = Effect.retry(requestEffect, {
      times: this.retries,
      while: (error) => {
        const retriable =
          error.status === 429 || (error.status !== undefined && error.status >= 500);
        if (retriable) {
          logger.warn({
            event: "openrouter.http.retry",
            url: config.url,
            status: error.status,
            attempt: retryAttempt,
          });
          retryAttempt += 1;
        }
        return retriable;
      },
    });

    return Effect.runPromise(retriedEffect);
  }
}
