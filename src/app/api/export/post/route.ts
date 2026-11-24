import { exportPost } from "@/lib/export/post";
import { errorResponse, ExportError } from "@/lib/export/errors";
import { requireLocal } from "@/lib/security/guard";

// GET /api/export/post?post=<content-relative path>&review_confirmed=true
export async function GET(request: Request): Promise<Response> {
  const blocked = requireLocal(request);
  if (blocked) return blocked;
  try {
    const url = new URL(request.url);
    const post = url.searchParams.get("post");
    if (!post) throw new ExportError("bad_request", "Missing post query parameter.");
    const reviewConfirmed = url.searchParams.get("review_confirmed") === "true";
    const { filename, markdown } = await exportPost(post, { reviewConfirmed });
    return new Response(markdown, {
      status: 200,
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
