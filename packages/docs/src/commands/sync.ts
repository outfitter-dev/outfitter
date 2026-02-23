import type { PackageDocsOptions } from "../core/index.js";
import { syncPackageDocs } from "../core/index.js";

export interface ExecuteSyncCommandOptions extends PackageDocsOptions {
  readonly cwd?: string;
}

export interface CommandIo {
  readonly err: (line: string) => void;
  readonly out: (line: string) => void;
}

function toCoreOptions(options: ExecuteSyncCommandOptions): PackageDocsOptions {
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

export async function executeSyncCommand(
  options: ExecuteSyncCommandOptions,
  io: CommandIo
): Promise<number> {
  const result = await syncPackageDocs(toCoreOptions(options));

  if (result.isErr()) {
    io.err(`docs sync failed: ${result.error.message}`);
    return 1;
  }

  io.out(
    `Synced package docs for ${result.value.packageNames.length} package(s).`
  );
  io.out(
    `Wrote ${result.value.writtenFiles.length} file(s), removed ${result.value.removedFiles.length} stale file(s).`
  );
  for (const warning of result.value.warnings) {
    io.err(`docs warning: ${warning.path}: ${warning.message}`);
  }
  return 0;
}
