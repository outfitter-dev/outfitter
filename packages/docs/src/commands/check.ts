import {
  checkPackageDocs,
  type PackageDocsOptions,
} from "@outfitter/docs-core";
import type { CommandIo } from "./sync.js";

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
  };
}

export async function executeCheckCommand(
  options: ExecuteCheckCommandOptions,
  io: CommandIo
): Promise<number> {
  const result = await checkPackageDocs(toCoreOptions(options));

  if (result.isErr()) {
    io.err(`docs check failed: ${result.error.message}`);
    return 1;
  }

  if (result.value.isUpToDate) {
    io.out("Package docs are up to date.");
    return 0;
  }

  io.err("Package docs are stale:");
  for (const drift of result.value.drift) {
    io.err(`- [${drift.kind}] ${drift.path}`);
  }

  return 1;
}
