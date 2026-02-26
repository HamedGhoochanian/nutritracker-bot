# NutriTracker Project Guide

## What this project is

NutriTracker is a Bun + TypeScript Telegram bot backend focused on personal food-item tracking.

At a high level, the bot:

1. Receives Telegram updates.
2. Restricts access to a single allowed username.
3. Manages item workflows through command handlers.
4. Looks up product data from Open Food Facts.
5. Persists item and meal data in local JSON storage.

This is a backend-only project. There is no web frontend in this repository.

## Backward-compatibility policy

This project is not currently running in production and has no live users/environments to preserve.

- Prefer clean architecture and clarity over backward compatibility.
- Breaking refactors are acceptable when they simplify the codebase.
- Do not keep compatibility shims unless explicitly requested.

## Where to find user flows

User-facing workflow specs live in the `workflows/` directory.

- Primary item workflow file: `workflows/items.md`
- Meal workflow file: `workflows/meals.md`

When implementing or changing bot behavior, check `workflows/` first.

## Main technology stack

- Runtime and package manager: Bun
- Language: TypeScript (ESM)
- Telegram framework: grammy
- HTTP client: axios
- Barcode decoding: zxing-wasm
- Persistence: lowdb (JSON file)
- Logging: winston
- Linting/formatting: ESLint + Prettier
- Testing: Jest (`ts-jest`)

## Core architecture

The app bootstraps from `src/index.ts` and composes the bot in `src/bot.ts`.

### Entry point and orchestration

- `src/index.ts`
  - Validates required environment variables.
  - Creates the repository instance.
  - Builds the bot and starts polling.

- `src/bot.ts`
  - Creates `Bot<MyContext>`.
  - Configures session middleware.
  - Applies username authorization middleware.
  - Registers composer handlers via `src/composers/index.ts`.

### Middleware

- `middleware/requireTargetUsername.ts`
  - Enforces username-based access control.
  - Logs blocked and accepted attempts.
  - Ignores updates from non-target usernames.

### Composer handlers

- `src/composers/itemManager.ts`
  - Handles item flows:
    - `/item_submit`
    - `/item_list [range]`
    - `/item_delete <barcode or alias>`
    - `/item_update <alias>`
  - Supports barcode extraction from text or photo.
  - Fetches product data from Open Food Facts.
  - Persists created/updated/deleted item records via repository methods.
  - Uses session state for multi-step submit/update flows.

- `src/composers/mealManager.ts`
  - Implements `/meal_create` flow logic.
  - Resolves ingredient references from existing submitted items.
  - Computes and stores aggregate meal nutrition.

- `src/composers/index.ts`
  - Wires active composers with constructor-injected dependencies.

### Session model

- `src/types/session.ts`
  - Defines submit and meal flow state enums.
  - Tracks pending submit data and in-progress meal creation.
  - Initializes default session state.

### Barcode domain

- `src/barcode/barcodeReader.ts`
  - Prioritizes common food barcode formats first.
  - Falls back to broad scanning if needed.
  - Returns the best candidate barcode.

### Product lookup domain

- `src/openfoodfacts/client.ts`
  - Encapsulates Open Food Facts API calls.
  - Supports product lookup and additional OFF endpoints.
  - Retries transient errors (`429`, `5xx`) with backoff.
  - Throws `OpenFoodFactsApiError` for predictable error handling.

### Persistence layer

- `src/repositories/botRepository.ts`
  - Manages read/write operations to local JSON storage.
  - Persists submitted items and meals.
  - Supports item listing, alias-first delete, lookup-by-alias, and index-based update.
  - Supports meal save and duplicate-name lookup.

- `src/repositories/types.ts`
  - Repository data model types (`SubmittedItem`, `SavedMeal`, etc.).

- `src/repositories/ports.ts`
  - Narrow repository interfaces by use case (`ItemRepositoryPort`, `MealRepositoryPort`).
  - `BotRepositoryPort` composes narrower ports.

### Logging

- `src/logger.ts`
  - Provides structured JSON logging via winston.
  - Normalizes payloads into a stable message shape.

## Data flow overview

### Item submit flow (`/item_submit`)

1. User starts submit flow.
2. User sends photo or text containing barcode.
3. Bot resolves barcode and fetches product from Open Food Facts.
4. Bot asks for alias (or `skip`).
5. Bot saves submitted item with nutrition facts.

### Item list flow (`/item_list [range]`)

1. User requests items with optional range.
2. Default range is `1-10` (1-based) when omitted.
3. Bot replies with: barcode, name, alias, protein, calories.

### Item delete flow (`/item_delete <barcode or alias>`)

1. User provides alias or barcode.
2. Bot deletes by alias first, then barcode.
3. Bot replies with deleted item summary or not-found message.

### Item update flow (`/item_update <alias>`)

1. User provides alias.
2. If alias not found, bot replies with error and ends flow.
3. If found, bot runs submit-style flow to collect replacement product.
4. Bot updates the existing item record.

### Meal create flow (`/meal_create <name>`)

1. User starts meal creation with a name.
2. Bot collects `<barcode or alias> <amount>` lines across messages.
3. Bot validates/updates ingredients using latest entries.
4. User sends `done`, then bot saves meal and reports total protein/calories.

## Project structure (high-level)

- `src/index.ts` - app entry point
- `src/bot.ts` - bot construction and middleware/composer wiring
- `src/composers/` - command handlers and shared composer helpers
- `src/types/` - context and session types
- `src/barcode/` - barcode reading logic
- `src/openfoodfacts/` - Open Food Facts client and types
- `src/repositories/` - repository implementation, ports, and data types
- `src/logger.ts` - logging setup
- `middleware/` - Telegram middleware
- `tests/` - command, barcode, and Open Food Facts tests
- `workflows/` - user workflow specifications
- `db.json` - local persistent data store

## Runtime configuration

Required environment variables:

- `BOT_TOKEN`: Telegram bot token.
- `TARGET_USERNAME`: Telegram username allowed to interact with the bot.

Optional environment variables:

- `LOG_LEVEL`: logging verbosity.

Configuration is typically loaded via `.env` during local development.

## Development commands

From project root:

- `bun run start` - run bot
- `bun run dev` - run bot in watch mode
- `bun run test` - execute tests (Jest)
- `bun run lint` - run lint checks
- `bun run lint:fix` - auto-fix lint issues where possible
- `bun run format` - apply Prettier formatting

## Testing approach

Current tests cover:

- Open Food Facts client behavior and retry/error handling (`tests/openfoodfacts/client.test.ts`).
- Barcode reader fixture dataset validation (`tests/barcode/`).
- Bot command behavior and authorization checks (`tests/commands/`).

There is no dedicated full end-to-end environment in this repository.

## Operational notes

- Storage is local-file based (`db.json`), suitable for single-instance/local usage unless adapted.
- Unauthorized users are silently ignored by middleware.
- Workflow docs in `workflows/` are the source of truth for user behavior.

## Intended use of this AGENTS.md

This document is a high-level orientation for engineers and coding agents entering the codebase. It intentionally avoids low-level implementation details so contributors can quickly understand system boundaries and navigate to the right modules.
