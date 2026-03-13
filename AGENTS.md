# NutriTracker Agent Guide

This file is for coding agents working in this repository.
It summarizes the current build, test, lint, and style conventions that are already present in the codebase.

## Project Overview

- Runtime: Bun
- Language: TypeScript
- Module system: ESM-style source with `type: module`
- Test runner: Jest with `ts-jest`
- Linting: ESLint flat config
- Formatting: Prettier via ESLint plugin and standalone Prettier command
- Main entrypoint: `src/index.ts`
- Current app shape: Telegram bot demo + meal parsing/resolution/nutrition pipeline

## Agent Priorities

- Keep changes small, local, and typed.
- Prefer extending existing pipeline modules over adding parallel abstractions.
- Preserve deterministic behavior in normalization, routing, matching, and nutrient computation.
- Treat external API failures as recoverable when possible.
- Do not silently invent nutrition or conversion data.

## Commands

Run commands from the repository root.

### Install

- `bun install`

### Start And Dev

- `bun run start`
- `bun run dev`

### Tests

- Run all tests: `bun run test`
- Run a single test file: `bun run test -- tests/meal/normalizeMeal.test.ts`
- Run a single Jest test by name: `bun run test -- --testNamePattern="processes text input through meal totals and persistence"`
- Run a specific suite directly: `bun run test -- tests/pipeline/processMealText.test.ts`

Notes:

- `package.json` maps `bun run test` to `jest`
- `jest.config.mjs` matches `**/*.test.ts`
- Jest uses `ts-jest` with `tsconfig.jest.json`

### Lint And Format

- Run lint: `bun run lint`
- Auto-fix lint issues: `bun run lint:fix`
- Run Prettier on the repo: `bun run format`

## CI

GitHub Actions config is in `.github/workflows/test.yml`.

- CI uses Bun `1.3.9`
- CI installs with `bun install --frozen-lockfile`
- CI currently runs tests only: `bun run test`

If you add checks that should be enforced in CI, update the workflow explicitly.

## Rules Files

Checked for repository-specific Cursor/Copilot instruction files:

- `.cursor/rules/`: not present
- `.cursorrules`: not present
- `.github/copilot-instructions.md`: not present

At the moment, this `AGENTS.md` is the repository-local agent guidance file.

## Repository Structure

Important folders and responsibilities:

- `src/meal`: parsing and normalization
- `src/source-router`: route planning between USDA and Open Food Facts
- `src/resolution`: candidate fetching and normalization
- `src/matching`: deterministic scoring and selection
- `src/nutrition`: nutrient computation and meal aggregation
- `src/pipeline`: end-to-end orchestration from text input to aggregated meal
- `src/openfoodfacts`: OFF API client
- `src/usda`: USDA API client
- `src/repositories`: persistence contracts and lowdb repository
- `tests/`: unit and e2e-style pipeline tests

Keep those boundaries intact.
Do not move API logic into routing, or nutrient math into parsing.

## Code Style

### Imports

- Use ESM import syntax.
- Group imports in this order when practical:
  1. external packages
  2. internal value imports
  3. internal type imports
- Prefer `import type` for type-only imports.
- Use relative imports inside `src`.
- Do not add unused imports.

Examples already in the codebase:

- `import { Bot } from "grammy";`
- `import type { CandidateMatcherOptions } from "../matching";`

### Formatting

- Follow Prettier defaults as enforced by ESLint.
- Use double quotes.
- Use semicolons.
- Keep trailing commas where Prettier adds them.
- Prefer multi-line formatting when object literals or argument lists get dense.
- Do not hand-format against Prettier.

### Types

- Prefer explicit domain types over loose records.
- Add small focused types near the owning module.
- Prefer discriminated unions for stateful domain models.
- Avoid `any`.
- Use `unknown` for caught errors or truly unknown inputs, then narrow.
- Prefer explicit return types on exported functions and class methods.
- Reuse existing types before inventing new ones.

Good examples in the repo:

- normalized amount unions in `src/meal/types.ts`
- route query types in `src/source-router/types.ts`
- nutrient result types in `src/nutrition/types.ts`

### Naming

- Types/interfaces/classes: `PascalCase`
- Functions/variables/constants: `camelCase`
- Constant arrays and fixed conversion tables: `UPPER_SNAKE_CASE` for top-level constants
- Boolean helpers should read clearly, e.g. `isLowConfidence`, `isDiscreteUnit`
- Use descriptive names over abbreviations unless the abbreviation is standard (`fdcId`, `apiKey`)

### Functions And Classes

- Prefer pure functions for deterministic business logic.
- Use classes mainly for stateful adapters and ports, such as API clients or repositories.
- Keep exported functions small and composable.
- If a function mixes fetching, scoring, and formatting, split it.

### Error Handling

- Fail fast for missing required env vars at startup.
- Throw typed errors for API adapters when appropriate.
- In pipeline stages, recover gracefully when a source failure can be treated as “no candidates”.
- Log structured objects through `logger`, not raw string concatenation.
- When catching `unknown`, narrow with `instanceof Error` before reading `.message`.
- Do not swallow errors silently.

Current pattern to follow:

- API clients throw typed adapter errors
- resolution layer can degrade to empty candidates
- Telegram command handler logs failure and returns a simple message

### Logging

- Use `src/logger.ts`
- Log JSON-friendly objects with an `event` field
- Keep event names stable and machine-readable, e.g. `usda.get_food.request`
- Avoid logging secrets, API keys, or full credentials

### Environment Variables

Current relevant env vars include:

- `BOT_TOKEN`
- `TARGET_USERNAME`
- `GEMINI_API_KEY`
- `GEMINI_MODEL`
- `USDA_API_KEY` or `USDA_FOODDATA_CENTRAL_API_KEY`
- `LOG_LEVEL`

When adding new env vars:

- read them in one place near startup or adapter construction
- validate required values
- do not hardcode secrets

## Testing Guidelines

- Add tests for all new business logic.
- Prefer focused unit tests for deterministic logic.
- Add pipeline tests when behavior crosses multiple modules.
- Mock external services through ports instead of hitting real APIs.
- Keep tests deterministic and fast.
- When fixing a bug, add or update a test that covers it.
- For file placement, mocking patterns, and test-specific style, see `tests/AGENTS.md`.

## API And Domain Guidance

### Meal Parsing

- Gemini is used for structure extraction only.
- Do not ask the model for nutrients or final food matches.
- Validate model output locally.

### Normalization

- Keep normalization deterministic.
- Convert only safe metric transformations eagerly.
- Do not guess grams for food-dependent units without candidate metadata.

### Routing

- Routing is heuristic-first with fallback.
- Keep routing explainable with explicit reasons.
- Do not couple routing logic to raw HTTP client code.

### Matching

- Matching must remain deterministic.
- Prefer additive score breakdowns with human-readable reasons.
- Keep thresholds centralized.

### Nutrition

- Use the canonical nutrient shape:
  - calories
  - protein
  - carbs
  - fat
  - fiber
- Do not fabricate unsupported conversions.
- If basis and consumed amount are incompatible, mark unresolved or review.

### Persistence

- Repository writes should store completed meal pipeline outputs.
- Preserve enough data for debugging: input, parsed meal, route decisions, selected candidates, computed totals.
- Keep lowdb schema backward-compatible when possible.

## When Editing Files

- Match existing local style before introducing a new pattern.
- Prefer updating existing modules over creating duplicate ones.
- Avoid broad refactors unless they are necessary for correctness.
- Do not rename exported symbols casually; tests and callers rely on them.

## Before Finishing A Change

At minimum:

- run relevant tests for touched code
- if the change is broad, run `bun run test`
- run `bun run lint` when changing multiple files or introducing new modules

Suggested quick checklist:

- code compiles under current TS settings
- tests added or updated
- no obvious unused imports
- no secret values logged
- behavior degrades safely on API failure

## Single-Test Examples

Common commands agents should use:

- `bun run test -- tests/pipeline/processMealText.test.ts`
- `bun run test -- tests/resolution/executor.test.ts`
- `bun run test -- --testNamePattern="uses fallback and still returns totals when primary source is weak"`

More test-specific guidance lives in `tests/AGENTS.md`.

## Final Notes

- This repo values typed, deterministic pipeline stages.
- LLMs are for parsing, not truth.
- Prefer explicit warnings and unresolved states over fake precision.
- If a source call fails, degrade gracefully when possible and keep the user-facing workflow alive.
