import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { callJson, callModel, gatewayStatus } from "./index";

const SECRET = "test-key-123";

function ok(content: string): Response {
  return new Response(
    JSON.stringify({
      choices: [{ message: { content } }],
      usage: { prompt_tokens: 3, completion_tokens: 4, total_tokens: 7 },
    }),
    { status: 200 },
  );
}

function status(code: number): Response {
  return new Response("upstream body", { status: code });
}

let fetchMock: ReturnType<typeof vi.fn>;
let logs: ReturnType<typeof vi.spyOn>[];

beforeEach(() => {
  process.env.OPENROUTER_API_KEY = SECRET;
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  logs = [
    vi.spyOn(console, "log").mockImplementation(() => {}),
    vi.spyOn(console, "error").mockImplementation(() => {}),
    vi.spyOn(console, "warn").mockImplementation(() => {}),
  ];
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete process.env.OPENROUTER_API_KEY;
});

function allLogged(): string {
  return logs.map((s) => JSON.stringify(s.mock.calls)).join("");
}

describe("callModel", () => {
  it("falls back on 429 and records attempts", async () => {
    fetchMock.mockResolvedValueOnce(status(429)).mockResolvedValueOnce(ok("hello"));
    const res = await callModel("ideas", { user: "hi" });
    expect(res.text).toBe("hello");
    expect(res.attempts).toHaveLength(2);
    expect(res.model).toBe(res.attempts[1]);
    expect(res.usage.totalTokens).toBe(7);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("moves past a 5xx and succeeds", async () => {
    fetchMock.mockResolvedValueOnce(status(503)).mockResolvedValueOnce(ok("fine"));
    const res = await callModel("pillar", { system: "s", user: "u" });
    expect(res.text).toBe("fine");
    expect(res.attempts).toHaveLength(2);
  });

  it("throws naming the variable when the key is missing, without any key value", async () => {
    delete process.env.OPENROUTER_API_KEY;
    await expect(callModel("ideas", { user: "hi" })).rejects.toThrow("OPENROUTER_API_KEY");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("never leaks the key into console output or error messages", async () => {
    fetchMock.mockResolvedValueOnce(status(500)).mockResolvedValueOnce(ok("fine"));
    await callModel("ideas", { user: "hi" });
    fetchMock.mockImplementation(async () => status(500));
    let message = "";
    try {
      await callModel("ideas", { user: "hi" });
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).not.toContain(SECRET);
    expect(allLogged()).not.toContain(SECRET);
    expect(allLogged()).not.toContain("hi\"");
  });

  it("reports key presence as booleans only", () => {
    const s = gatewayStatus();
    expect(s.openrouter).toBe(true);
    expect(JSON.stringify(s)).not.toContain(SECRET);
  });
});

describe("callJson", () => {
  const schema = z.object({ n: z.number() });

  it("retries once on bad JSON then succeeds, stripping code fences", async () => {
    fetchMock.mockResolvedValueOnce(ok("not json")).mockResolvedValueOnce(ok("```json\n{\"n\": 5}\n```"));
    const out = await callJson("ideas", { user: "u" }, schema);
    expect(out).toEqual({ n: 5 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws after two bad outputs without echoing the raw output", async () => {
    fetchMock.mockImplementation(async () => ok("RAW-MODEL-OUTPUT"));
    let message = "";
    try {
      await callJson("ideas", { user: "u" }, schema);
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toContain("JSON validation failed");
    expect(message).not.toContain("RAW-MODEL-OUTPUT");
    expect(allLogged()).not.toContain("RAW-MODEL-OUTPUT");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries on schema mismatch then throws the zod message", async () => {
    fetchMock.mockImplementation(async () => ok("{\"n\": \"x\"}"));
    await expect(callJson("ideas", { user: "u" }, schema)).rejects.toThrow(/number/);
  });
});
