import { type PackageDocsOptions, syncPackageDocs } from "@outfitter/docs-core";

export interface ExecuteSyncCommandOptions extends PackageDocsOptions {
  readonly cwd?: string;
}

export interface CommandIo {
  readonly out: (line: string) => void;
  readonly err: (line: string) => void;
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
  return 0;
}
