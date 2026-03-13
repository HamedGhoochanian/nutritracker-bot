export type LlmClientOptions = {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
};

export type LlmApiErrorOptions = {
  message: string;
  status?: number;
  url?: string;
  payload?: unknown;
};
