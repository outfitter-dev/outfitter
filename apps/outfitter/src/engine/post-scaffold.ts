import { relative } from "node:path";
import { Result } from "@outfitter/contracts";
import type { OperationCollector } from "./collector.js";

type ScaffoldOrigin = "init" | "scaffold";

interface GitState {
  readonly isRepo: boolean;
}

export interface PostScaffoldOptions {
  readonly rootDir: string;
  readonly projectDir: string;
  readonly origin: ScaffoldOrigin;
  readonly target: string;
  readonly structure: "single" | "workspace";
  readonly skipInstall: boolean;
  readonly skipGit: boolean;
  readonly skipCommit: boolean;
  readonly dryRun: boolean;
  readonly installTimeoutMs: number;
}

export interface PostScaffoldResult {
  readonly installResult: "success" | "failed" | "skipped";
  readonly installError?: string | undefined;
  readonly gitInitResult: "success" | "failed" | "skipped" | "already-repo";
  readonly gitCommitResult: "success" | "failed" | "skipped";
  readonly gitError?: string | undefined;
  readonly nextSteps: readonly string[];
}

function detectGitState(cwd: string): GitState {
  try {
    const result = Bun.spawnSync(["git", "rev-parse", "--show-toplevel"], {
      cwd,
      stdout: "pipe",
      stderr: "ignore",
    });
    return { isRepo: result.exitCode === 0 };
  } catch {
    return { isRepo: false };
  }
}

async function runBunInstall(
  cwd: string,
  timeoutMs: number
): Promise<Result<void, string>> {
  try {
    const proc = Bun.spawn(["bun", "install"], {
      cwd,
      stdout: "pipe",
      stderr: "pipe",
    });

    const timeoutPromise = new Promise<"timeout">((resolveTimeout) => {
      const timer = setTimeout(() => resolveTimeout("timeout"), timeoutMs);
      proc.exited.finally(() => clearTimeout(timer));
    });

    const race = await Promise.race([
      proc.exited.then(() => "exit"),
      timeoutPromise,
    ]);
    if (race === "timeout") {
      proc.kill();
      return Result.err(`bun install timed out after ${timeoutMs}ms`);
    }

    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      const stderr = await new Response(proc.stderr).text();
      return Result.err(
        stderr.trim() || `bun install exited with code ${exitCode}`
      );
    }
    return Result.ok(undefined);
  } catch (error) {
    return Result.err(error instanceof Error ? error.message : "Unknown error");
  }
}

function runGitInit(cwd: string): Result<void, string> {
  try {
    const result = Bun.spawnSync(["git", "init"], {
      cwd,
      stdout: "pipe",
      stderr: "pipe",
    });
    if (result.exitCode !== 0) {
      return Result.err(result.stderr.toString().trim());
    }
    return Result.ok(undefined);
  } catch (error) {
    return Result.err(error instanceof Error ? error.message : "Unknown error");
  }
}

function hasGitUserConfig(cwd: string): boolean {
  try {
    const name = Bun.spawnSync(["git", "config", "--get", "user.name"], {
      cwd,
      stdout: "pipe",
      stderr: "ignore",
    });
    if (name.exitCode !== 0 || name.stdout.toString().trim().length === 0) {
      return false;
    }
    const email = Bun.spawnSync(["git", "config", "--get", "user.email"], {
      cwd,
      stdout: "pipe",
      stderr: "ignore",
    });
    return email.exitCode === 0 && email.stdout.toString().trim().length > 0;
  } catch {
    return false;
  }
}

function runGitCommit(cwd: string, message: string): Result<void, string> {
  try {
    const addResult = Bun.spawnSync(["git", "add", "."], {
      cwd,
      stdout: "pipe",
      stderr: "pipe",
    });
    if (addResult.exitCode !== 0) {
      return Result.err(
        `git add failed: ${addResult.stderr.toString().trim()}`
      );
    }

    const commitResult = Bun.spawnSync(["git", "commit", "-m", message], {
      cwd,
      stdout: "pipe",
      stderr: "pipe",
    });
    if (commitResult.exitCode !== 0) {
      return Result.err(
        `git commit failed: ${commitResult.stderr.toString().trim()}`
      );
    }
    return Result.ok(undefined);
  } catch (error) {
    return Result.err(error instanceof Error ? error.message : "Unknown error");
  }
}

function computeNextSteps(
  options: PostScaffoldOptions,
  installResult: PostScaffoldResult["installResult"]
): readonly string[] {
  const steps: string[] = [];
  if (options.origin === "init") {
    steps.push(`cd ${JSON.stringify(options.rootDir)}`);
  }

  if (installResult !== "success") {
    steps.push("bun install");
  }

  if (options.structure === "workspace") {
    const relProject = relative(options.rootDir, options.projectDir) || ".";
    steps.push(`bun run --cwd ${JSON.stringify(relProject)} dev`);
  } else {
    steps.push("bun run dev");
  }

  return steps;
}

export async function runPostScaffold(
  options: PostScaffoldOptions,
  collector?: OperationCollector
): Promise<Result<PostScaffoldResult, never>> {
  // Test harnesses disable side-effecting post-scaffold steps via env toggle.
  if (process.env["OUTFITTER_DISABLE_POST_SCAFFOLD"] === "1") {
    return Result.ok({
      installResult: "skipped",
      gitInitResult: "skipped",
      gitCommitResult: "skipped",
      nextSteps: computeNextSteps(options, "skipped"),
    });
  }

  let installResult: PostScaffoldResult["installResult"] = "skipped";
  let installError: string | undefined;

  if (!options.skipInstall) {
    if (options.dryRun) {
      collector?.add({
        type: "install",
        command: "bun install",
        cwd: options.rootDir,
      });
      installResult = "skipped";
    } else {
      const result = await runBunInstall(
        options.rootDir,
        options.installTimeoutMs
      );
      if (result.isErr()) {
        installResult = "failed";
        installError = result.error;
        process.stderr.write(`Warning: bun install failed: ${result.error}\n`);
      } else {
        installResult = "success";
      }
    }
  }

  let gitInitResult: PostScaffoldResult["gitInitResult"] = "skipped";
  let gitCommitResult: PostScaffoldResult["gitCommitResult"] = "skipped";
  let gitError: string | undefined;

  if (!options.skipGit && options.origin === "init") {
    const gitState = detectGitState(options.rootDir);
    if (options.dryRun) {
      if (!gitState.isRepo) {
        collector?.add({
          type: "git",
          action: "init",
          cwd: options.rootDir,
        });
      }
      if (!options.skipCommit) {
        collector?.add({
          type: "git",
          action: "add-all",
          cwd: options.rootDir,
        });
        collector?.add({
          type: "git",
          action: "commit",
          cwd: options.rootDir,
          message: "init: scaffold with outfitter",
        });
      }
      gitInitResult = gitState.isRepo ? "already-repo" : "skipped";
    } else {
      if (gitState.isRepo) {
        gitInitResult = "already-repo";
      } else {
        const result = runGitInit(options.rootDir);
        if (result.isErr()) {
          gitInitResult = "failed";
          gitError = result.error;
          process.stderr.write(`Warning: git init failed: ${result.error}\n`);
        } else {
          gitInitResult = "success";
        }
      }

      if (
        !options.skipCommit &&
        (gitInitResult === "success" || gitInitResult === "already-repo")
      ) {
        if (hasGitUserConfig(options.rootDir)) {
          const commitResult = runGitCommit(
            options.rootDir,
            "init: scaffold with outfitter"
          );
          if (commitResult.isErr()) {
            gitCommitResult = "failed";
            gitError = commitResult.error;
            process.stderr.write(`Warning: ${commitResult.error}\n`);
          } else {
            gitCommitResult = "success";
          }
        } else {
          gitCommitResult = "skipped";
          process.stderr.write(
            "Warning: git user.name/email not configured, skipping initial commit.\n"
          );
        }
      }
    }
  }

  return Result.ok({
    installResult,
    installError,
    gitInitResult,
    gitCommitResult,
    gitError,
    nextSteps: computeNextSteps(options, installResult),
  });
}
