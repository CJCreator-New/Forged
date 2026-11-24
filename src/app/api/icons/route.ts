import path from "node:path";
import { requireLocal } from "../../../lib/security/guard";
import { toResponse } from "../../../lib/pipeline/deck/http";
import { listIcons } from "../../../lib/pipeline/deck/icons";

// Bundled icon names from public/icons, searchable with ?q=. Works offline.
export async function GET(request: Request): Promise<Response> {
  const blocked = requireLocal(request);
  if (blocked) return blocked;
  try {
    const query = new URL(request.url).searchParams.get("q") ?? undefined;
    const icons = await listIcons(path.join(process.cwd(), "public", "icons"), query);
    return Response.json({ icons });
  } catch (err) {
    return toResponse(err);
  }
}
