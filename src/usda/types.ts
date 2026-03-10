export type UsdaFoodDataType = "Branded" | "Foundation" | "Survey (FNDDS)" | "SR Legacy";

export type UsdaFoodFormat = "abridged" | "full";

export type UsdaSortBy =
  | "dataType.keyword"
  | "lowercaseDescription.keyword"
  | "fdcId"
  | "publishedDate";

export type UsdaSortOrder = "asc" | "desc";

export type UsdaFoodClientOptions = {
  apiKey?: string;
  baseUrl?: string;
  userAgent?: string;
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
};

export type UsdaFoodApiErrorOptions = {
  message: string;
  status?: number;
  url?: string;
  payload?: unknown;
};

export type UsdaAbridgedFoodNutrient = {
  number?: number;
  name?: string;
  amount?: number;
  unitName?: string;
  derivationCode?: string;
  derivationDescription?: string;
  [key: string]: unknown;
};

export type UsdaNutrient = {
  id?: number;
  number?: string;
  name?: string;
  rank?: number;
  unitName?: string;
  [key: string]: unknown;
};

export type UsdaFoodNutrient = {
  id?: number;
  amount?: number;
  dataPoints?: number;
  min?: number;
  max?: number;
  median?: number;
  type?: string;
  nutrient?: UsdaNutrient;
  foodNutrientDerivation?: Record<string, unknown>;
  nutrientAnalysisDetails?: Record<string, unknown>;
  [key: string]: unknown;
};

export type UsdaFoodBase = {
  fdcId: number;
  dataType?: string;
  description: string;
  publicationDate?: string;
  foodNutrients?: Array<UsdaAbridgedFoodNutrient | UsdaFoodNutrient>;
  [key: string]: unknown;
};

export type UsdaAbridgedFoodItem = UsdaFoodBase & {
  brandOwner?: string;
  gtinUpc?: string;
  ndbNumber?: string;
  foodCode?: string;
};

export type UsdaBrandedFoodItem = UsdaFoodBase & {
  availableDate?: string;
  brandOwner?: string;
  dataSource?: string;
  foodClass?: string;
  gtinUpc?: string;
  householdServingFullText?: string;
  ingredients?: string;
  modifiedDate?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  brandedFoodCategory?: string;
  foodUpdateLog?: Record<string, unknown>[];
  labelNutrients?: Record<string, { value?: number } | undefined>;
};

export type UsdaFoundationFoodItem = UsdaFoodBase & {
  foodClass?: string;
  footNote?: string;
  isHistoricalReference?: boolean;
  ndbNumber?: string;
  scientificName?: string;
  foodCategory?: Record<string, unknown>;
  foodComponents?: Record<string, unknown>[];
  foodPortions?: Record<string, unknown>[];
  inputFoods?: Record<string, unknown>[];
  nutrientConversionFactors?: Record<string, unknown>[];
};

export type UsdaSrLegacyFoodItem = UsdaFoodBase & {
  foodClass?: string;
  isHistoricalReference?: boolean;
  ndbNumber?: string;
  scientificName?: string;
  foodCategory?: Record<string, unknown>;
  nutrientConversionFactors?: Record<string, unknown>[];
};

export type UsdaSurveyFoodItem = UsdaFoodBase & {
  datatype?: string;
  endDate?: string;
  foodClass?: string;
  foodCode?: string;
  startDate?: string;
  foodAttributes?: Record<string, unknown>[];
  foodPortions?: Record<string, unknown>[];
  inputFoods?: Record<string, unknown>[];
  wweiaFoodCategory?: Record<string, unknown>;
};

export type UsdaFoodItem =
  | UsdaAbridgedFoodItem
  | UsdaBrandedFoodItem
  | UsdaFoundationFoodItem
  | UsdaSrLegacyFoodItem
  | UsdaSurveyFoodItem;

export type UsdaGetFoodOptions = {
  format?: UsdaFoodFormat;
  nutrients?: readonly number[];
};

export type UsdaFoodsCriteria = {
  fdcIds: ReadonlyArray<number | string>;
  format?: UsdaFoodFormat;
  nutrients?: readonly number[];
};

export type UsdaFoodListCriteria = {
  dataType?: readonly UsdaFoodDataType[];
  pageSize?: number;
  pageNumber?: number;
  sortBy?: UsdaSortBy;
  sortOrder?: UsdaSortOrder;
};

export type UsdaFoodSearchCriteria = UsdaFoodListCriteria & {
  query: string;
  brandOwner?: string;
};

export type UsdaSearchResultFood = UsdaAbridgedFoodItem & {
  scientificName?: string;
  ingredients?: string;
  additionalDescriptions?: string;
  allHighlightFields?: string;
  score?: number;
};

export type UsdaSearchResult = {
  foodSearchCriteria?: Partial<UsdaFoodSearchCriteria>;
  totalHits?: number;
  currentPage?: number;
  totalPages?: number;
  foods?: UsdaSearchResultFood[];
  [key: string]: unknown;
};
