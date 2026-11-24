// Shapes the Week page expects from the Week routes. Anything docs/api-contract.md does not spell
// out is marked ASSUMED here, so a change to the contract only touches this file.
import type { PostFrontmatter } from "@/lib/schemas/post";

export type ChannelId = "linkedin" | "instagram" | "facebook";

export type ApiError = {
  code: string;
  message: string;
  key?: string;
};

// The contract gives lint as arrays. Counts are accepted too, so either shape renders.
export type LintCounts = {
  hard: string[] | number;
  soft: string[] | number;
};

export type ViewPost = {
  path: string;
  channel: string;
  status: string;
  stale: boolean;
  lint: LintCounts;
  // NOT in the contract yet. Needed for "Review needed" on healthcare and HR posts.
  review_required?: boolean;
};

export type ViewDay = {
  date: string;
  posts: ViewPost[];
};

export type WeekViewResponse = {
  days: ViewDay[];
};

// ASSUMED: the brief fields, named after docs/04 section 3 (goal, audience, key points, CTA, link).
export type Brief = {
  goal: string;
  audience: string;
  key_points: string[];
  call_to_action: string;
  link?: string;
};

// ASSUMED: POST /api/week also needs the chosen week id, and `replace` is sent only after the user confirms.
export type CreateWeekRequest = {
  brief: Brief;
  week: string;
  replace?: boolean;
};

export type CreateWeekResponse = {
  week_path: string;
};

export type BuildPillarResponse = {
  pillar_path: string;
};

// ASSUMED: GET /api/pillar?week=<id> returns the pillar body, or 404 when none exists yet.
export type PillarBodyResponse = {
  body: string;
};

export type SavePillarResponse = {
  stale_posts: string[];
};

// ASSUMED: each adapted post carries a status. "skipped_user_edited" is the one the contract names.
export type AdaptEntry = {
  path?: string;
  status: string;
};

export type AdaptResponse = {
  posts: AdaptEntry[];
};

export type PostFrontmatterResponse = {
  path: string;
  frontmatter: PostFrontmatter;
  body: string;
};

export type DraftResponse = {
  post_path: string;
};
