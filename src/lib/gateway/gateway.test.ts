import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import modelsConfig from "../../../config/models.json";
import { setLogSink } from "./log";
import { getOpenRouterKey } from "./keys";
import { chat } from "./openrouter";
import { checkKey } from "./keyStatus";
import { fetchModels } from "./models";
import { runWithFallback } from "./fallback";
import { parseAndValidate, runJson } from "./json";

const FAKE_KEY = "sk-test-SECRET-123";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function completion(text: string, tokens = 42): Response {
  return jsonResponse({
    choices: [{ message: { role: "assistant", content: text } }],
    usage: { total_tokens: tokens },
  });
}

function mockFetch(...responses: Response[]) {
  const fn = vi.fn();
  for (const r of responses) fn.mockResolvedValueOnce(r);
  return fn;
}

// Mocked fetch only. No test in this file reaches the network.
const asFetch = (fn: ReturnType<typeof vi.fn>) => fn as unknown as typeof fetch;

let logLines: string[] = [];

beforeEach(() => {
  logLines = [];
  setLogSink({ write: (line) => logLines.push(line) });
  process.env.OPENROUTER_API_KEY = FAKE_KEY;
});

afterEach(() => {
  delete process.env.OPENROUTER_API_KEY;
  vi.restoreAllMocks();
});

describe("keys", () => {
  it("throws missing_key with the key name and no value when the key is unset", () => {
    delete process.env.OPENROUTER_API_KEY;
    let caught: unknown;
    try {
      getOpenRouterKey();
    } catch (err) {
      caught = err;
    }
    expect(caught).toMatchObject({ code: "missing_key", key: "OPENROUTER_API_KEY" });
    expect(String((caught as Error).message)).not.toContain(FAKE_KEY);
  });

  it("chat makes no fetch call when the key is missing", async () => {
    delete process.env.OPENROUTER_API_KEY;
    const fetchImpl = mockFetch();
    await expect(
      chat("some/model:free", [{ role: "user", content: "hi" }], { fetchImpl: asFetch(fetchImpl) }),
    ).rejects.toMatchObject({ code: "missing_key" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("chat", () => {
  it("returns text on 200, logs once, and never logs the key value", async () => {
    const fetchImpl = mockFetch(completion("hello there", 99));

    const result = await chat("test/model:free", [{ role: "user", content: "hi" }], {
      fetchImpl: asFetch(fetchImpl),
    });

    expect(result).toEqual({ text: "hello there", model: "test/model:free", tokens: 99, status: 200 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${FAKE_KEY}`);

    expect(logLines).toHaveLength(1);
    const line = logLines[0];
    expect(line).toContain("test/model:free");
    expect(line).toContain("200");
    expect(logLines.join("\n")).not.toContain(FAKE_KEY);
  });

  it("logs the 429 status and throws rate_limited", async () => {
    const fetchImpl = mockFetch(jsonResponse({ error: "slow down" }, 429));
    await expect(
      chat("test/model:free", [{ role: "user", content: "hi" }], { fetchImpl: asFetch(fetchImpl) }),
    ).rejects.toMatchObject({ code: "rate_limited" });
    expect(logLines).toHaveLength(1);
    expect(logLines[0]).toContain("429");
    expect(logLines.join("\n")).not.toContain(FAKE_KEY);
  });

  it("throws timeout when fetch is aborted", async () => {
    const fetchImpl = vi.fn().mockRejectedValueOnce(Object.assign(new Error("aborted"), { name: "AbortError" }));
    await expect(
      chat("test/model:free", [{ role: "user", content: "hi" }], { fetchImpl: asFetch(fetchImpl) }),
    ).rejects.toMatchObject({ code: "timeout" });
    expect(logLines).toHaveLength(1);
  });
});

describe("runWithFallback", () => {
  it("moves from a 429 on the primary to the fallback and reports both", async () => {
    const task = modelsConfig.tasks.ideas;
    const primary = task.primary;
    const second = task.fallback[0];

    const fetchImpl = mockFetch(jsonResponse({}, 429), completion("angles here"));

    const result = await runWithFallback("ideas", [{ role: "user", content: "topic" }], {
      fetchImpl: asFetch(fetchImpl),
    });

    expect(result).toEqual({ text: "angles here", model_used: second, fallback_from: primary });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const bodies = fetchImpl.mock.calls.map((c) => JSON.parse((c[1] as RequestInit).body as string).model);
    expect(bodies).toEqual([primary, second]);
  });

  it("throws a non-rate error at once without trying the fallback", async () => {
    const fetchImpl = mockFetch(jsonResponse({ error: "bad" }, 400));
    await expect(
      runWithFallback("ideas", [{ role: "user", content: "topic" }], { fetchImpl: asFetch(fetchImpl) }),
    ).rejects.toMatchObject({ code: "provider_error" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe("parseAndValidate and runJson", () => {
  const schema = z.object({ angles: z.array(z.string()) });

  it("succeeds after one retry when the first reply is invalid JSON", async () => {
    const fetchImpl = mockFetch(completion("this is not json"), completion('```json\n{"angles":["a"]}\n```'));

    const result = await runJson("ideas", [{ role: "user", content: "topic" }], schema, {
      fetchImpl: asFetch(fetchImpl),
    });

    expect(result.data).toEqual({ angles: ["a"] });
    expect(fetchImpl).toHaveBeenCalledTimes(2);

    const retryBody = JSON.parse((fetchImpl.mock.calls[1][1] as RequestInit).body as string);
    expect(retryBody.messages.at(-1).role).toBe("user");
    expect(retryBody.messages.at(-2)).toEqual({ role: "assistant", content: "this is not json" });
  });

  it("throws invalid_output when the retry is also invalid", async () => {
    const fetchImpl = mockFetch(completion("nope"), completion("still nope"));
    await expect(
      runJson("ideas", [{ role: "user", content: "topic" }], schema, { fetchImpl: asFetch(fetchImpl) }),
    ).rejects.toMatchObject({ code: "invalid_output" });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("parseAndValidate calls retry exactly once on schema failure", async () => {
    const retry = vi.fn().mockResolvedValueOnce('{"angles":["ok"]}');
    const value = await parseAndValidate('{"angles":"wrong"}', schema, retry);
    expect(value).toEqual({ angles: ["ok"] });
    expect(retry).toHaveBeenCalledTimes(1);
  });
});

describe("checkKey", () => {
  it("makes exactly one call, to /api/v1/key, and no chat call", async () => {
    const fetchImpl = mockFetch(jsonResponse({ data: { is_free_tier: true, limit_remaining: 5, usage: 1, label: "x" } }));

    const status = await checkKey({ fetchImpl: asFetch(fetchImpl) });

    expect(status).toEqual({ valid: true, isFreeTier: true, limitRemaining: 5 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const url = fetchImpl.mock.calls[0][0] as string;
    expect(url).toMatch(/\/api\/v1\/key$/);
    expect(fetchImpl.mock.calls.some((c) => String(c[0]).includes("/chat/completions"))).toBe(false);
  });

  it("returns valid false on 401", async () => {
    const fetchImpl = mockFetch(jsonResponse({ error: "no" }, 401));
    await expect(checkKey({ fetchImpl: asFetch(fetchImpl) })).resolves.toEqual({
      valid: false,
      isFreeTier: false,
      limitRemaining: null,
    });
  });
});

describe("fetchModels", () => {
  it("marks a 0/0 price model as free and a paid model as not free", async () => {
    const fetchImpl = mockFetch(
      jsonResponse({
        data: [
          { id: "vendor/free-one:free", name: "Free One", pricing: { prompt: "0", completion: "0" } },
          { id: "vendor/paid-one", name: "Paid One", pricing: { prompt: "0.000001", completion: "0.000002" } },
        ],
      }),
    );

    const models = await fetchModels({ fetchImpl: asFetch(fetchImpl) });

    expect(models).toEqual([
      { id: "vendor/free-one:free", name: "Free One", free: true },
      { id: "vendor/paid-one", name: "Paid One", free: false },
    ]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
