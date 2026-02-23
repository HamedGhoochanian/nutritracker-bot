export enum SubmitItemState {
  Idle = "idle",
  AwaitingInput = "awaiting_input",
  AwaitingAlias = "awaiting_alias",
}

export enum SubmitItemMode {
  Create = "create",
  Update = "update",
}

export type NutritionFacts = {
  energyKcal100g?: number;
  proteins100g?: number;
  carbohydrates100g?: number;
  fat100g?: number;
  sugars100g?: number;
  fiber100g?: number;
  salt100g?: number;
  sodium100g?: number;
};

export type PendingSubmittedItem = {
  barcode: string;
  productName: string;
  nutritionFacts: NutritionFacts;
  brand?: string;
  quantity?: string;
};

export type SessionData = {
  submit: {
    state: SubmitItemState;
    mode: SubmitItemMode;
    updateIndex?: number;
    pending?: PendingSubmittedItem;
  };
};

export const initialSessionData = (): SessionData => ({
  submit: {
    state: SubmitItemState.Idle,
    mode: SubmitItemMode.Create,
  },
});
