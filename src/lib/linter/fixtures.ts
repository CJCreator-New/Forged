// Fixtures for the linter tests. Emoji and em dash characters are written as escapes.

export interface Fixtures {
  good: string[];
  bad: string[];
}

export const H1: Fixtures = {
  good: [
    "Plain sentence with no symbols.",
    "Our team raised a red flag about the schedule.",
    "Costs went up 5% & we noted it (see page 3): fine.",
  ],
  bad: [
    "Great news \u{1F600}",
    "Thumbs up \u{1F44D}\u{1F3FD} for the team",
    "Family time \u{1F468}\u200D\u{1F469}\u200D\u{1F467} matters",
    "Proud moment \u{1F1EE}\u{1F1F3} today",
    "Heart \u2764\uFE0F noted",
  ],
};

export const H2: Fixtures = {
  good: ["A hyphen - is fine.", "Use a comma, or a colon: both fine.", "Range 10-20 is fine."],
  bad: ["This is wrong \u2014 very wrong.", "One\u2014two", "\u2014 starts with it"],
};

export const H3: Fixtures = {
  good: [
    "What do you think about this approach?",
    "I like clear weather plans.",
    "Share your own story when you are ready.",
  ],
  bad: ["Comment YES if you agree", "Please tag a friend who needs this", "Tag someone who hires", "Share if you agree", "Like if you agree", "Double tap if you relate", "Comment below if you want the template"],
};

export const H4: Fixtures = {
  good: [
    "Sleep habits can support recovery.",
    "Clinically proven in a trial. Source: https://example.org/trial",
    "He secures the building every night.",
  ],
  bad: [
    "This herb cures anxiety.",
    "Guaranteed results in 7 days.",
    "This app replaces your doctor.",
    "A clinically proven method for everyone.",
  ],
};

export const H5: Fixtures = {
  good: ["a".repeat(3000), "short post", "b".repeat(2000)],
  bad: ["a".repeat(3001), "a".repeat(5000), "a".repeat(3500)],
};

export const H5_INSTAGRAM: Fixtures = {
  good: ["a".repeat(2200), "short caption", "c".repeat(1000)],
  bad: ["a".repeat(2201), "a".repeat(3000), "a".repeat(2500)],
};

/** Length tier fixtures keyed by platform and tier. */
export const LENGTH_GOOD: Record<string, string> = {
  "linkedin-short": "a".repeat(450),
  "linkedin-medium": "a".repeat(900),
  "linkedin-long": "a".repeat(1500),
  "instagram-short": "a".repeat(100),
  "instagram-medium": "a".repeat(300),
  "instagram-long": "a".repeat(800),
  "facebook-short": Array(30).fill("word").join(" "),
  "facebook-medium": Array(100).fill("word").join(" "),
  "facebook-long": Array(200).fill("word").join(" "),
};

export const LENGTH_BAD: Record<string, string> = {
  "linkedin-short": "a".repeat(100),
  "linkedin-medium": "a".repeat(2500),
  "linkedin-long": "a".repeat(1000),
  "instagram-short": "a".repeat(300),
  "instagram-medium": "a".repeat(50),
  "instagram-long": "a".repeat(1500),
  "facebook-short": Array(100).fill("word").join(" "),
  "facebook-medium": Array(5).fill("word").join(" "),
  "facebook-long": Array(400).fill("word").join(" "),
};

export const CLEAN_POST =
  "Our onboarding checklist now fits on one page. New hires finish it in two days. What would you cut from yours?";
