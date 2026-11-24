import { z } from "zod";
import { requireLocal } from "../../../lib/security/guard";
import { ColorsSchema, DECK_THEMES, StylingSchema } from "../../../lib/schemas/deck";
import { LogoSettingsSchema } from "../../../lib/pipeline/deck/extras";
import { parseBody, readJsonBody, RouteError, toResponse } from "../../../lib/pipeline/deck/http";
import { generateDeck, patchDeck } from "../../../lib/pipeline/deck/generate";
import { readDeckFile } from "../../../lib/pipeline/deck/file";
import { parseDeckPath } from "../../../lib/pipeline/deck/paths";

const PostBody = z
  .object({
    post_path: z.string().min(1),
    theme: z.enum(DECK_THEMES).optional(),
    colors: ColorsSchema.partial().strict().optional(),
    replace: z.boolean().optional(),
  })
  .strict();

const PatchBody = z
  .object({
    deck_path: z.string().min(1),
    theme: z.enum(DECK_THEMES).optional(),
    colors: ColorsSchema.partial().strict().optional(),
    styling: StylingSchema.partial().strict().optional(),
    icons: z.boolean().optional(),
    logo: LogoSettingsSchema.partial().strict().optional(),
  })
  .strict();

// Reads one saved deck with its look settings. Read only. Path must be a <channel>-deck.json file.
export async function GET(request: Request): Promise<Response> {
  const blocked = requireLocal(request);
  if (blocked) return blocked;
  try {
    const deckPath = new URL(request.url).searchParams.get("path") ?? "";
    if (!parseDeckPath(deckPath)) {
      throw new RouteError(400, "bad_path", "path must look like weeks/<week>/days/<date>/<channel>-deck.json.");
    }
    const { deck, extras } = await readDeckFile(deckPath);
    return Response.json({ path: deckPath, deck, icons: extras.icons, logo: extras.logo });
  } catch (err) {
    return toResponse(err);
  }
}

// Generates the slides with prompt P6 and saves the validated deck.
export async function POST(request: Request): Promise<Response> {
  const blocked = requireLocal(request);
  if (blocked) return blocked;
  try {
    const body = parseBody(PostBody, await readJsonBody(request));
    const result = await generateDeck({
      postPath: body.post_path,
      theme: body.theme,
      colors: body.colors,
      replace: body.replace === true,
    });
    return Response.json(result);
  } catch (err) {
    return toResponse(err);
  }
}

// Changes theme, colours, styling, icons or logo settings. Slide text is never changed.
export async function PATCH(request: Request): Promise<Response> {
  const blocked = requireLocal(request);
  if (blocked) return blocked;
  try {
    const body = parseBody(PatchBody, await readJsonBody(request));
    if (Object.keys(body).length <= 1) {
      throw new RouteError(400, "bad_request", "Send at least one of theme, colors, styling, icons or logo.");
    }
    const result = await patchDeck({
      deckPath: body.deck_path,
      theme: body.theme,
      colors: body.colors,
      styling: body.styling,
      icons: body.icons,
      logo: body.logo,
    });
    return Response.json(result);
  } catch (err) {
    return toResponse(err);
  }
}
