# Pipeline Flow

This directory contains the nutrition pipeline stages. The flow is deterministic except where LLM is intentionally used
for parse and nutrient estimation.

## Stage Order

1. `parse.ts`
   - Input: raw meal text.
   - Uses `LlmClientPort` to extract structured items.
   - Returns both original quantity/unit and `normalized_quantity` / `normalized_unit`.
   - Output validated by `ParsedMealSchema`.

2. `normalize.ts`
   - Input: parsed items.
   - Passes through LLM-provided normalization to `g | ml | piece`.
   - Keeps original quantity/unit for traceability.

3. `resolve.ts`
   - Input: normalized items.
   - Uses LLM to estimate per-100 nutrition for each item.
   - Builds a single `llm` candidate from that estimate.
   - Output validated by `ResolvedMealSchema`.

4. `compute.ts`
   - Input: resolved items.
   - Extracts calories/protein/fiber from selected candidate.
   - Scales nutrients by normalized quantity.
   - Supports `llm` candidates in addition to external sources.
   - Output validated by `ComputedMealSchema`.

5. `aggregate.ts`
   - Input: computed items.
   - Sums nutrients into meal totals.

6. `run.ts`
   - Orchestrates all stages above.
   - Calls repository save step and returns `meal_id`.

## Shared Contracts

- `types.ts` defines zod schemas/types used across stages.
- `index.ts` exports all stage entry points and shared schemas/types.

## Logging

- All stages emit verbose debug logs via the project logger.
- Use `LOG_LEVEL=debug` to inspect stage boundaries and key decisions.

## Persistence Constraint

- Save compact pipeline artifacts only.
- Do not persist full raw API payloads from USDA/OFF.
