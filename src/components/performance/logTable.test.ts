import { describe, expect, it } from "vitest";
import type { LogRow } from "../../lib/schemas/log";
import { LogFormatError, parseLogTable, replaceLogTable } from "./logTable";

function row(overrides: Partial<LogRow> = {}): LogRow {
  return {
    date: "2026-11-24",
    post_id: "p-001",
    channel: "linkedin",
    topic: "AI tools",
    format: "text",
    length: "medium",
    variant: 1,
    minutes: 12.5,
    edit_rating: "light",
    reach: 1200,
    followers: 45,
    ...overrides,
  };
}

describe("log table round trip", () => {
  it("keeps every row, including blanks and a pipe inside a topic", () => {
    const rows: LogRow[] = [
      row(),
      row({ post_id: "p-002", topic: "Hiring | culture", format: "carousel", channel: "instagram" }),
      row({ post_id: "p-003", minutes: null, edit_rating: null, reach: null, followers: null, variant: 2 }),
    ];
    const body = replaceLogTable("", rows);
    expect(parseLogTable(body)).toEqual(rows);
  });

  it("keeps text around the table when it is rewritten", () => {
    const body = "# Performance log\n\nA note the user wrote.\n\n| date | post_id | channel | topic | format | length | variant | minutes | edit_rating | reach | followers |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |\n| 2026-11-24 | p-001 | linkedin | AI | text | medium | 1 |  |  |  |  |\n\nTrailing note.\n";
    const updated = replaceLogTable(body, [row({ post_id: "p-009", topic: "Ops" })]);
    expect(updated).toContain("A note the user wrote.");
    expect(updated).toContain("Trailing note.");
    expect(parseLogTable(updated).map((r) => r.post_id)).toEqual(["p-009"]);
  });

  it("returns no rows for a body without a log table", () => {
    expect(parseLogTable("# Performance log\n\nNothing yet.\n")).toEqual([]);
  });

  it("refuses a row with the wrong number of columns", () => {
    const body = replaceLogTable("", [row()]).replace("| p-001 | ", "| ");
    expect(() => parseLogTable(body)).toThrow(LogFormatError);
  });
});
