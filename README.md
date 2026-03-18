# nutritracker
This is telegram bot for tracking your macros, I wanted a simple and mostly text based tracker that I could use everywhere, tailored to my personal needs and right now it's in super mega early stage.

## Git worktrees

Create a branch worktree inside `.worktrees/` with:

```bash
bun run worktree:add <branch-name>
```

Example:

```bash
bun run worktree:add codex/cli-cleanup
```

Each worktree gets its own ignored local files like `.env`, `db.sqlite`, and `node_modules`.

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run src/index.ts
```

This project was created using `bun init` in bun v1.3.9. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.
