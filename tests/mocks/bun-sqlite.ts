type MealRow = {
  id: string;
  meal_text: string;
  pipeline_json: string;
  created_at: string;
};

type ConsumptionRow = {
  id: string;
  meal_id: string;
  consumed_at: string;
};

type RunFn = (...params: unknown[]) => unknown;
type GetFn = (...params: unknown[]) => unknown;
type AllFn = (...params: unknown[]) => unknown[];

export class Statement {
  constructor(
    private readonly runFn?: RunFn,
    private readonly getFn?: GetFn,
    private readonly allFn?: AllFn,
  ) {}

  run(...params: unknown[]): unknown {
    if (this.runFn === undefined) {
      throw new Error("run not supported for statement");
    }
    return this.runFn(...params);
  }

  get(...params: unknown[]): unknown {
    if (this.getFn === undefined) {
      throw new Error("get not supported for statement");
    }
    return this.getFn(...params);
  }

  all(...params: unknown[]): unknown[] {
    if (this.allFn === undefined) {
      throw new Error("all not supported for statement");
    }
    return this.allFn(...params);
  }
}

export class Database {
  private readonly meals: MealRow[] = [];
  private readonly consumption: ConsumptionRow[] = [];

  constructor(_filename: string) {}

  exec(_sql: string): void {}

  query(sql: string): Statement {
    if (sql.includes("INSERT INTO meals")) {
      return new Statement((id, mealText, pipelineJson, createdAt) => {
        this.meals.push({
          id: String(id),
          meal_text: String(mealText),
          pipeline_json: String(pipelineJson),
          created_at: String(createdAt),
        });
      });
    }

    if (
      sql.includes(
        "SELECT id, meal_text, pipeline_json, created_at FROM meals ORDER BY created_at ASC",
      )
    ) {
      return new Statement(undefined, undefined, () => {
        return [...this.meals].sort((a, b) => a.created_at.localeCompare(b.created_at));
      });
    }

    if (
      sql.includes(
        "SELECT id, meal_text, pipeline_json, created_at FROM meals WHERE meal_text = ? LIMIT 1",
      )
    ) {
      return new Statement(undefined, (mealText) => {
        for (const meal of this.meals) {
          if (meal.meal_text === String(mealText)) {
            return meal;
          }
        }
        return null;
      });
    }

    if (sql.includes("INSERT INTO consumption")) {
      return new Statement((id, mealId, consumedAt) => {
        this.consumption.push({
          id: String(id),
          meal_id: String(mealId),
          consumed_at: String(consumedAt),
        });
      });
    }

    if (sql.includes("SELECT id, meal_id, consumed_at FROM consumption ORDER BY consumed_at ASC")) {
      return new Statement(undefined, undefined, () => {
        return [...this.consumption].sort((a, b) => a.consumed_at.localeCompare(b.consumed_at));
      });
    }

    throw new Error(`Unsupported SQL in test sqlite mock: ${sql}`);
  }
}
