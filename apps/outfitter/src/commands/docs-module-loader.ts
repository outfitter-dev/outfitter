import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import type { Command } from "commander";

const require = createRequire(import.meta.url);

type DocsMdxMode = "strict" | "lossy";

interface DocsBaseOptions {
  readonly cwd?: string;
  readonly excludedFilenames?: readonly string[];
  readonly mdxMode?: DocsMdxMode;
  readonly outputDir?: string;
  readonly packagesDir?: string;
  readonly workspaceRoot?: string;
}

export interface ExecuteCheckCommandOptions extends DocsBaseOptions {}

export interface ExecuteSyncCommandOptions extends DocsBaseOptions {}

export type DocsExportTarget = "packages" | "llms" | "llms-full" | "all";

export interface ExecuteExportCommandOptions extends DocsBaseOptions {
  readonly llmsFile?: string;
  readonly llmsFullFile?: string;
  readonly target?: DocsExportTarget | string;
}

export interface DocsCommandIo {
  readonly err: (line: string) => void;
  readonly out: (line: string) => void;
}

export interface CreateDocsCommandOptions {
  readonly commandName?: string;
  readonly io?: {
    readonly out?: (line: string) => void;
    readonly err?: (line: string) => void;
  };
}

interface DocsModule {
  createDocsCommand: (options?: CreateDocsCommandOptions) => Command;
  executeCheckCommand: (
    options: ExecuteCheckCommandOptions,
    io: DocsCommandIo
  ) => Promise<number>;
  executeExportCommand: (
    options: ExecuteExportCommandOptions,
    io: DocsCommandIo
  ) => Promise<number>;
  executeSyncCommand: (
    options: ExecuteSyncCommandOptions,
    io: DocsCommandIo
  ) => Promise<number>;
}

function resolveDocsEntrypoint(): string {
  const packageJsonPath = require.resolve("@outfitter/docs/package.json");
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
    "Unable to resolve @outfitter/docs entrypoint (expected src/index.ts or dist/index.js)."
  );
}

let docsModulePromise: Promise<DocsModule> | undefined;

/**
 * Load docs command module with source-first resolution in monorepo development.
 */
export async function loadDocsModule(): Promise<DocsModule> {
  if (!docsModulePromise) {
    docsModulePromise = (async () => {
      const entrypoint = resolveDocsEntrypoint();
      const module = (await import(
        pathToFileURL(entrypoint).href
      )) as Partial<DocsModule>;

      if (
        typeof module.createDocsCommand !== "function" ||
        typeof module.executeCheckCommand !== "function" ||
        typeof module.executeSyncCommand !== "function" ||
        typeof module.executeExportCommand !== "function"
      ) {
        throw new Error(
          "Resolved @outfitter/docs entrypoint does not export required docs functions."
        );
      }

      return module as DocsModule;
    })();
  }

  return await docsModulePromise;
}
