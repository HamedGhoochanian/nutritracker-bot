# NutriTracker Project Guide

## What this project is

NutriTracker is a Bun + TypeScript Telegram bot backend that helps track food products by reading barcodes from user-submitted photos and fetching product details from Open Food Facts.

At a high level, the bot:

1. Receives Telegram messages and photos.
2. Restricts access to an allowed username.
3. Downloads photo attachments when needed.
4. Decodes barcodes from images.
5. Looks up product information using the Open Food Facts API.
6. Stores message and product records locally in a JSON database.
7. Replies to the user with relevant information.

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

The app is composed in `index.ts`, which wires dependencies and starts the Telegram bot.

### Entry point and orchestration

- `index.ts`
  - Validates required environment variables.
  - Creates service instances (repository, API client, barcode reader).
  - Attaches middleware.
  - Registers handlers for commands/messages.
  - Starts polling for Telegram updates.

### Middleware

- `middleware/requireTargetUsername.ts`
  - Enforces username-based access control.
  - Drops or rejects updates from users who are not allowed.

### Barcode domain

- `lib/barcode/barcodeReader.ts`
  - Attempts decoding with barcode formats typically used for food packaging.
  - Applies fallback strategy if preferred formats fail.
  - Returns best candidate barcode value for lookup.

### Product lookup domain

- `lib/openfoodfacts/client.ts`
  - Encapsulates Open Food Facts API calls.
  - Uses typed response structures.
  - Implements retry behavior for transient failures (like `429` and `5xx`).
  - Raises domain-specific API errors to keep error handling predictable.

### Persistence layer

- `lib/repositories/botRepository.ts`
  - Handles read/write operations to local JSON storage.
  - Persists two primary categories:
    - inbound message metadata
    - product lookup records

### Logging

- `lib/logger.ts`
  - Provides a centralized structured logger.
  - Normalizes log payloads and levels for easier diagnostics.

## Data flow overview

### Photo + barcode flow

1. A user sends a matching message/photo to Telegram.
2. Username middleware verifies user access.
3. The bot downloads image content to `downloads/`.
4. Barcode reader extracts a product code from the image.
5. Open Food Facts client fetches product details using that code.
6. Repository saves relevant product/message data into `db.json`.
7. Bot replies with product details (or appropriate fallback/error message).

### Command-based lookup flow

1. User runs command with a product id/barcode.
2. Middleware validates access.
3. Bot queries Open Food Facts directly.
4. Result is persisted and returned to user.

### General message logging flow

1. Any message update reaches handler.
2. Normalized metadata is stored in JSON DB.

## Project structure (high-level)

- `index.ts` - application bootstrap and handler registration
- `lib/` - domain logic and service integrations
  - `lib/barcode/` - barcode decode logic
  - `lib/openfoodfacts/` - API client and related types/tests
  - `lib/repositories/` - persistence adapters
  - `lib/logger.ts` - logging setup
- `middleware/` - Telegram middleware
- `tests/` - test suites and fixtures
- `downloads/` - runtime image downloads
- `db.json` - local persistent data store

## Runtime configuration

Required environment variables:

- `BOT_TOKEN`: Telegram bot token.
- `TARGET_USERNAME`: Telegram username allowed to interact with the bot.

Common optional settings:

- `LOG_LEVEL`: Logging verbosity.
- `OFF_USER_AGENT`: Custom user-agent for Open Food Facts requests (if used by current code path).

Configuration is usually loaded via `.env` during local development.

## Development commands

From project root:

- `bun run start` - run bot
- `bun run dev` - run bot in watch mode
- `bun run test` - execute tests
- `bun run lint` - run lint checks
- `bun run lint:fix` - auto-fix lint issues where possible
- `bun run format` - apply Prettier formatting

## Testing approach

Current tests cover key logic areas:

- Open Food Facts client behavior and error/retry scenarios.
- Barcode reader accuracy using fixture image datasets.

There is currently no dedicated full end-to-end environment in this repository.

## Operational notes

- Storage is local-file based (`db.json`), so this is suitable for single-instance/local usage unless adapted.
- `downloads/` may accumulate files over time and should be managed as part of runtime hygiene.
- Error handling is designed to keep Telegram interactions resilient when external APIs fail temporarily.

## Intended use of this AGENTS.md

This document is a high-level orientation for engineers and automated coding agents entering the codebase. It is intentionally broad and avoids low-level implementation details so contributors can quickly understand the system boundaries and navigate to the right modules.
