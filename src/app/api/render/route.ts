import { z } from "zod";
import { requireLocal } from "../../../lib/security/guard";
import { parseBody, readJsonBody, toResponse } from "../../../lib/pipeline/deck/http";
import { renderDeckFiles } from "../../../lib/pipeline/deck/render";

const RenderBody = z
  .object({
    deck_path: z.string().min(1),
    pdf: z.boolean().optional(),
  })
  .strict();

// Renders the slides to PNG, plus a PDF for LinkedIn decks, and writes alt.txt beside them.
export async function POST(request: Request): Promise<Response> {
  const blocked = requireLocal(request);
  if (blocked) return blocked;
  try {
    const body = parseBody(RenderBody, await readJsonBody(request));
    const result = await renderDeckFiles({ deckPath: body.deck_path, pdf: body.pdf !== false });
    return Response.json(result);
  } catch (err) {
    return toResponse(err);
  }
}
