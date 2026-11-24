import { Readable } from "node:stream";
import { errorResponse, ExportError } from "@/lib/export/errors";
import { packWeek, planWeek } from "@/lib/export/week";
import { requireLocal } from "@/lib/security/guard";

// GET /api/export/week?week=YYYY-Www. Streams a ZIP with every file in the week plus README.md.
export async function GET(request: Request): Promise<Response> {
  const blocked = requireLocal(request);
  if (blocked) return blocked;
  try {
    const week = new URL(request.url).searchParams.get("week");
    if (!week) throw new ExportError("bad_request", "Missing week query parameter.");
    const plan = await planWeek(week);
    const archive = packWeek(plan);
    return new Response(Readable.toWeb(archive) as ReadableStream, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="postline-${week}.zip"`,
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
