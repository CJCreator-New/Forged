import type { LintContext } from "./index";

export interface LintFixture {
  rule: string;
  id: string;
  text: string;
  ctx: LintContext;
  expect: "hard" | "soft" | "clean";
}

const LI: LintContext = { channel: "linkedin", topic: "AI operations" };
const IG: LintContext = { channel: "instagram", topic: "AI operations" };
const FB: LintContext = { channel: "facebook", topic: "AI operations" };
const HEALTH: LintContext = { channel: "linkedin", topic: "Healthcare operations" };
const HR: LintContext = { channel: "linkedin", topic: "HR and people management" };

export const FIXTURES: LintFixture[] = [
  // H1 emojis
  { rule: "emojis", id: "H1", text: "Shipping the new checklist today \u{1F680}", ctx: LI, expect: "hard" },
  { rule: "emojis", id: "H1", text: "Team wins \u{1F44D}\u{1F3FD} thanks everyone", ctx: LI, expect: "hard" },
  { rule: "emojis", id: "H1", text: "Family photo \u{1F468}‍\u{1F469}‍\u{1F467} from the offsite", ctx: LI, expect: "hard" },
  { rule: "emojis", id: "H1", text: "Shipping the new checklist today with the ops team.", ctx: LI, expect: "clean" },
  { rule: "emojis", id: "H1", text: "Three lessons from a quarter of supplier calls.", ctx: LI, expect: "clean" },
  { rule: "emojis", id: "H1", text: "Plain text with numbers 1 2 3 and symbols like % and & only.", ctx: LI, expect: "clean" },

  // H2 em and en dashes
  { rule: "em dash and en dash", id: "H2", text: "Our pilot cut onboarding time \u2014 by half.", ctx: LI, expect: "hard" },
  { rule: "em dash and en dash", id: "H2", text: "Shift handovers went from 40 minutes \u2013 to 10.", ctx: LI, expect: "hard" },
  { rule: "em dash and en dash", id: "H2", text: "Three things we learned\u2014and one we did not.", ctx: LI, expect: "hard" },
  { rule: "em dash and en dash", id: "H2", text: "Our pilot cut onboarding time by half, and we kept the notes.", ctx: LI, expect: "clean" },
  { rule: "em dash and en dash", id: "H2", text: "Shift handovers went from 40 minutes to 10 minutes.", ctx: LI, expect: "clean" },
  { rule: "em dash and en dash", id: "H2", text: "Use a hyphen-separated tag like well-known in text.", ctx: LI, expect: "clean" },

  // H3 engagement bait
  { rule: "engagement bait", id: "H3", text: "Our new process saves two hours a week. Comment YES if you want the template.", ctx: LI, expect: "hard" },
  { rule: "engagement bait", id: "H3", text: "Tag a friend who runs a warehouse.", ctx: LI, expect: "hard" },
  { rule: "engagement bait", id: "H3", text: "Share if you agree that onboarding is broken.", ctx: LI, expect: "hard" },
  { rule: "engagement bait", id: "H3", text: "Our new process saves two hours a week. The checklist is in the notes.", ctx: LI, expect: "clean" },
  { rule: "engagement bait", id: "H3", text: "Here is what we changed in the handover.", ctx: LI, expect: "clean" },
  { rule: "engagement bait", id: "H3", text: "Comments are welcome, and I read every one.", ctx: LI, expect: "clean" },

  // H4 medical claims (health topics only)
  { rule: "medical claims", id: "H4", text: "This routine cures back pain in a week.", ctx: HEALTH, expect: "hard" },
  { rule: "medical claims", id: "H4", text: "Our plan gives guaranteed results for sleep.", ctx: HEALTH, expect: "hard" },
  { rule: "medical claims", id: "H4", text: "The method is clinically proven to lower blood pressure.", ctx: HEALTH, expect: "hard" },
  { rule: "medical claims", id: "H4", text: "This routine helps many people sleep better.", ctx: HEALTH, expect: "clean" },
  { rule: "medical claims", id: "H4", text: "The method is clinically proven to lower blood pressure (source: trial report 2024).", ctx: HEALTH, expect: "clean" },
  { rule: "medical claims", id: "H4", text: "Talk to your doctor before changing your routine.", ctx: HEALTH, expect: "clean" },

  // H5 character limits
  { rule: "character limits", id: "H5", text: "word ".repeat(700), ctx: LI, expect: "hard" },
  { rule: "character limits", id: "H5", text: "Short caption about the pilot.", ctx: { ...IG, hookText: "x".repeat(130) }, expect: "hard" },
  { rule: "character limits", id: "H5", text: "Caption line. ".repeat(200), ctx: IG, expect: "hard" },
  { rule: "character limits", id: "H5", text: "Short post about onboarding.", ctx: LI, expect: "clean" },
  { rule: "character limits", id: "H5", text: "Onboarding notes. ".repeat(70), ctx: LI, expect: "clean" },
  { rule: "character limits", id: "H5", text: "Caption about the pilot.", ctx: { ...IG, hookText: "Our pilot cut onboarding time by half this quarter." }, expect: "clean" },

  // S1 AI-tell words
  { rule: "AI-tell words", id: "S1", text: "We can leverage the checklist to speed up handovers.", ctx: LI, expect: "soft" },
  { rule: "AI-tell words", id: "S1", text: "This tool is a game-changer for small warehouses.", ctx: LI, expect: "soft" },
  { rule: "AI-tell words", id: "S1", text: "Here’s the thing: most onboarding fails in week one.", ctx: LI, expect: "soft" },
  { rule: "AI-tell words", id: "S1", text: "We use the checklist to speed up handovers.", ctx: LI, expect: "clean" },
  { rule: "AI-tell words", id: "S1", text: "Small warehouses need a simple handover sheet.", ctx: LI, expect: "clean" },
  { rule: "AI-tell words", id: "S1", text: "Most onboarding fails in week one, and the fix is simple.", ctx: LI, expect: "clean" },

  // S2 hook longer than the visible limit
  { rule: "hook length", id: "S2", text: "Onboarding notes help. ".repeat(10), ctx: LI, expect: "soft" },
  { rule: "hook length", id: "S2", text: "a ".repeat(70), ctx: IG, expect: "soft" },
  { rule: "hook length", id: "S2", text: "Night crew handover notes matter. ".repeat(6), ctx: FB, expect: "soft" },
  { rule: "hook length", id: "S2", text: "Short hook. Then the body.", ctx: LI, expect: "clean" },
  { rule: "hook length", id: "S2", text: "Caption about the pilot.", ctx: { ...IG, hookText: "Our pilot cut onboarding time by half." }, expect: "clean" },
  { rule: "hook length", id: "S2", text: "We cut the handover from forty minutes to ten.", ctx: FB, expect: "clean" },

  // S4 hashtag count
  { rule: "hashtag count", id: "S4", text: "Post body about handovers.", ctx: { ...LI, hashtagCount: 4 }, expect: "soft" },
  { rule: "hashtag count", id: "S4", text: "Post body about handovers.", ctx: { ...IG, hashtagCount: 2 }, expect: "soft" },
  { rule: "hashtag count", id: "S4", text: "Post body about handovers.", ctx: { ...FB, hashtagCount: 3 }, expect: "soft" },
  { rule: "hashtag count", id: "S4", text: "Post body about handovers.", ctx: { ...LI, hashtagCount: 2 }, expect: "clean" },
  { rule: "hashtag count", id: "S4", text: "Post body about handovers.", ctx: { ...IG, hashtagCount: 4 }, expect: "clean" },
  { rule: "hashtag count", id: "S4", text: "Post body about handovers.", ctx: { ...FB, hashtagCount: 0 }, expect: "clean" },

  // S5 possible names or employers (HR and people topics)
  { rule: "possible name or employer", id: "S5", text: "Last week Priya Sharma joined the ops team.", ctx: HR, expect: "soft" },
  { rule: "possible name or employer", id: "S5", text: "The reason was that Acme Foods changed its policy.", ctx: HR, expect: "soft" },
  { rule: "possible name or employer", id: "S5", text: "We asked Ravi Kumar to lead the pilot.", ctx: HR, expect: "soft" },
  { rule: "possible name or employer", id: "S5", text: "Priya Sharma wrote this post herself.", ctx: HR, expect: "clean" },
  { rule: "possible name or employer", id: "S5", text: "Our team hires slowly and trains well.", ctx: HR, expect: "clean" },
  { rule: "possible name or employer", id: "S5", text: "Onboarding works best when managers check in weekly.", ctx: HR, expect: "clean" },
];
