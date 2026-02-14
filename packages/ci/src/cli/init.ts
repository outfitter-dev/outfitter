import { readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Result } from "better-result";
import { ensureCiScripts } from "../../scripts/setup-ci.js";

export interface CiInitOptions {
  cwd?: string;
  defaultBranch?: string;
  bunVersion?: string;
  nodeVersion?: string;
  checkCommand?: string;
  buildCommand?: string;
  testCommand?: string;
  publishCommand?: string;
}

export interface InitCiSuccess {
  writtenFiles: string[];
}

export type InitCiError = Error;

const CI_TEMPLATE_PATH = join(import.meta.dir, "../../workflows/ci.yml");
const RELEASE_TEMPLATE_PATH = join(
  import.meta.dir,
  "../../workflows/release.yml"
);

export function buildCiWorkflowTemplate(options: CiInitOptions = {}): string {
  const template = readFileSync(CI_TEMPLATE_PATH, "utf8");

  return template
    .replaceAll("__BUN_VERSION__", options.bunVersion ?? "1.3.7")
    .replaceAll("__NODE_VERSION__", options.nodeVersion ?? "24")
    .replaceAll("__CHECK_COMMAND__", options.checkCommand ?? "bun run check")
    .replaceAll("__BUILD_COMMAND__", options.buildCommand ?? "bun run build")
    .replaceAll("__TEST_COMMAND__", options.testCommand ?? "bun run test");
}

export function buildReleaseWorkflowTemplate(
  options: CiInitOptions = {}
): string {
  const template = readFileSync(RELEASE_TEMPLATE_PATH, "utf8");

  return template
    .replaceAll("__DEFAULT_BRANCH__", options.defaultBranch ?? "main")
    .replaceAll("__BUN_VERSION__", options.bunVersion ?? "1.3.7")
    .replaceAll("__NODE_VERSION__", options.nodeVersion ?? "24")
    .replaceAll(
      "__PUBLISH_COMMAND__",
      options.publishCommand ?? "bun run release"
    );
}

export async function initCi(
  options: CiInitOptions = {}
): Promise<Result<InitCiSuccess, InitCiError>> {
  const cwd = options.cwd ?? process.cwd();

  try {
    const workflowsDir = join(cwd, ".github/workflows");
    await mkdir(workflowsDir, { recursive: true });

    const ciWorkflow = buildCiWorkflowTemplate(options);
    const releaseWorkflow = buildReleaseWorkflowTemplate(options);

    const ciPath = join(workflowsDir, "ci.yml");
    const releasePath = join(workflowsDir, "release.yml");

    await writeFile(ciPath, ciWorkflow, "utf8");
    await writeFile(releasePath, releaseWorkflow, "utf8");

    const packageJsonPath = join(cwd, "package.json");
    const packageJsonText = await readFile(packageJsonPath, "utf8");
    const packageJson = JSON.parse(packageJsonText) as Record<string, unknown>;

    const ciScriptOptions = {
      ...(options.checkCommand ? { checkCommand: options.checkCommand } : {}),
      ...(options.buildCommand ? { buildCommand: options.buildCommand } : {}),
      ...(options.testCommand ? { testCommand: options.testCommand } : {}),
    };

    const withCiScripts = ensureCiScripts(packageJson, ciScriptOptions);

    if (withCiScripts.changed) {
      await writeFile(
        packageJsonPath,
        `${JSON.stringify(withCiScripts.packageJson, null, 2)}\n`,
        "utf8"
      );
    }

    const writtenFiles = [ciPath, releasePath];
    if (withCiScripts.changed) {
      writtenFiles.push(packageJsonPath);
    }

    return Result.ok({ writtenFiles });
  } catch (error) {
    const normalizedError =
      error instanceof Error ? error : new Error("Failed to initialize CI");
    return Result.err(normalizedError);
  }
}

export async function runInit(options: CiInitOptions = {}): Promise<void> {
  const result = await initCi(options);

  if (result.isErr()) {
    process.stderr.write(`${result.error.message}\n`);
    process.exit(1);
  }

  process.stdout.write("Initialized CI workflows:\n");
  for (const file of result.value.writtenFiles) {
    process.stdout.write(`- ${file}\n`);
  }
}
