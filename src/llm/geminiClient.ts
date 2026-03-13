import axios from "axios";
import type { AxiosInstance, AxiosRequestConfig } from "axios";
import { z } from "zod";
import { logger } from "../logger";
import type { LlmClientPort } from "./client";
import type { LlmApiErrorOptions, LlmClientOptions } from "./types";

const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com";
const DEFAULT_MODEL = "gemini-3-flash-preview";

const GeminiTextPartSchema = z.object({
  text: z.string(),
});

const GeminiContentSchema = z.object({
  parts: z.tuple([GeminiTextPartSchema]).rest(GeminiTextPartSchema),
});

const GeminiCandidateSchema = z.object({
  content: GeminiContentSchema,
});

const GeminiGenerateContentResponseSchema = z.object({
  candidates: z.tuple([GeminiCandidateSchema]).rest(GeminiCandidateSchema),
});

export class GeminiApiError extends Error {
  readonly status?: number;
  readonly url?: string;
  readonly payload?: unknown;

  constructor(options: LlmApiErrorOptions) {
    super(options.message);
    this.name = "GeminiApiError";
    this.status = options.status;
    this.url = options.url;
    this.payload = options.payload;
  }
}

export class GeminiClient implements LlmClientPort {
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

    const envApiKey = process.env.GEMINI_API_KEY;
    if (envApiKey === undefined) {
      throw new GeminiApiError({ message: "Gemini API key is required" });
    }

    this.apiKey = envApiKey;
  }

  async generateJson(prompt: string): Promise<unknown> {
    logger.debug({ event: "gemini.generate_json.request", model: this.model });

    const response = await this.request<unknown>({
      method: "POST",
      url: `/v1beta/models/${encodeURIComponent(this.model)}:generateContent`,
      params: { key: this.apiKey },
      data: {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
        },
      },
    });

    const parsedResponse = GeminiGenerateContentResponseSchema.parse(response);
    const firstCandidate = parsedResponse.candidates[0];
    const firstPart = firstCandidate.content.parts[0];
    logger.debug({ event: "gemini.generate_json.response", model: this.model });
    return JSON.parse(firstPart.text) as unknown;
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
        logger.warn({ event: "gemini.http.retry", url: config.url, status, attempt, delay });
        await this.sleep(delay);
        return this.request<T>(config, attempt + 1);
      }

      throw new GeminiApiError({
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
