import { describe, expect, it } from "@jest/globals";
import { spawn } from "node:child_process";

describe("cli", () => {
  it("returns usage error when meal text is missing", async () => {
    const result = await new Promise<{ code: number | null; stderr: string }>((resolve) => {
      const child = spawn("bun", ["run", "src/cli.ts"], {
        cwd: process.cwd(),
        env: process.env,
      });

      let stderr = "";
      child.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      child.on("close", (code) => {
        resolve({ code, stderr });
      });
    });

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('Usage: bun run src/cli.ts "<meal text>"');
  });

  it("does not print result markers when initialization fails", async () => {
    const result = await new Promise<{ code: number | null; stdout: string }>((resolve) => {
      const child = spawn("bun", ["run", "src/cli.ts", "one banana"], {
        cwd: process.cwd(),
        env: {
          ...process.env,
          OPENROUTER_API_KEY: undefined,
          GEMINI_API_KEY: "x",
          USDA_API_KEY: "x",
        },
      });

      let stdout = "";
      child.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString();
      });

      child.on("close", (code) => {
        resolve({ code, stdout });
      });
    });

    expect(result.code).toBe(1);
    expect(result.stdout.includes("RESULT_JSON_START")).toBe(false);
  });
});
