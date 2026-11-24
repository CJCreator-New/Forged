// GET /api/post?path=<content-relative post path>: returns one post's frontmatter and body.
// Read only. The store refuses any path outside content/.
import { requireLocal } from "../../../lib/security/guard";
import { readPost } from "../../../lib/store/posts";
import { resolveContentPath } from "../../../lib/store/paths";

function fail(code: string, message: string, status: number): Response {
  return Response.json({ error: { code, message } }, { status });
}

export async function GET(request: Request): Promise<Response> {
  const blocked = requireLocal(request);
  if (blocked) return blocked;

  const path = new URL(request.url).searchParams.get("path");
  if (!path || !path.endsWith(".md")) {
    return fail("bad_path", "path must point to a post file (.md) inside content/.", 400);
  }

  try {
    resolveContentPath(path); // throws for any path outside content/
  } catch {
    return fail("bad_path", "path must point to a post file inside content/.", 400);
  }

  try {
    const post = await readPost(path);
    return Response.json({ path, frontmatter: post.frontmatter, body: post.body });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return fail("post_not_found", "That post does not exist.", 404);
    }
    if (code === "bad_path") {
      return fail("bad_path", "path must point to a post file inside content/.", 400);
    }
    return fail("read_failed", "The post could not be read.", 422);
  }
}
