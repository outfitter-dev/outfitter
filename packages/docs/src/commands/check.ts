import type { PackageDocsOptions } from "@outfitter/docs-core";
import { loadDocsCoreModule } from "../docs-core-loader.js";
import type { CommandIo } from "./sync.js";

type CheckPackageDocsResult = Awaited<
  ReturnType<typeof import("@outfitter/docs-core")["checkPackageDocs"]>
>;

export interface ExecuteCheckCommandOptions extends PackageDocsOptions {
  readonly cwd?: string;
}

function toCoreOptions(
  options: ExecuteCheckCommandOptions
): PackageDocsOptions {
  const workspaceRoot = options.cwd ?? options.workspaceRoot;

  return {
    ...(workspaceRoot ? { workspaceRoot } : {}),
    ...(options.packagesDir ? { packagesDir: options.packagesDir } : {}),
    ...(options.outputDir ? { outputDir: options.outputDir } : {}),
    ...(options.excludedFilenames
      ? { excludedFilenames: options.excludedFilenames }
      : {}),
    ...(options.mdxMode ? { mdxMode: options.mdxMode } : {}),
  };
}

export async function executeCheckCommand(
  options: ExecuteCheckCommandOptions,
  io: CommandIo
): Promise<number> {
  const docsCore = await loadDocsCoreModule();
  const result = (await docsCore.checkPackageDocs(
    toCoreOptions(options)
  )) as CheckPackageDocsResult;

  if (result.isErr()) {
    io.err(`docs check failed: ${result.error.message}`);
    return 1;
  }

  if (result.value.isUpToDate) {
    io.out("Package docs are up to date.");
    for (const warning of result.value.warnings) {
      io.err(`docs warning: ${warning.path}: ${warning.message}`);
    }
    return 0;
  }

  io.err("Package docs are stale:");
  for (const drift of result.value.drift) {
    io.err(`- [${drift.kind}] ${drift.path}`);
  }
  for (const warning of result.value.warnings) {
    io.err(`docs warning: ${warning.path}: ${warning.message}`);
  }

  return 1;
}
