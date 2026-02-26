export type OffLang =
  | "world"
  | "fr"
  | "us"
  | "uk"
  | "de"
  | "it"
  | "es"
  | "be"
  | "nl"
  | "ca"
  | string;

export type OpenFoodFactsClientOptions = {
  baseUrl?: string;
  userAgent?: string;
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
};

export type OpenFoodFactsApiErrorPayload = {
  status?: number;
  status_verbose?: string;
  error?: unknown;
};

export type OpenFoodFactsApiErrorOptions = {
  message: string;
  status?: number;
  url?: string;
  payload?: OpenFoodFactsApiErrorPayload;
};

export type OffProduct = {
  code?: string;
  product_name?: string;
  generic_name?: string;
  brands?: string;
  categories?: string;
  quantity?: string;
  image_url?: string;
  nutriments?: Record<string, unknown>;
  [key: string]: unknown;
};

export type OffProductResponse = {
  status?: number;
  status_verbose?: string;
  code?: string;
  product?: OffProduct;
};

export type OffSearchParams = {
  search_terms?: string;
  page?: number;
  page_size?: number;
  sort_by?: string;
  fields?: string[];
  [key: string]: string | number | boolean | string[] | undefined;
};

export type OffSearchResponse = {
  count?: number;
  page?: number;
  page_count?: number;
  page_size?: number;
  products?: OffProduct[];
  skip?: number;
};

export type OffEntityItem = {
  id?: string;
  name?: string;
  products?: number;
  url?: string;
  [key: string]: unknown;
};

export type OffEntityResponse = {
  count?: number;
  tags?: OffEntityItem[];
  [key: string]: unknown;
};
