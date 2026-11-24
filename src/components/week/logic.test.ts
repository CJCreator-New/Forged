import { describe, expect, it } from "vitest";
import {
  cardBadges,
  countCards,
  countOf,
  countSourceMarkers,
  countWords,
  currentWeekId,
  dayPathOf,
  exportDisabledReason,
  groupWeekDays,
  highlightSegments,
  isoWeekIdFromDate,
  mondayOfWeek,
  plainWeekError,
  statusLabel,
  staleMessage,
  summariseAdapt,
  validateBrief,
  weekDates,
} from "./logic";
import type { ViewDay } from "./types";

describe("ISO week ids", () => {
  it("maps 24 Nov 2026 to week 48 with Monday 23 Nov", () => {
    expect(isoWeekIdFromDate("2026-11-24")).toBe("2026-W48");
    expect(mondayOfWeek("2026-W48")).toBe("2026-11-23");
  });

  it("puts 1 Jan 2027 in week 53 of 2026", () => {
    expect(isoWeekIdFromDate("2027-01-01")).toBe("2026-W53");
  });

  it("puts 30 Dec 2024 in week 1 of 2025", () => {
    expect(isoWeekIdFromDate("2024-12-30")).toBe("2025-W01");
  });

  it("rejects week 53 in a year that only has 52 weeks", () => {
    expect(mondayOfWeek("2025-W53")).toBeNull();
  });

  it("rejects invalid dates and ids", () => {
    expect(isoWeekIdFromDate("2026-02-30")).toBeNull();
    expect(isoWeekIdFromDate("not a date")).toBeNull();
    expect(mondayOfWeek("2026-48")).toBeNull();
  });

  it("returns seven dates from Monday to Sunday", () => {
    expect(weekDates("2026-W48")).toEqual([
      "2026-11-23",
      "2026-11-24",
      "2026-11-25",
      "2026-11-26",
      "2026-11-27",
      "2026-11-28",
      "2026-11-29",
    ]);
    expect(weekDates("bogus")).toEqual([]);
  });

  it("uses the local calendar day for the current week", () => {
    expect(currentWeekId(new Date(2026, 10, 24, 0, 30))).toBe("2026-W48");
  });
});

describe("status labels", () => {
  it("maps each status to its plain English label", () => {
    expect(statusLabel("draft")).toBe("Draft");
    expect(statusLabel("reviewed")).toBe("Reviewed");
    expect(statusLabel("rendered")).toBe("Rendered");
    expect(statusLabel("exported")).toBe("Exported");
    expect(statusLabel("weird")).toBe("Status unknown");
  });
});

describe("card badges", () => {
  it("shows nothing for a clean card", () => {
    expect(cardBadges({ hardCount: 0, stale: false, reviewRequired: false })).toEqual([]);
  });

  it("shows the red, amber and review badges in reading order", () => {
    expect(cardBadges({ hardCount: 2, stale: true, reviewRequired: true })).toEqual([
      { tone: "must-fix", label: "Must fix" },
      { tone: "stale", label: "Needs a fresh write" },
      { tone: "review", label: "Review needed" },
    ]);
  });

  it("reads lint as either a list or a count", () => {
    expect(countOf(["one", "two"])).toBe(2);
    expect(countOf(3)).toBe(3);
    expect(countOf(-1)).toBe(0);
  });
});

describe("grouping the week view", () => {
  const days: ViewDay[] = [
    {
      date: "2026-11-24",
      posts: [
        {
          path: "weeks/2026-W48/days/2026-11-24/instagram.md",
          channel: "instagram",
          status: "reviewed",
          stale: true,
          lint: { hard: ["Emoji found"], soft: [] },
          review_required: true,
        },
        {
          path: "weeks/2026-W48/days/2026-11-24/linkedin.md",
          channel: "linkedin",
          status: "draft",
          stale: false,
          lint: { hard: 0, soft: 1 },
        },
      ],
    },
  ];

  it("always returns seven columns with three channel slots each", () => {
    const columns = groupWeekDays("2026-W48", days);
    expect(columns).toHaveLength(7);
    expect(columns.every((column) => column.slots.length === 3)).toBe(true);
    expect(columns[0].date).toBe("2026-11-23");
    expect(columns[6].date).toBe("2026-11-29");
  });

  it("places each post under its day and channel, in channel order", () => {
    const tuesday = groupWeekDays("2026-W48", days)[1];
    expect(tuesday.slots.map((slot) => slot.channel)).toEqual(["linkedin", "instagram", "facebook"]);
    expect(tuesday.slots[0].cards[0]).toMatchObject({ status: "draft", statusLabel: "Draft", hardCount: 0, softCount: 1 });
    expect(tuesday.slots[1].cards[0]).toMatchObject({ stale: true, hardCount: 1, reviewRequired: true });
    expect(tuesday.slots[2].cards).toEqual([]);
  });

  it("counts cards and reports when the export has nothing to pack", () => {
    expect(countCards(groupWeekDays("2026-W48", days))).toBe(2);
    expect(countCards(groupWeekDays("2026-W48", []))).toBe(0);
    expect(exportDisabledReason(0)).not.toBeNull();
    expect(exportDisabledReason(2)).toBeNull();
  });
});

describe("pillar text helpers", () => {
  it("counts words, ignoring extra spaces and line breaks", () => {
    expect(countWords("  one two\n\nthree   ")).toBe(3);
    expect(countWords("")).toBe(0);
  });

  it("finds source markers and splits text around them", () => {
    const text = "Sales grew [SOURCE NEEDED] in March. Hiring rose [SOURCE NEEDED].";
    expect(countSourceMarkers(text)).toBe(2);
    expect(highlightSegments(text)).toEqual([
      { text: "Sales grew ", marker: false },
      { text: "[SOURCE NEEDED]", marker: true },
      { text: " in March. Hiring rose ", marker: false },
      { text: "[SOURCE NEEDED]", marker: true },
      { text: ".", marker: false },
    ]);
  });
});

describe("brief and messages", () => {
  const complete = {
    goal: "Fill the July hiring round",
    audience: "Ops managers",
    keyPointsText: "Two roles open\n\nRemote friendly",
    callToAction: "Book a call",
    link: "",
  };

  it("accepts a complete brief", () => {
    expect(validateBrief(complete)).toEqual([]);
  });

  it("names each missing field", () => {
    const problems = validateBrief({ ...complete, goal: " ", keyPointsText: "\n", link: "example.com" });
    expect(problems).toHaveLength(3);
  });

  it("builds the stale and adapt summaries in plain words", () => {
    expect(staleMessage(0)).toBe("Saved. No posts needed a fresh write.");
    expect(staleMessage(1)).toBe("Saved. 1 post is marked Needs a fresh write.");
    expect(summariseAdapt([{ status: "written" }, { status: "skipped_user_edited" }])).toEqual({
      written: 1,
      skipped: 1,
    });
  });

  it("finds the day folder from a post path", () => {
    expect(dayPathOf("weeks/2026-W48/days/2026-11-24/linkedin.md")).toBe("weeks/2026-W48/days/2026-11-24");
  });

  it("names the missing key and never shows raw JSON", () => {
    const missing = plainWeekError({ code: "missing_key", message: "", key: "OPENROUTER_API_KEY" });
    expect(missing.detail).toContain("OPENROUTER_API_KEY");
    const raw = plainWeekError({ code: "http_500", message: "{\"error\":true}" });
    expect(raw.detail).not.toContain("{");
    expect(plainWeekError({ code: "week_exists", message: "" }).action).toBe("replace_week");
  });

  it("names the voice file path for a missing voice file", () => {
    expect(plainWeekError({ code: "voice_missing", message: "" }).detail).toContain("content/voice.md");
  });
});
