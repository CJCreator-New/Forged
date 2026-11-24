import { describe, expect, it } from "vitest";
import channels from "../../../config/channels.json";
import models from "../../../config/models.json";
import { ChannelsConfigSchema, ModelsConfigSchema, StyleSchema } from "./config";
import { DeckSchema } from "./deck";
import { IdeasSchema } from "./ideas";
import { LogRowSchema } from "./log";
import { PostFrontmatterSchema } from "./post";
import conversational from "../../../config/styles/conversational.json";
import analytical from "../../../config/styles/analytical.json";
import storytelling from "../../../config/styles/storytelling.json";
import direct from "../../../config/styles/direct.json";

const validPost = {
  id: "2026-11-24-linkedin",
  channel: "linkedin",
  status: "draft",
  topic: "AI",
  angle: "Ops teams are automating the wrong step",
  format: "text",
  model: "nvidia/nemotron-3-ultra-550b-a55b:free",
  created: "2026-11-24T09:00:00+05:30",
  length: "medium",
  style: "direct",
  humanise: "inherit",
  humanised: true,
  variant_index: 1,
  selected: true,
  rendered: false,
  edit_rating: null,
  review_required: false,
  stale: false,
  lint: { hard: [], soft: [] },
};

const validDeck = {
  deck_id: "2026-11-24-instagram-01",
  channel: "instagram",
  size: { w: 1080, h: 1350 },
  theme: "dark-tech",
  colors: { bg: "#0b1220", text: "#f5f7fa", accent: "#4fd1c5", muted: "#8a94a6" },
  styling: { corner: "rounded", card: "flat", padding: "medium" },
  slides: [
    { type: "cover", title: "Short title", body: "One line" },
    { type: "point", title: "Point", body: "a\nb\nc" },
    { type: "point", title: "Point", body: "x" },
    { type: "point", title: "Point", body: "x" },
    { type: "point", title: "Point", body: "x" },
    { type: "point", title: "Point", body: "x" },
    { type: "cta", title: "Question for the reader", body: "" },
  ],
};

describe("config contracts", () => {
  it("channels.json matches the channel config shape", () => {
    expect(() => ChannelsConfigSchema.parse(channels)).not.toThrow();
  });

  it("linkedin hard max is confirmed, instagram and facebook are provisional", () => {
    expect(channels.linkedin.hard_max_provisional).toBe(false);
    expect(channels.instagram.hard_max_provisional).toBe(true);
    expect(channels.facebook.hard_max_provisional).toBe(true);
  });

  it("models.json matches the model config shape", () => {
    expect(() => ModelsConfigSchema.parse(models)).not.toThrow();
  });

  it("the four style presets match the style shape", () => {
    for (const s of [conversational, analytical, storytelling, direct]) {
      expect(() => StyleSchema.parse(s)).not.toThrow();
    }
  });
});

describe("schema contracts", () => {
  it("accepts a valid post frontmatter", () => {
    expect(PostFrontmatterSchema.parse(validPost).channel).toBe("linkedin");
  });

  it("rejects a post frontmatter with the old platform key", () => {
    const bad = { ...validPost, platform: "linkedin" } as Record<string, unknown>;
    delete bad.channel;
    expect(() => PostFrontmatterSchema.parse(bad)).toThrow();
  });

  it("accepts ideas with 5 to 10 angles of 3 hooks each", () => {
    const angle = {
      title: "t",
      hooks: ["a", "b", "c"],
      format: "text",
      why_it_could_travel: "w",
      source_urls: [],
    };
    expect(IdeasSchema.parse([angle, angle, angle, angle, angle])).toHaveLength(5);
    expect(() => IdeasSchema.parse([angle, angle])).toThrow();
  });

  it("accepts a valid 7-slide deck", () => {
    expect(DeckSchema.parse(validDeck).slides).toHaveLength(7);
  });

  it("rejects a deck whose first slide is not cover, or whose body has more than 3 lines", () => {
    const noCover = { ...validDeck, slides: validDeck.slides.map((s, i) => (i === 0 ? { ...s, type: "point" } : s)) };
    expect(() => DeckSchema.parse(noCover)).toThrow(/cover/);
    const longBody = {
      ...validDeck,
      slides: validDeck.slides.map((s, i) => (i === 1 ? { ...s, body: "1\n2\n3\n4" } : s)),
    };
    expect(() => DeckSchema.parse(longBody)).toThrow(/3 lines/);
  });

  it("does not accept Facebook as a deck channel", () => {
    expect(() => DeckSchema.parse({ ...validDeck, channel: "facebook" })).toThrow();
  });

  it("accepts a log row with an empty reach, which does not count toward the threshold", () => {
    const row = LogRowSchema.parse({
      date: "2026-11-24",
      post_id: "x",
      channel: "linkedin",
      topic: "AI",
      format: "text",
      length: "medium",
      variant: 1,
      minutes: 12,
      edit_rating: "light",
      reach: null,
      followers: null,
    });
    expect(row.reach).toBeNull();
  });
});
