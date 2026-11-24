import { exportDeck, type DeckKind } from "@/lib/export/deck";
import { errorResponse, ExportError } from "@/lib/export/errors";
import { requireLocal } from "@/lib/security/guard";

// GET /api/export/deck?deck=<content-relative path to the deck JSON>&kind=pdf|png
export async function GET(request: Request): Promise<Response> {
  const blocked = requireLocal(request);
  if (blocked) return blocked;
  try {
    const url = new URL(request.url);
    const deck = url.searchParams.get("deck");
    const kind = url.searchParams.get("kind");
    if (!deck) throw new ExportError("bad_request", "Missing deck query parameter.");
    if (kind !== "pdf" && kind !== "png") throw new ExportError("bad_request", "Kind must be pdf or png.");
    const result = await exportDeck(deck, kind as DeckKind);
    return new Response(new Uint8Array(result.body), {
      status: 200,
      headers: {
        "Content-Type": result.contentType,
        "Content-Disposition": `attachment; filename="${result.filename}"`,
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
