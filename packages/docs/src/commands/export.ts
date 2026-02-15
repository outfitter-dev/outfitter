import type { LlmsDocsOptions, PackageDocsOptions } from "@outfitter/docs-core";
import { loadDocsCoreModule } from "../docs-core-loader.js";
import type { CommandIo } from "./sync.js";

type SyncLlmsDocsResult = Awaited<
  ReturnType<typeof import("@outfitter/docs-core")["syncLlmsDocs"]>
>;
type SyncPackageDocsResult = Awaited<
  ReturnType<typeof import("@outfitter/docs-core")["syncPackageDocs"]>
>;

export type DocsExportTarget = "packages" | "llms" | "llms-full" | "all";

export interface ExecuteExportCommandOptions extends LlmsDocsOptions {
  readonly cwd?: string;
  readonly target?: DocsExportTarget | string;
}

const VALID_TARGETS: readonly DocsExportTarget[] = [
  "packages",
  "llms",
  "llms-full",
  "all",
];

function isDocsExportTarget(value: string): value is DocsExportTarget {
  return VALID_TARGETS.includes(value as DocsExportTarget);
}

function toWorkspaceRoot(
  options: ExecuteExportCommandOptions
): string | undefined {
  return options.cwd ?? options.workspaceRoot;
}

function toPackageOptions(
  options: ExecuteExportCommandOptions
): PackageDocsOptions {
  const workspaceRoot = toWorkspaceRoot(options);

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

function toLlmsOptions(
  options: ExecuteExportCommandOptions,
  targets: readonly ("llms" | "llms-full")[]
): LlmsDocsOptions {
  const workspaceRoot = toWorkspaceRoot(options);

  return {
    ...(workspaceRoot ? { workspaceRoot } : {}),
    ...(options.packagesDir ? { packagesDir: options.packagesDir } : {}),
    ...(options.outputDir ? { outputDir: options.outputDir } : {}),
    ...(options.excludedFilenames
      ? { excludedFilenames: options.excludedFilenames }
      : {}),
    ...(options.mdxMode ? { mdxMode: options.mdxMode } : {}),
    ...(options.llmsFile ? { llmsFile: options.llmsFile } : {}),
    ...(options.llmsFullFile ? { llmsFullFile: options.llmsFullFile } : {}),
    targets,
  };
}

function targetsFromExportTarget(
  target: DocsExportTarget
): readonly ("llms" | "llms-full")[] {
  if (target === "llms") {
    return ["llms"];
  }

  if (target === "llms-full") {
    return ["llms-full"];
  }

  if (target === "all") {
    return ["llms", "llms-full"];
  }

  return [];
}

export async function executeExportCommand(
  options: ExecuteExportCommandOptions,
  io: CommandIo
): Promise<number> {
  const docsCore = await loadDocsCoreModule();
  const targetInput = options.target ?? "all";
  if (!isDocsExportTarget(targetInput)) {
    io.err(
      `docs export failed: invalid target "${targetInput}" (expected one of ${VALID_TARGETS.join(", ")})`
    );
    return 1;
  }

  if (targetInput === "packages" || targetInput === "all") {
    const packageResult = (await docsCore.syncPackageDocs(
      toPackageOptions(options)
    )) as SyncPackageDocsResult;
    if (packageResult.isErr()) {
      io.err(`docs export failed: ${packageResult.error.message}`);
      return 1;
    }

    io.out(
      `Exported package docs for ${packageResult.value.packageNames.length} package(s).`
    );
    io.out(
      `Wrote ${packageResult.value.writtenFiles.length} package file(s), removed ${packageResult.value.removedFiles.length} stale file(s).`
    );
    for (const warning of packageResult.value.warnings) {
      io.err(`docs warning: ${warning.path}: ${warning.message}`);
    }
  }

  const llmsTargets = targetsFromExportTarget(targetInput);
  if (llmsTargets.length > 0) {
    const llmsResult = (await docsCore.syncLlmsDocs(
      toLlmsOptions(options, llmsTargets)
    )) as SyncLlmsDocsResult;
    if (llmsResult.isErr()) {
      io.err(`docs export failed: ${llmsResult.error.message}`);
      return 1;
    }

    io.out(
      `Exported ${llmsTargets.join("+")} docs for ${llmsResult.value.packageNames.length} package(s).`
    );
    io.out(`Wrote ${llmsResult.value.writtenFiles.length} LLM file(s).`);
    for (const warning of llmsResult.value.warnings) {
      io.err(`docs warning: ${warning.path}: ${warning.message}`);
    }
  }

  return 0;
}
