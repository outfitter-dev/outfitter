import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);

export interface DocsCoreModule {
  checkLlmsDocs: (options: unknown) => Promise<unknown>;
  checkPackageDocs: (options: unknown) => Promise<unknown>;
  syncLlmsDocs: (options: unknown) => Promise<unknown>;
  syncPackageDocs: (options: unknown) => Promise<unknown>;
}

function resolveDocsCoreEntrypoint(): string {
  const packageJsonPath = require.resolve("@outfitter/docs-core/package.json");
  const packageRoot = dirname(packageJsonPath);
  const srcEntrypoint = join(packageRoot, "src", "index.ts");

  if (existsSync(srcEntrypoint)) {
    return srcEntrypoint;
  }

  const distEntrypoint = join(packageRoot, "dist", "index.js");
  if (existsSync(distEntrypoint)) {
    return distEntrypoint;
  }

  throw new Error(
    "Unable to resolve @outfitter/docs-core entrypoint (expected src/index.ts or dist/index.js)."
  );
}

let docsCoreModulePromise: Promise<DocsCoreModule> | undefined;

/**
 * Load docs-core with monorepo source-first resolution.
 */
export async function loadDocsCoreModule(): Promise<DocsCoreModule> {
  if (!docsCoreModulePromise) {
    docsCoreModulePromise = (async () => {
      const entrypoint = resolveDocsCoreEntrypoint();
      const module = (await import(
        pathToFileURL(entrypoint).href
      )) as Partial<DocsCoreModule>;

      if (
        typeof module.checkPackageDocs !== "function" ||
        typeof module.syncPackageDocs !== "function" ||
        typeof module.syncLlmsDocs !== "function" ||
        typeof module.checkLlmsDocs !== "function"
      ) {
        throw new Error(
          "Resolved @outfitter/docs-core entrypoint does not export required docs functions."
        );
      }

      return module as DocsCoreModule;
    })();
  }

  return await docsCoreModulePromise;
}
