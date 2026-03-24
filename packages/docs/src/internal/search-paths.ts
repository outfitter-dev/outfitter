import { homedir } from "node:os";
import { join } from "node:path";

import type { DocsSearchConfig } from "./search-types.js";

/**
 * Resolve the default on-disk index path for a docs search instance.
 *
 * When no `indexPath` is provided, derives a workspace-scoped path by
 * hashing the resolved glob patterns, current working directory, and
 * tokenizer. This prevents:
 * - Two checkouts with the same `name` colliding on a shared SQLite file
 * - Tokenizer changes silently reusing an incompatible index
 * - Relative globs resolving to different absolute paths across workspaces
 */
export function resolveDocsSearchIndexPath(config: DocsSearchConfig): string {
  if (config.indexPath) {
    return config.indexPath;
  }

  // Include cwd so relative globs like "docs/**/*.md" resolve uniquely
  // per checkout, and tokenizer so switching from porter to trigram
  // doesn't silently reuse the wrong index.
  const cwd = process.cwd();
  const tokenizer = config.tokenizer ?? "porter";
  const key = [cwd, tokenizer, ...config.paths.toSorted()].join("\0");
  const hash = Bun.hash.wyhash(key, 0n).toString(16).padStart(16, "0");

  return join(homedir(), `.${config.name}`, "docs", `index-${hash}.sqlite`);
}
