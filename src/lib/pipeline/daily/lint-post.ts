import { readSwitches } from "../../config/switches";
import type { LintResult } from "../../linter";
import { readPost } from "../../store/posts";
import { lintBody } from "./generate";
import { presentLint } from "./post-io";

// Runs the linter on a saved post. No model call and no file write.
export async function lintPost(input: { post_path: string }): Promise<LintResult> {
  const { frontmatter, body } = await readPost(input.post_path);
  const lint = lintBody(frontmatter.channel, frontmatter.topic, body);
  return presentLint(lint, readSwitches().linter_soft_warnings);
}
