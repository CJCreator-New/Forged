import { requireLocal } from "../../../lib/security/guard";
import { RouteError, toResponse } from "../../../lib/pipeline/deck/http";
import { logoStatus, saveLogo } from "../../../lib/pipeline/deck/logo";

// Logo status: whether content/assets/logo.png or logo.svg exists and is usable.
export async function GET(request: Request): Promise<Response> {
  const blocked = requireLocal(request);
  if (blocked) return blocked;
  try {
    return Response.json(await logoStatus());
  } catch (err) {
    return toResponse(err);
  }
}

// Accepts a multipart file field named "file". Saves it only when it passes validateLogo.
export async function POST(request: Request): Promise<Response> {
  const blocked = requireLocal(request);
  if (blocked) return blocked;
  try {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      throw new RouteError(400, "bad_request", "Send the logo as a multipart form with a file field named file.");
    }
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new RouteError(400, "bad_request", "Send the logo as a multipart form with a file field named file.");
    }
    const result = await saveLogo({
      filename: file.name,
      bytes: new Uint8Array(await file.arrayBuffer()),
      replace: form.get("replace") === "true",
    });
    if (!result.accepted) {
      return Response.json(
        { accepted: false, reason: result.reason, error: { code: "invalid_logo", message: result.reason } },
        { status: 422 },
      );
    }
    return Response.json(result);
  } catch (err) {
    return toResponse(err);
  }
}
