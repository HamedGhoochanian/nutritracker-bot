# NutriTracker Test Guide

This file is for coding agents working inside `tests/`.
It supplements the root `AGENTS.md` with test-specific guidance so the main file can stay focused on product code.

## Scope

- Applies to files under `tests/`
- Follow the root `AGENTS.md` for repository-wide rules
- Use this file for test structure, mocking strategy, naming, and execution patterns

## Test Stack

- Test runner: Jest
- TS transform: `ts-jest`
- Environment: Node
- Match pattern: `**/*.test.ts`

Relevant config files:

- `jest.config.mjs`
- `tsconfig.jest.json`

## Commands

Run commands from the repository root.

- Run all tests: `bun run test`
- Run a single test file: `bun run test -- tests/pipeline/processMealText.test.ts`
- Run a test file in this folder: `bun run test -- tests/resolution/executor.test.ts`
- Run one test by name: `bun run test -- --testNamePattern="uses fallback and still returns totals when primary source is weak"`

When editing only tests, at least run the affected file.
When editing shared pipeline logic, run the full suite.

## Test Organization

Current folders map to runtime modules:

- `tests/meal`: parser and normalization
- `tests/source-router`: route planning
- `tests/resolution`: candidate fetching and fallback behavior
- `tests/matching`: candidate scoring and selection
- `tests/pipeline`: end-to-end workflow tests
- `tests/openfoodfacts`: OFF client adapter tests
- `tests/usda`: USDA client adapter tests

Keep new tests in the folder that matches the production module being verified.
If a behavior crosses several modules, prefer `tests/pipeline`.

## Naming And Layout

- File names should mirror the module under test when practical
- Use `*.test.ts` only
- Prefer one top-level `describe()` per module or workflow
- Keep test names behavior-focused, e.g. `returns an empty parse for blank input`
- Avoid vague names like `works` or `handles case`

## Mocking Strategy

- Mock external APIs through ports and lightweight stubs
- Do not hit real Gemini, USDA, OFF, or Telegram APIs in tests
- Prefer in-memory fakes for repositories over file-backed persistence
- Keep mocks minimal and local to the test file unless reused heavily

Current patterns already in the repo:

- mock axios request functions in adapter tests
- use typed port mocks in resolution and pipeline tests
- use stub parser/normalizer implementations in end-to-end pipeline tests

## Assertions

- Assert behavior, not implementation trivia
- Prefer checking final domain outputs over raw intermediate transport payloads
- For routing/matching, assert reasons and statuses when they matter
- For pipeline tests, assert totals, unresolved counts, and fallback usage
- For client tests, assert request shape and normalized response mapping

## Determinism Rules

- Keep tests deterministic and fast
- Do not depend on wall-clock timing unless unavoidable
- Avoid random data unless seeded and necessary
- Use explicit numeric expectations for nutrient totals and conversions
- Preserve stable ordering when asserting ranked candidates

## Test Data Guidelines

- Use realistic meal descriptions and food names
- Keep fixture data small and focused
- Include explicit units when the unit is part of the behavior under test
- For nutrient tests, provide complete macro values when totals are asserted
- Prefer readable inline fixtures over large shared blobs

## What To Cover

When changing code in these areas, ensure tests cover:

- parsing: item splitting, units, brand hints, confidence handling
- normalization: deterministic conversions and unresolved discrete units
- routing: primary/fallback source choice and reasons
- resolution: source fetch mapping and fallback behavior
- matching: scoring, thresholds, accepted vs review vs unresolved
- nutrition: basis compatibility, serving scaling, macro totals
- pipeline: text input to aggregated meal totals and persistence

## Good Existing References

- `tests/meal/geminiMealParser.test.ts`
- `tests/meal/normalizeMeal.test.ts`
- `tests/source-router/router.test.ts`
- `tests/resolution/executor.test.ts`
- `tests/matching/selectBestCandidate.test.ts`
- `tests/pipeline/processMealText.test.ts`

## Style Expectations Inside Tests

- Use TypeScript types in fixtures and mocks when it improves clarity
- Prefer helper builders like `createCandidate()` and `createNormalizedItem()` for repeated setup
- Keep builders near the top of the file
- Use double quotes and semicolons to match repo style
- Avoid deep nesting in test bodies when a helper can flatten setup

## Error And Edge Cases

Add or update tests when fixing bugs involving:

- empty input
- invalid model payloads
- unsupported unit/basis combinations
- source API failures
- fallback activation
- unresolved nutrient computation

If a bug caused a crash, add a regression test that proves the workflow now degrades safely.

## Before Finishing

- Run the affected test file
- If you changed shared logic, run `bun run test`
- Keep snapshots out unless there is a strong reason
- Remove unused fixtures and dead mocks

## Notes

- The test suite is primarily behavior-driven, not snapshot-driven
- Prefer clear explicit expected values over broad matchers when nutrient totals are important
- Root repository guidance still applies; this file only narrows testing-specific expectations
