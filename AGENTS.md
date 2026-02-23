# NutriTracker Project Guide

## What this project is

NutriTracker is a Bun + TypeScript Telegram bot backend focused on personal food-item tracking.

At a high level, the bot:

1. Receives Telegram updates.
2. Restricts access to a single allowed username.
3. Manages item workflows through command handlers.
4. Looks up product data from Open Food Facts.
5. Persists item and message data in local JSON storage.

This is a backend-only project. There is no web frontend in this repository.

## Where to find user flows

User-facing workflow specs live in the `workflows/` directory.

- Primary items workflow file: `workflows/items.md`

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
- Testing: Bun test runner

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
  - Registers composer-based handlers with injected dependencies.

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

- `src/composers/messageLogger.ts`
  - Logs message metadata to `db.json` for `message` updates that reach this composer.

- `src/composers/index.ts`
  - Wires composers with dependency injection.

### Session model

- `src/types/session.ts`
  - Defines submit flow state enum and mode enum.
  - Tracks pending item data while awaiting alias input.
  - Initializes default session state.

### Barcode domain

- `lib/barcode/barcodeReader.ts`
  - Prioritizes common food barcode formats first.
  - Falls back to broad scanning if needed.
  - Returns the best candidate barcode.

### Product lookup domain

- `lib/openfoodfacts/client.ts`
  - Encapsulates Open Food Facts API calls.
  - Supports product lookup and additional OFF endpoints.
  - Retries transient errors (`429`, `5xx`) with backoff.
  - Throws `OpenFoodFactsApiError` for predictable error handling.

### Persistence layer

- `lib/repositories/botRepository.ts`
  - Manages read/write operations to local JSON storage.
  - Persists:
    - message metadata
    - submitted item records (barcode, alias, nutrition snapshot, metadata)
  - Supports listing, alias-first delete, lookup-by-alias, and index-based update.

### Logging

- `lib/logger.ts`
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

### Message logging flow

1. A message update reaches the message logger composer.
2. Message metadata is stored in `db.json`.

## Project structure (high-level)

- `src/index.ts` - app entry point
- `src/bot.ts` - bot construction and middleware/composer wiring
- `src/composers/` - command/message handlers
- `src/types/` - context, session, and dependency contracts
- `lib/barcode/` - barcode reading logic
- `lib/openfoodfacts/` - Open Food Facts client, types, and tests
- `lib/repositories/` - JSON persistence
- `lib/logger.ts` - logging setup
- `middleware/` - Telegram middleware
- `tests/` - integration-style command tests and barcode fixture tests
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
- `bun run test` - execute tests
- `bun run lint` - run lint checks
- `bun run lint:fix` - auto-fix lint issues where possible
- `bun run format` - apply Prettier formatting

## Testing approach

Current tests cover:

- Open Food Facts client behavior and retry/error handling (`lib/openfoodfacts/client.test.ts`).
- Barcode reader fixture dataset validation (`tests/barcode/`).
- Bot command behavior and authorization checks (`tests/commands/`).

There is no dedicated full end-to-end environment in this repository.

## Operational notes

- Storage is local-file based (`db.json`), suitable for single-instance/local usage unless adapted.
- Unauthorized users are silently ignored by middleware.
- Workflow docs in `workflows/` are the source of truth for user behavior.

## Intended use of this AGENTS.md

This document is a high-level orientation for engineers and coding agents entering the codebase. It intentionally avoids low-level implementation details so contributors can quickly understand system boundaries and navigate to the right modules.
