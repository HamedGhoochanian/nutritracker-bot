# NutriTracker Project Guide

## Rules

Use the smallest possible diff to make a change. Don't add unnecessary helpers unless they deduplicate code. Do not use
fallbacks with ternaries or the ||
operator. No typeof checks either use zod or rely on the type system. No backwards compat whatsoever. I want the
SMALLEST possible set of
changes to make this work, nothing more, nothing less. This is not a giant enterprise project but a personal proof of
concept.
THIS PROJECT USES BUN
## Project Structure

- `src/pipeline/`: core nutrition pipeline (parse -> normalize -> resolve -> compute -> aggregate -> run/save)
- `src/llm/`: LLM clients and provider interfaces (OpenRouter + Gemini retained)
- `src/usda/`: USDA API client and types
- `src/openfoodfacts/`: Open Food Facts API client and types
- `src/repositories/`: persistence layer (lowdb), meal save/read contracts
- `src/cli.ts`: thin CLI adapter that invokes the pipeline orchestrator
- `tests/pipeline/`: stage-specific unit/integration tests
- `tests/repositories/`: persistence tests

## Design Notes

- Pipeline logic is interface-agnostic and should stay independent from CLI.
- LLM providers are swappable through a shared client port.
- Use zod schemas for runtime validation at module boundaries.
- Persist compact pipeline artifacts only; do not store full external API payloads.
