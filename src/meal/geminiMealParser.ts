import axios from "axios";
import type { AxiosInstance, AxiosRequestConfig } from "axios";
import { logger } from "../logger";
import {
  COUNT_UNITS,
  HOUSEHOLD_UNITS,
  MASS_UNITS,
  VOLUME_UNITS,
  type MealParserOptions,
  type ParsedAmount,
  type ParsedMeal,
  type ParsedMealItem,
  type ParsedUnit,
} from "./types";

const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com";
const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-3.1-flash";
const DEFAULT_USER_AGENT = "NutriTrackerBot/1.0 (contact@example.com)";
const DEFAULT_TIMEOUT_MS = 30_000;

const UNIT_ALIASES: Record<string, ParsedUnit> = {
  g: "g",
  gram: "g",
  grams: "g",
  kg: "kg",
  kilogram: "kg",
  kilograms: "kg",
  oz: "oz",
  ounce: "oz",
  ounces: "oz",
  lb: "lb",
  lbs: "lb",
  pound: "lb",
  pounds: "lb",
  ml: "ml",
  milliliter: "ml",
  milliliters: "ml",
  millilitre: "ml",
  millilitres: "ml",
  l: "l",
  liter: "l",
  liters: "l",
  litre: "l",
  litres: "l",
  "fl oz": "fl oz",
  floz: "fl oz",
  "fluid ounce": "fl oz",
  "fluid ounces": "fl oz",
  tsp: "tsp",
  teaspoon: "tsp",
  teaspoons: "tsp",
  tbsp: "tbsp",
  tablespoon: "tbsp",
  tablespoons: "tbsp",
  cup: "cup",
  cups: "cup",
  piece: "piece",
  pieces: "piece",
  whole: "piece",
  slice: "slice",
  slices: "slice",
  serving: "serving",
  servings: "serving",
  can: "can",
  cans: "can",
  bottle: "bottle",
  bottles: "bottle",
  packet: "packet",
  packets: "packet",
  pack: "packet",
  packs: "packet",
  bar: "bar",
  bars: "bar",
  container: "container",
  containers: "container",
  jar: "jar",
  jars: "jar",
  clove: "clove",
  cloves: "clove",
  unknown: "unknown",
};

type GeminiCandidate = {
  content?: {
    parts?: Array<{
      text?: string;
    }>;
  };
};

type GeminiGenerateContentResponse = {
  candidates?: GeminiCandidate[];
};

type GeminiParsedMealItemPayload = {
  rawText?: unknown;
  foodName?: unknown;
  quantity?: unknown;
  unit?: unknown;
  preparation?: unknown;
  brand?: unknown;
  packagingHint?: unknown;
  isBrandedGuess?: unknown;
  confidence?: unknown;
};

type GeminiParsedMealPayload = {
  items?: unknown;
};

export type GeminiMealParserOptions = MealParserOptions & {
  baseUrl?: string;
  retries?: number;
  retryDelayMs?: number;
  userAgent?: string;
};

export type GeminiMealParserErrorOptions = {
  message: string;
  status?: number;
  url?: string;
  payload?: unknown;
};

export class GeminiMealParserError extends Error {
  readonly status?: number;
  readonly url?: string;
  readonly payload?: unknown;

  constructor(options: GeminiMealParserErrorOptions) {
    super(options.message);
    this.name = "GeminiMealParserError";
    this.status = options.status;
    this.url = options.url;
    this.payload = options.payload;
  }
}

export class GeminiMealParser {
  private readonly http: AxiosInstance;
  private readonly apiKey?: string;
  private readonly model: string;
  private readonly retries: number;
  private readonly retryDelayMs: number;

  constructor(options: GeminiMealParserOptions = {}) {
    const {
      apiKey = process.env.GEMINI_API_KEY,
      model = DEFAULT_MODEL,
      baseUrl = DEFAULT_BASE_URL,
      userAgent = DEFAULT_USER_AGENT,
      timeoutMs = DEFAULT_TIMEOUT_MS,
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
    this.model = model;
    this.retries = retries;
    this.retryDelayMs = retryDelayMs;
  }

  async parseMeal(input: string): Promise<ParsedMeal> {
    const trimmedInput = input.trim();
    if (!trimmedInput) {
      return {
        rawInput: input,
        items: [],
        parserModel: this.model,
      };
    }

    logger.info({ event: "gemini.parse_meal.request", model: this.model, input: trimmedInput });
    const response = await this.request<GeminiGenerateContentResponse>({
      method: "POST",
      url: `/v1beta/models/${encodeURIComponent(this.model)}:generateContent`,
      data: {
        contents: [
          {
            role: "user",
            parts: [{ text: buildGeminiMealParserPrompt(trimmedInput) }],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json",
        },
      },
    });

    const text = extractResponseText(response);
    const payload = parseGeminiMealPayload(text);
    const items = payload.items.map(normalizeParsedMealItem);

    logger.info({ event: "gemini.parse_meal.success", model: this.model, itemCount: items.length });
    return {
      rawInput: input,
      items,
      parserModel: this.model,
    };
  }

  private async request<T>(config: AxiosRequestConfig, attempt = 0): Promise<T> {
    const apiKey = this.requireApiKey(config.url);

    try {
      logger.debug({ event: "gemini.http.request", url: config.url, attempt, model: this.model });
      const response = await this.http.request<T>({
        ...config,
        params: {
          ...(config.params as Record<string, unknown> | undefined),
          key: apiKey,
        },
      });
      logger.debug({ event: "gemini.http.response", url: config.url, status: response.status });
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

      logger.error({ event: "gemini.http.failed", url: config.url, status });
      throw new GeminiMealParserError({
        message: error.message || "Gemini request failed",
        status,
        url: config.url,
        payload: error.response?.data,
      });
    }
  }

  private requireApiKey(url?: string): string {
    if (this.apiKey) {
      return this.apiKey;
    }

    throw new GeminiMealParserError({
      message: "Gemini API key is required",
      url,
    });
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}

export const buildGeminiMealParserPrompt = (input: string): string => {
  return [
    "You extract food items from natural-language meal descriptions.",
    'Return JSON only with this shape: {"items":[{...}] }.',
    "Each item must use these exact keys: rawText, foodName, quantity, unit, preparation, brand, packagingHint, isBrandedGuess, confidence.",
    "Use null for unknown quantity, preparation, brand, or packagingHint.",
    "Use one of these units only: g, kg, oz, lb, ml, l, fl oz, tsp, tbsp, cup, piece, slice, serving, can, bottle, packet, bar, container, jar, clove, unknown.",
    "Split distinct foods into separate items.",
    "Preserve the user's quantity and unit instead of converting to grams or milliliters unless the user already used those units.",
    "Infer unit piece only for obvious countable foods like banana or egg when the user gives a count without a unit.",
    "Capture preparation when explicit, such as whole, skimmed, grilled, fried, cooked, or boiled.",
    "Set brand only if the user clearly names one.",
    "Set packagingHint for wording like bottle, can, packet, jar, tub, or bar when it helps later product matching.",
    "Set isBrandedGuess to true only when the wording strongly suggests a packaged or branded product.",
    "Do not invent nutrition, gram conversions, database IDs, or candidate matches.",
    'If the text is not food-like, return {"items":[]}.',
    `Meal text: ${JSON.stringify(input)}`,
  ].join("\n");
};

const extractResponseText = (payload: GeminiGenerateContentResponse): string => {
  const text = payload.candidates
    ?.flatMap((candidate) => candidate.content?.parts ?? [])
    .map((part) => part.text?.trim())
    .filter((value): value is string => Boolean(value))
    .join("\n")
    .trim();

  if (!text) {
    throw new GeminiMealParserError({
      message: "Gemini returned an empty parsing response",
      payload,
    });
  }

  return text;
};

const parseGeminiMealPayload = (text: string): { items: GeminiParsedMealItemPayload[] } => {
  const normalizedText = stripCodeFences(text);

  let parsed: GeminiParsedMealPayload;
  try {
    parsed = JSON.parse(normalizedText) as GeminiParsedMealPayload;
  } catch (error: unknown) {
    throw new GeminiMealParserError({
      message: error instanceof Error ? error.message : "Failed to parse Gemini JSON response",
      payload: normalizedText,
    });
  }

  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.items)) {
    throw new GeminiMealParserError({
      message: "Gemini response must be an object with an items array",
      payload: parsed,
    });
  }

  return { items: parsed.items as GeminiParsedMealItemPayload[] };
};

const stripCodeFences = (text: string): string => {
  const trimmed = text.trim();
  if (!trimmed.startsWith("```")) {
    return trimmed;
  }

  return trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
};

const normalizeParsedMealItem = (item: GeminiParsedMealItemPayload): ParsedMealItem => {
  if (!item || typeof item !== "object") {
    throw new GeminiMealParserError({
      message: "Each Gemini meal item must be an object",
      payload: item,
    });
  }

  const foodName = requireNonEmptyString(item.foodName, "foodName", item);
  const rawText = optionalString(item.rawText) ?? foodName;
  const quantity = optionalPositiveNumber(item.quantity, "quantity", item);
  const unit = normalizeUnit(item.unit);
  const confidence = requireConfidence(item.confidence, item);

  return {
    rawText,
    foodName,
    quantity,
    unit,
    amount: buildParsedAmount(quantity, unit),
    preparation: optionalString(item.preparation),
    brand: optionalString(item.brand),
    packagingHint: optionalString(item.packagingHint),
    isBrandedGuess: requireBoolean(item.isBrandedGuess, "isBrandedGuess", item),
    confidence,
  };
};

const requireNonEmptyString = (value: unknown, field: string, payload: unknown): string => {
  if (typeof value !== "string" || !value.trim()) {
    throw new GeminiMealParserError({
      message: `Gemini response field ${field} must be a non-empty string`,
      payload,
    });
  }

  return value.trim();
};

const optionalString = (value: unknown): string | null => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "string") {
    throw new GeminiMealParserError({
      message: "Gemini response string field must be a string or null",
      payload: value,
    });
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const optionalPositiveNumber = (value: unknown, field: string, payload: unknown): number | null => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new GeminiMealParserError({
      message: `Gemini response field ${field} must be a positive number or null`,
      payload,
    });
  }

  return value;
};

const requireBoolean = (value: unknown, field: string, payload: unknown): boolean => {
  if (typeof value !== "boolean") {
    throw new GeminiMealParserError({
      message: `Gemini response field ${field} must be a boolean`,
      payload,
    });
  }

  return value;
};

const requireConfidence = (value: unknown, payload: unknown): number => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new GeminiMealParserError({
      message: "Gemini response field confidence must be a number between 0 and 1",
      payload,
    });
  }

  return value;
};

const normalizeUnit = (value: unknown): ParsedUnit => {
  if (value === null || value === undefined) {
    return "unknown";
  }

  if (typeof value !== "string") {
    throw new GeminiMealParserError({
      message: "Gemini response field unit must be a string or null",
      payload: value,
    });
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return "unknown";
  }

  const alias = UNIT_ALIASES[normalized];
  if (alias) {
    return alias;
  }

  throw new GeminiMealParserError({
    message: `Gemini response field unit must be one of the supported units, received ${value}`,
    payload: value,
  });
};

const buildParsedAmount = (quantity: number | null, unit: ParsedUnit): ParsedAmount => {
  if (quantity === null || unit === "unknown") {
    return { kind: "unknown", value: quantity, unit: "unknown" };
  }

  if (isMassUnit(unit)) {
    return { kind: "mass", value: quantity, unit };
  }

  if (isVolumeUnit(unit)) {
    return { kind: "volume", value: quantity, unit };
  }

  if (isHouseholdUnit(unit)) {
    return { kind: "household", value: quantity, unit };
  }

  return { kind: "count", value: quantity, unit };
};

const isMassUnit = (unit: ParsedUnit): unit is (typeof MASS_UNITS)[number] => {
  return (MASS_UNITS as readonly string[]).includes(unit);
};

const isVolumeUnit = (unit: ParsedUnit): unit is (typeof VOLUME_UNITS)[number] => {
  return (VOLUME_UNITS as readonly string[]).includes(unit);
};

const isHouseholdUnit = (unit: ParsedUnit): unit is (typeof HOUSEHOLD_UNITS)[number] => {
  return (HOUSEHOLD_UNITS as readonly string[]).includes(unit);
};

const isCountUnit = (unit: ParsedUnit): unit is (typeof COUNT_UNITS)[number] => {
  return (COUNT_UNITS as readonly string[]).includes(unit);
};

if (!COUNT_UNITS.every((unit) => isCountUnit(unit))) {
  throw new Error("Invalid meal count unit configuration");
}
