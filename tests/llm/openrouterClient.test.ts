import { describe, expect, it } from "@jest/globals";
import { AxiosError, AxiosHeaders } from "axios";
import { OpenRouterClient } from "../../src/llm";

type MockResponse<T> = { data: T };

const setMockRequest = <T>(
  client: OpenRouterClient,
  impl: (config: {
    method?: string;
    url?: string;
    headers?: unknown;
    data?: unknown;
  }) => Promise<MockResponse<T>>,
) => {
  (client as unknown as { http: { request: typeof impl } }).http = { request: impl };
};

describe("OpenRouterClient", () => {
  it("retries twice and recovers on third attempt", async () => {
    const client = new OpenRouterClient({ apiKey: "test-key", retries: 2 });
    let callCount = 0;

    setMockRequest(client, async (config) => {
      callCount += 1;

      if (callCount < 3) {
        throw new AxiosError("temporary failure", "ERR_BAD_RESPONSE", undefined, undefined, {
          data: { error: "temporary" },
          status: 500,
          statusText: "Internal Server Error",
          headers: {},
          config: { headers: new AxiosHeaders() },
        });
      }

      expect(config.method).toBe("POST");
      expect(config.url).toBe("/v1/chat/completions");

      return {
        data: {
          choices: [{ message: { content: '{"ok":true,"source":"third-attempt"}' } }],
        },
      };
    });

    const result = await client.generateJson("give me json");
    expect(callCount).toBe(3);
    expect(result).toEqual({ ok: true, source: "third-attempt" });
  });
});
