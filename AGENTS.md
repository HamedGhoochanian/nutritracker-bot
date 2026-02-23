# NutriTracker Project Guide

## What this project is

NutriTracker is a Bun + TypeScript Telegram bot backend for quick food product lookup.

At a high level, the bot:

1. Receives Telegram updates.
2. Restricts access to a single allowed username.
3. Supports `/say_name <barcode>` product lookup via Open Food Facts.
4. Supports `pic_save` photo flow to detect a barcode from an image and fetch product data.
5. Logs selected inbound messages to local JSON storage.
6. Stores successful product lookups locally.

This is a backend-only project. There is no web frontend in the repository.

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

- `src/composers/sayName.ts`
  - Handles `/say_name <productId>`.
  - Fetches product details from Open Food Facts.
  - Saves successful lookups in the repository.

- `src/composers/picSave.ts`
  - Handles messages matching `pic_save`.
  - Downloads the largest attached photo from Telegram.
  - Tries barcode detection, product lookup, and persistence.
  - Saves the image file to `downloads/`.

- `src/composers/messageLogger.ts`
  - Logs message metadata to `db.json` for handled `message` updates that reach this composer.

- `src/composers/index.ts`
  - Wires all composers in order with dependency injection.

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
    - product lookup records

### Logging

- `lib/logger.ts`
  - Provides structured JSON logging via winston.
  - Normalizes payloads into a stable message shape.

## Data flow overview

### `/say_name` flow

1. User sends `/say_name <barcode>`.
2. Username middleware validates access.
3. Bot requests product fields from Open Food Facts.
4. Product display name is selected from available fields.
5. Product lookup is stored in `db.json`.
6. Bot replies with product name (and brand when available).

### `pic_save` flow

1. User sends a `pic_save` message with a photo.
2. Username middleware validates access.
3. Bot downloads the photo from Telegram file API.
4. Barcode reader extracts a likely barcode.
5. Bot resolves product name from Open Food Facts.
6. Product lookup is stored in `db.json` when found.
7. Image is written under `downloads/`.
8. Bot replies with result and saved file path.

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
- `downloads/` - runtime image downloads
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

- Storage is local-file based (`db.json`), so this is suitable for single-instance/local usage unless adapted.
- `downloads/` may accumulate files over time and should be managed as part of runtime hygiene.
- Unauthorized users are silently ignored by middleware.

## Intended use of this AGENTS.md

This document is a high-level orientation for engineers and automated coding agents entering the codebase. It intentionally avoids low-level implementation details so contributors can quickly understand system boundaries and navigate to the right modules.
