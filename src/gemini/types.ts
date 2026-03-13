export type GeminiClientOptions = {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  timeoutMs?: number;
};

export type GeminiApiErrorOptions = {
  message: string;
  status?: number;
  url?: string;
  payload?: unknown;
};
