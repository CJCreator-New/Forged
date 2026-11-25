import { draftDaily, type Platform } from "../../../lib/pipeline";
import { assertDate } from "../../../lib/store/daily";
import { readPost } from "../../../lib/store/posts";
import { rejectIfNotLocal } from "../../../lib/local-guard";

export async function POST(request: Request): Promise<Response> {
  const denied = rejectIfNotLocal(request);
  if (denied) return denied;

  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    if (parsed === null || typeof parsed !== "object") throw new Error("bad");
    body = parsed as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Send the request as JSON." }, { status: 400 });
  }

  let date: string;
  try {
    date = assertDate(body.date);
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Bad date." }, { status: 400 });
  }
  const { topic, angle, platforms } = body;
  if (typeof topic !== "string" || topic.trim() === "" || topic.length > 300) {
    return Response.json({ error: "Topic is missing or too long." }, { status: 400 });
  }
  if (typeof angle !== "string" || angle.trim() === "" || angle.length > 1000) {
    return Response.json({ error: "Angle is missing or too long." }, { status: 400 });
  }
  if (platforms !== undefined && (!Array.isArray(platforms) || platforms.some((p) => typeof p !== "string"))) {
    return Response.json({ error: "Platforms must be a list of names." }, { status: 400 });
  }

  try {
    const out = await draftDaily({
      date,
      topic: topic.trim(),
      angle: angle.trim(),
      ...(platforms ? { platforms: platforms as Platform[] } : {}),
    });
    const results = await Promise.all(
      out.results.map(async (r) => {
        if (r.path === "") return { ...r, body: "" };
        try {
          return { ...r, body: (await readPost(date, r.platform)).body };
        } catch {
          return { ...r, body: "" };
        }
      }),
    );
    return Response.json({ results });
  } catch (err) {
    console.error("[api/draft] failed:", err instanceof Error ? err.message : "unknown");
    const msg =
      err instanceof Error && /already exists/i.test(err.message)
        ? "Drafts for this date already exist. Nothing was overwritten."
        : err instanceof Error && /platform/i.test(err.message)
          ? err.message
          : "Could not write the drafts. Check the Settings page and try again.";
    return Response.json({ error: msg }, { status: 500 });
  }
}
