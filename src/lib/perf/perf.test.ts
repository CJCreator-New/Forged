import { describe, it, expect, vi, afterEach } from "vitest";
import type { LogRow } from "../schemas/log";
import { rank, resetPerformance } from "./perf";

function makeRow(overrides: Partial<LogRow> = {}): LogRow {
  return {
    date: "2026-11-01",
    post_id: "p-001",
    channel: "linkedin",
    topic: "AI",
    format: "carousel",
    length: "short",
    variant: 1,
    minutes: 10,
    edit_rating: "as-is",
    reach: 1000,
    followers: 50,
    ...overrides,
  };
}

function makeRows(count: number, overrides: Partial<LogRow> = {}): LogRow[] {
  return Array.from({ length: count }, (_, i) =>
    makeRow({ post_id: `p-${String(i + 1).padStart(3, "0")}`, ...overrides }),
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("rank threshold", () => {
  it("returns unranked with 1 needed for 19 rows with reach", () => {
    const result = rank(makeRows(19));
    expect(result).toEqual({ logged: 19, needed: 1, ranked: false });
  });

  it("ranks once 20 rows have reach", () => {
    const result = rank(makeRows(20));
    expect(result.logged).toBe(20);
    expect(result.needed).toBe(0);
    expect(result.ranked).not.toBe(false);
  });

  it("never counts rows whose reach is null toward logged", () => {
    const rows = [...makeRows(15), ...makeRows(10, { reach: null, topic: "Food" })];
    const result = rank(rows);
    expect(result).toEqual({ logged: 15, needed: 5, ranked: false });
  });
});

describe("rank groups", () => {
  it("drops groups with fewer than minGroup rows", () => {
    const rows = [
      ...makeRows(18, { topic: "AI", format: "carousel", reach: 1000 }),
      makeRow({ post_id: "x-1", topic: "Food", format: "text", reach: 5000 }),
      makeRow({ post_id: "x-2", topic: "Food", format: "text", reach: 5000 }),
    ];
    const result = rank(rows);
    expect(result.ranked).not.toBe(false);
    if (result.ranked === false) return;
    expect(result.ranked.map((g) => g.topic)).toEqual(["AI"]);
    expect(result.ranked.some((g) => g.topic === "Food")).toBe(false);
  });

  it("builds a plain-English reason with count, format, topic and rounded average", () => {
    const rows = [
      ...makeRows(16, { topic: "Hiring", format: "text", reach: 10 }),
      makeRow({ post_id: "a-1", topic: "AI", format: "carousel", reach: 1000 }),
      makeRow({ post_id: "a-2", topic: "AI", format: "carousel", reach: 1200 }),
      makeRow({ post_id: "a-3", topic: "AI", format: "carousel", reach: 1400 }),
      makeRow({ post_id: "a-4", topic: "AI", format: "carousel", reach: 1200.4 }),
    ];
    const result = rank(rows);
    if (result.ranked === false) throw new Error("expected ranking");
    const ai = result.ranked.find((g) => g.topic === "AI");
    expect(ai?.count).toBe(4);
    expect(ai?.reason).toBe("your last 4 carousel posts on AI averaged 1,200 reach");
  });

  it("sorts groups by average reach, highest first", () => {
    const rows = [
      ...makeRows(3, { topic: "Low", format: "text", reach: 100 }),
      ...makeRows(3, { topic: "High", format: "text", reach: 900 }),
      ...makeRows(3, { topic: "Mid", format: "text", reach: 500 }),
      ...makeRows(11, { topic: "Filler", format: "carousel", reach: 1 }),
    ];
    const result = rank(rows);
    if (result.ranked === false) throw new Error("expected ranking");
    expect(result.ranked.map((g) => g.topic)).toEqual(["High", "Mid", "Low", "Filler"]);
  });

  it("breaks reach ties with the higher average edit rating first", () => {
    const rows = [
      ...makeRows(3, { topic: "Rewritten", format: "text", reach: 800, edit_rating: "rewrite" }),
      ...makeRows(3, { topic: "AsIs", format: "text", reach: 800, edit_rating: "as-is" }),
      ...makeRows(14, { topic: "Filler", format: "carousel", reach: 1, edit_rating: "light" }),
    ];
    const result = rank(rows);
    if (result.ranked === false) throw new Error("expected ranking");
    const topics = result.ranked.map((g) => g.topic);
    expect(topics.indexOf("AsIs")).toBeLessThan(topics.indexOf("Rewritten"));
    const asIs = result.ranked.find((g) => g.topic === "AsIs");
    expect(asIs?.averageRating).toBe(3);
  });

  it("counts a null edit rating as 0 in the average rating", () => {
    const rows = [
      ...makeRows(3, { topic: "Unrated", format: "text", reach: 800, edit_rating: null }),
      ...makeRows(17, { topic: "Filler", format: "carousel", reach: 1, edit_rating: "light" }),
    ];
    const result = rank(rows);
    if (result.ranked === false) throw new Error("expected ranking");
    const unrated = result.ranked.find((g) => g.topic === "Unrated");
    expect(unrated?.averageRating).toBe(0);
  });
});

describe("determinism and network", () => {
  it("gives identical output for the same input twice", () => {
    const rows = [
      ...makeRows(10, { topic: "AI", format: "carousel", reach: 1200, edit_rating: "light" }),
      ...makeRows(10, { topic: "Hiring", format: "text", reach: 900, edit_rating: "as-is" }),
    ];
    const first = rank(rows);
    const second = rank(rows);
    expect(second).toEqual(first);
  });

  it("never calls fetch while ranking", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    rank(makeRows(25, { reach: 500 }));
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("resetPerformance", () => {
  it("clears reach and followers, keeps row count and identity fields", () => {
    const rows = [
      makeRow({ post_id: "keep-1", topic: "AI", channel: "instagram", reach: 1200, followers: 40 }),
      makeRow({ post_id: "keep-2", topic: "Hiring", channel: "facebook", reach: null, followers: null }),
    ];
    const before = JSON.parse(JSON.stringify(rows)) as LogRow[];
    const after = resetPerformance(rows);

    expect(after).toHaveLength(rows.length);
    expect(after.map((r) => r.reach)).toEqual([null, null]);
    expect(after.map((r) => r.followers)).toEqual([null, null]);
    expect(after.map((r) => r.post_id)).toEqual(["keep-1", "keep-2"]);
    expect(after.map((r) => r.topic)).toEqual(["AI", "Hiring"]);
    expect(after.map((r) => r.channel)).toEqual(["instagram", "facebook"]);
    expect(rows).toEqual(before);
  });
});
