import { replaceGeneratedBody, readPost, StoreError } from "../../store/posts";
import { DailyError } from "./errors";
import { variantPath } from "./variants";
import { fileExists, updatePostFields } from "./post-io";

// Makes one variant the body of its post. The old body is saved under versions/ by the store.
// A user-edited post is refused, and nothing changes.

export async function selectVariant(input: {
  post_path: string;
  variant_index: number;
}): Promise<{ post_path: string; previous_path: string }> {
  const post = await readPost(input.post_path);
  const fm = post.frontmatter;

  const variantRel = variantPath(input.post_path, fm.channel, input.variant_index);
  if (!(await fileExists(variantRel))) {
    throw new DailyError("not_found", `Variant ${input.variant_index} does not exist for this post.`);
  }
  const variant = await readPost(variantRel);

  let previousPath: string;
  try {
    const { versionPath } = await replaceGeneratedBody(input.post_path, variant.body, { force: false });
    previousPath = versionPath;
  } catch (err) {
    if (err instanceof StoreError && err.code === "user_edited") {
      throw new DailyError(
        "user_edited",
        "You edited this post, so the variant was not applied. Copy your version somewhere safe first, or start a fresh post.",
      );
    }
    throw err;
  }

  // Changing the body resets the status to draft (glossary: Status).
  await updatePostFields(input.post_path, {
    status: "draft",
    variant_index: input.variant_index,
    humanised: variant.frontmatter.humanised,
    lint: variant.frontmatter.lint,
  });

  return { post_path: input.post_path, previous_path: previousPath };
}
