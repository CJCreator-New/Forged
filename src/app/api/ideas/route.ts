import { generateAngles } from "../../../lib/pipeline";
import { rejectIfNotLocal } from "../../../lib/local-guard";

function today(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export async function POST(request: Request): Promise<Response> {
  const denied = rejectIfNotLocal(request);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send a topic as JSON." }, { status: 400 });
  }
  const topic = (body as { topic?: unknown } | null)?.topic;
  if (typeof topic !== "string" || topic.trim() === "") {
    return Response.json({ error: "Please type a topic." }, { status: 400 });
  }
  if (topic.length > 300) {
    return Response.json({ error: "The topic is too long. Keep it under 300 characters." }, { status: 400 });
  }

  const date = today();
  try {
    const out = await generateAngles({ date, topic: topic.trim() });
    return Response.json({ date, topic: topic.trim(), path: out.path, angles: out.draftable });
  } catch (err) {
    console.error("[api/ideas] failed:", err instanceof Error ? err.message : "unknown");
    const msg =
      err instanceof Error && /already exists/i.test(err.message)
        ? "Angles for this topic were already saved today. Try a slightly different topic."
        : "Could not get angles. Check the Settings page and try again.";
    return Response.json({ error: msg }, { status: 500 });
  }
}
