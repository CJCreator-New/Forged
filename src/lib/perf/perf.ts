import type { LogRow } from "../schemas/log";

// Pure performance loop (doc 03 section 12, E14). No network, no file access, no clock, no randomness.
// The caller reads content/log.md and passes parsed rows in.

export type Group = {
  topic: string;
  format: string;
  count: number;
  averageReach: number;
  averageRating: number;
  reason: string;
};

export type RankResult =
  | { logged: number; needed: number; ranked: false }
  | { logged: number; needed: 0; ranked: Group[] };

export type RankOptions = { threshold?: number; minGroup?: number };

const RATING_SCORE: Record<string, number> = { "as-is": 3, light: 2, rewrite: 1 };

function ratingScore(rating: LogRow["edit_rating"]): number {
  if (rating === null) return 0;
  return RATING_SCORE[rating] ?? 0;
}

function withThousands(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function buildReason(count: number, format: string, topic: string, averageReach: number): string {
  const postWord = count === 1 ? "post" : "posts";
  const reach = withThousands(Math.round(averageReach));
  return `your last ${count} ${format} ${postWord} on ${topic} averaged ${reach} reach`;
}

export function rank(rows: LogRow[], opts: RankOptions = {}): RankResult {
  const threshold = opts.threshold ?? 20;
  const minGroup = opts.minGroup ?? 3;

  const withReach = rows.filter((row) => row.reach !== null);
  const logged = withReach.length;

  if (logged < threshold) {
    return { logged, needed: Math.max(0, threshold - logged), ranked: false };
  }

  // Unrated posts (edit_rating null) are left out of the rating average, so they cannot drag it down.
  const buckets = new Map<
    string,
    { topic: string; format: string; reachSum: number; ratingSum: number; ratedCount: number; count: number }
  >();
  for (const row of withReach) {
    const key = JSON.stringify([row.topic, row.format]);
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { topic: row.topic, format: row.format, reachSum: 0, ratingSum: 0, ratedCount: 0, count: 0 };
      buckets.set(key, bucket);
    }
    bucket.reachSum += row.reach as number;
    if (row.edit_rating !== null) {
      bucket.ratingSum += ratingScore(row.edit_rating);
      bucket.ratedCount += 1;
    }
    bucket.count += 1;
  }

  const groups: Group[] = [];
  for (const bucket of buckets.values()) {
    if (bucket.count < minGroup) continue;
    const averageReach = bucket.reachSum / bucket.count;
    const averageRating = bucket.ratedCount === 0 ? 0 : bucket.ratingSum / bucket.ratedCount;
    groups.push({
      topic: bucket.topic,
      format: bucket.format,
      count: bucket.count,
      averageReach,
      averageRating,
      reason: buildReason(bucket.count, bucket.format, bucket.topic, averageReach),
    });
  }

  groups.sort((a, b) => {
    if (b.averageReach !== a.averageReach) return b.averageReach - a.averageReach;
    if (b.averageRating !== a.averageRating) return b.averageRating - a.averageRating;
    if (a.topic !== b.topic) return a.topic < b.topic ? -1 : 1;
    if (a.format !== b.format) return a.format < b.format ? -1 : 1;
    return 0;
  });

  return { logged, needed: 0, ranked: groups };
}

export function resetPerformance(rows: LogRow[]): LogRow[] {
  return rows.map((row) => ({ ...row, reach: null, followers: null }));
}
