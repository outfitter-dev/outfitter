/**
 * Tests for `outfitter init` command.
 *
 * @packageDocumentation
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Manifest } from "../manifest.js";

/**
 * Read expected versions directly from workspace package.json files,
 * independent of the resolver under test, so resolver bugs don't mask
 * test failures.
 */
function workspaceVersion(pkg: string): string {
  const name = pkg.replace("@outfitter/", "");
  const raw = readFileSync(
    join(
      import.meta.dirname,
      "..",
      "..",
      "..",
      "..",
      "packages",
      name,
      "package.json"
    ),
    "utf-8"
  );
  return `^${JSON.parse(raw).version}`;
}

// =============================================================================
// Test Utilities
// =============================================================================

/**
 * Creates a temporary directory for testing.
 */
function createTempDir(): string {
  const tempDir = join(
    tmpdir(),
    `outfitter-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  mkdirSync(tempDir, { recursive: true });
  return tempDir;
}

/**
 * Cleans up a temporary directory.
 */
function cleanupTempDir(dir: string): void {
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Captures stdout emitted while running a function.
 */
async function captureStdout(fn: () => void | Promise<void>): Promise<string> {
  let stdout = "";
  const originalWrite = process.stdout.write.bind(process.stdout);

  process.stdout.write = ((chunk: string | Uint8Array): boolean => {
    stdout +=
      typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk);
    return true;
  }) as typeof process.stdout.write;

  try {
    await fn();
  } finally {
    process.stdout.write = originalWrite;
  }

  return stdout;
}

// =============================================================================
// Test Setup/Teardown
// =============================================================================

let tempDir: string;
let originalIsTTY: boolean | undefined;
let originalDisablePostScaffold: string | undefined;

beforeEach(() => {
  originalIsTTY = process.stdout.isTTY;
  originalDisablePostScaffold = process.env["OUTFITTER_DISABLE_POST_SCAFFOLD"];
  process.env["OUTFITTER_DISABLE_POST_SCAFFOLD"] = "1";
  Object.defineProperty(process.stdout, "isTTY", {
    value: false,
    writable: true,
    configurable: true,
  });
  tempDir = createTempDir();
});

afterEach(() => {
  cleanupTempDir(tempDir);
  if (originalDisablePostScaffold === undefined) {
    delete process.env["OUTFITTER_DISABLE_POST_SCAFFOLD"];
  } else {
    process.env["OUTFITTER_DISABLE_POST_SCAFFOLD"] =
      originalDisablePostScaffold;
  }
  Object.defineProperty(process.stdout, "isTTY", {
    value: originalIsTTY,
    writable: true,
    configurable: true,
  });
});

// =============================================================================
// Init Command File Creation Tests
// =============================================================================

describe("init command file creation", () => {
  test("creates package.json in target directory", async () => {
    const { runInit } = await import("../commands/init.js");

    await runInit({
      targetDir: tempDir,
      name: "test-project",
      preset: "minimal",
      force: false,
    });

    const packageJsonPath = join(tempDir, "package.json");
    expect(existsSync(packageJsonPath)).toBe(true);

    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
    expect(packageJson.name).toBe("test-project");
  });

  test("creates standalone tsconfig.json without tooling preset", async () => {
    const { runInit } = await import("../commands/init.js");

    await runInit({
      targetDir: tempDir,
      name: "test-project",
      preset: "minimal",
      force: false,
    });

    const tsconfigPath = join(tempDir, "tsconfig.json");
    expect(existsSync(tsconfigPath)).toBe(true);

    const tsconfig = JSON.parse(readFileSync(tsconfigPath, "utf-8"));
    expect(tsconfig.extends).toBeUndefined();
    expect(tsconfig.compilerOptions).toBeDefined();
  });

  test("creates CLI template with tooling dependency required for hook verification", async () => {
    const { runInit } = await import("../commands/init.js");

    await runInit({
      targetDir: tempDir,
      name: "test-project",
      preset: "cli",
      force: false,
      noTooling: true,
    });

    const packageJsonPath = join(tempDir, "package.json");
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
    expect(packageJson.devDependencies["@outfitter/tooling"]).toBe(
      workspaceVersion("@outfitter/tooling")
    );
    expect(packageJson.scripts["verify:ci"]).toBe(
      "bun run typecheck && bun run check && bun run build && bun run test"
    );
    expect(packageJson.scripts["clean:artifacts"]).toBe("rm -rf dist .turbo");
    expect(packageJson.dependencies["@outfitter/contracts"]).toBe(
      workspaceVersion("@outfitter/contracts")
    );
    expect(packageJson.dependencies["@outfitter/cli"]).toBe(
      workspaceVersion("@outfitter/cli")
    );
    expect(packageJson.dependencies["@outfitter/logging"]).toBe(
      workspaceVersion("@outfitter/logging")
    );
    expect(packageJson.dependencies.commander).toBe("^14.0.2");
    expect(packageJson.dependencies["@outfitter/config"]).toBeUndefined();
    expect(packageJson.outfitter.template.kind).toBe("runnable");
    expect(packageJson.outfitter.template.placement).toBe("apps");
    expect(packageJson.outfitter.template.surfaces).toEqual(["cli"]);

    const tsconfigPath = join(tempDir, "tsconfig.json");
    const tsconfig = JSON.parse(readFileSync(tsconfigPath, "utf-8"));
    expect(tsconfig.extends).toBeUndefined();

    expect(existsSync(join(tempDir, "biome.json"))).toBe(false);

    const programPath = join(tempDir, "src", "program.ts");
    const programContent = readFileSync(programPath, "utf-8");
    expect(programContent).toMatch(/createCLI/);
  });

  test("creates library template with Result handler pattern and no binary entrypoint", async () => {
    const { runInit } = await import("../commands/init.js");

    const result = await runInit({
      targetDir: tempDir,
      name: "test-library",
      preset: "library",
      force: false,
      noTooling: true,
      skipInstall: true,
      skipGit: true,
      skipCommit: true,
    });

    expect(result.isOk()).toBe(true);

    const packageJsonPath = join(tempDir, "package.json");
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
    expect(packageJson.bin).toBeUndefined();
    expect(packageJson.scripts.build).toBe("bunup");
    expect(packageJson.dependencies["@outfitter/contracts"]).toBe(
      workspaceVersion("@outfitter/contracts")
    );
    expect(packageJson.dependencies["@outfitter/logging"]).toBe(
      workspaceVersion("@outfitter/logging")
    );
    expect(packageJson.dependencies.zod).toBe("^4.3.5");
    expect(packageJson.outfitter.template.kind).toBe("library");
    expect(packageJson.outfitter.template.placement).toBe("packages");
    expect(packageJson.outfitter.template.surfaces).toEqual([]);

    const indexPath = join(tempDir, "src", "index.ts");
    const indexContent = readFileSync(indexPath, "utf-8");
    expect(indexContent).toContain('export * from "./types.js";');
    expect(indexContent).toContain('export * from "./handlers.js";');

    const handlerPath = join(tempDir, "src", "handlers.ts");
    const handlerContent = readFileSync(handlerPath, "utf-8");
    expect(handlerContent).toContain("Result.ok");
    expect(handlerContent).toContain("createLogger");
    expect(handlerContent).toContain("logger.info(");

    expect(existsSync(join(tempDir, "src", "index.test.ts"))).toBe(true);
    expect(existsSync(join(tempDir, "bunup.config.ts"))).toBe(true);
  });

  test("creates full-stack preset workspace with shared core handler wiring", async () => {
    const { runInit } = await import("../commands/init.js");

    const result = await runInit({
      targetDir: tempDir,
      name: "test-stack",
      preset: "full-stack",
      force: false,
      noTooling: true,
      yes: true,
      skipInstall: true,
      skipGit: true,
      skipCommit: true,
    });

    expect(result.isOk()).toBe(true);

    const rootPackageJson = JSON.parse(
      readFileSync(join(tempDir, "package.json"), "utf-8")
    );
    expect(rootPackageJson.name).toBe("test-stack");
    expect(rootPackageJson.workspaces).toEqual(["apps/*", "packages/*"]);

    const cliPackageJsonPath = join(tempDir, "apps", "cli", "package.json");
    const mcpPackageJsonPath = join(tempDir, "apps", "mcp", "package.json");
    const corePackageJsonPath = join(
      tempDir,
      "packages",
      "core",
      "package.json"
    );

    expect(existsSync(cliPackageJsonPath)).toBe(true);
    expect(existsSync(mcpPackageJsonPath)).toBe(true);
    expect(existsSync(corePackageJsonPath)).toBe(true);

    const cliPackageJson = JSON.parse(
      readFileSync(cliPackageJsonPath, "utf-8")
    );
    const mcpPackageJson = JSON.parse(
      readFileSync(mcpPackageJsonPath, "utf-8")
    );
    const corePackageJson = JSON.parse(
      readFileSync(corePackageJsonPath, "utf-8")
    );

    expect(corePackageJson.name).toBe("test-stack-core");
    expect(cliPackageJson.dependencies[corePackageJson.name]).toBe(
      "workspace:*"
    );
    expect(mcpPackageJson.dependencies[corePackageJson.name]).toBe(
      "workspace:*"
    );

    const cliSource = readFileSync(
      join(tempDir, "apps", "cli", "src", "cli.ts"),
      "utf-8"
    );
    const mcpSource = readFileSync(
      join(tempDir, "apps", "mcp", "src", "mcp.ts"),
      "utf-8"
    );
    expect(cliSource).toContain(corePackageJson.name);
    expect(mcpSource).toContain(corePackageJson.name);
  });

  test("applies tooling files at full-stack workspace root only", async () => {
    const { runInit } = await import("../commands/init.js");

    const result = await runInit({
      targetDir: tempDir,
      name: "test-stack",
      preset: "full-stack",
      force: false,
      yes: true,
      skipInstall: true,
      skipGit: true,
      skipCommit: true,
    });

    expect(result.isOk()).toBe(true);
    expect(existsSync(join(tempDir, "biome.json"))).toBe(true);
    expect(existsSync(join(tempDir, "apps", "cli", "biome.json"))).toBe(false);
    expect(existsSync(join(tempDir, "apps", "mcp", "biome.json"))).toBe(false);
    expect(existsSync(join(tempDir, "packages", "core", "biome.json"))).toBe(
      false
    );
  });

  test("creates src directory structure", async () => {
    const { runInit } = await import("../commands/init.js");

    await runInit({
      targetDir: tempDir,
      name: "test-project",
      preset: "minimal",
      force: false,
    });

    const srcDir = join(tempDir, "src");
    expect(existsSync(srcDir)).toBe(true);
  });

  test("creates src/index.ts entry point", async () => {
    const { runInit } = await import("../commands/init.js");

    await runInit({
      targetDir: tempDir,
      name: "test-project",
      preset: "minimal",
      force: false,
    });

    const indexPath = join(tempDir, "src", "index.ts");
    expect(existsSync(indexPath)).toBe(true);
  });
});

// =============================================================================
// Init Command Placeholder Replacement Tests
// =============================================================================

describe("init command placeholder replacement", () => {
  test("replaces {{packageName}} placeholder in package.json", async () => {
    const { runInit } = await import("../commands/init.js");

    await runInit({
      targetDir: tempDir,
      name: "my-awesome-project",
      preset: "minimal",
      force: false,
    });

    const packageJsonPath = join(tempDir, "package.json");
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));

    expect(packageJson.name).toBe("my-awesome-project");
    // Ensure no unreplaced placeholders
    const content = readFileSync(packageJsonPath, "utf-8");
    expect(content).not.toContain("{{packageName}}");
  });

  test("replaces {{version}} placeholder with default version", async () => {
    const { runInit } = await import("../commands/init.js");

    await runInit({
      targetDir: tempDir,
      name: "test-project",
      preset: "minimal",
      force: false,
    });

    const packageJsonPath = join(tempDir, "package.json");
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));

    expect(packageJson.version).toBe("0.1.0");
    const content = readFileSync(packageJsonPath, "utf-8");
    expect(content).not.toContain("{{version}}");
  });

  test("replaces {{description}} placeholder", async () => {
    const { runInit } = await import("../commands/init.js");

    await runInit({
      targetDir: tempDir,
      name: "test-project",
      preset: "minimal",
      force: false,
    });

    const packageJsonPath = join(tempDir, "package.json");
    const content = readFileSync(packageJsonPath, "utf-8");

    expect(content).not.toContain("{{description}}");
  });

  test("replaces legacy {{name}} placeholder in source files", async () => {
    const { runInit } = await import("../commands/init.js");

    await runInit({
      targetDir: tempDir,
      name: "my-awesome-project",
      preset: "minimal",
      force: false,
    });

    const indexPath = join(tempDir, "src", "index.ts");
    const content = readFileSync(indexPath, "utf-8");

    expect(content).toContain("my-awesome-project");
    expect(content).not.toContain("{{name}}");
  });
});

// =============================================================================
// Init Command Default Behavior Tests
// =============================================================================

describe("init command default behavior", () => {
  test("sanitizes inferred package name from directory basename", async () => {
    const { runInit } = await import("../commands/init.js");

    const projectDir = join(tempDir, "My Cool Project");
    mkdirSync(projectDir, { recursive: true });

    const result = await runInit({
      targetDir: projectDir,
      name: undefined,
      preset: "minimal",
      force: false,
    });

    expect(result.isOk()).toBe(true);
    const packageJsonPath = join(projectDir, "package.json");
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
    expect(packageJson.name).toBe("my-cool-project");
  });

  test("uses directory name as project name when not specified", async () => {
    const { runInit } = await import("../commands/init.js");

    const projectDir = join(tempDir, "my-project-dir");
    mkdirSync(projectDir, { recursive: true });

    await runInit({
      targetDir: projectDir,
      name: undefined,
      preset: "minimal",
      force: false,
    });

    const packageJsonPath = join(projectDir, "package.json");
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));

    expect(packageJson.name).toBe("my-project-dir");
  });

  test("uses 'basic' template by default", async () => {
    const { runInit } = await import("../commands/init.js");

    await runInit({
      targetDir: tempDir,
      name: "test-project",
      template: undefined,
      force: false,
    });

    // Should succeed without error using basic template
    const packageJsonPath = join(tempDir, "package.json");
    expect(existsSync(packageJsonPath)).toBe(true);
  });

  test("derives project name from scoped package name", async () => {
    const { runInit } = await import("../commands/init.js");

    await runInit({
      targetDir: tempDir,
      name: "@outfitter/scoped-project",
      preset: "minimal",
      force: false,
    });

    const packageJsonPath = join(tempDir, "package.json");
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
    expect(packageJson.name).toBe("@outfitter/scoped-project");

    const indexPath = join(tempDir, "src", "index.ts");
    const content = readFileSync(indexPath, "utf-8");
    expect(content).toContain("scoped-project");
    expect(content).toContain("@outfitter/scoped-project");
  });
});

// =============================================================================
// Init Command Local Dependency Rewrite Tests
// =============================================================================

describe("init command local dependency rewriting", () => {
  test("rewrites @outfitter dependencies to workspace:* when local is enabled", async () => {
    const { runInit } = await import("../commands/init.js");

    const result = await runInit({
      targetDir: tempDir,
      name: "test-project",
      preset: "cli",
      local: true,
      force: false,
    });

    expect(result.isOk()).toBe(true);

    const packageJsonPath = join(tempDir, "package.json");
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
    expect(packageJson.dependencies["@outfitter/contracts"]).toBe(
      "workspace:*"
    );
    expect(packageJson.dependencies["@outfitter/cli"]).toBe("workspace:*");
    expect(packageJson.dependencies["@outfitter/logging"]).toBe("workspace:*");
    expect(packageJson.dependencies["@outfitter/config"]).toBeUndefined();
    expect(packageJson.dependencies.commander).toBe("^14.0.2");
  });
});

// =============================================================================
// Init Command Workspace Scaffolding Tests
// =============================================================================

describe("init command workspace scaffolding", () => {
  test("rejects path traversal in workspace project name", async () => {
    const { runInit } = await import("../commands/init.js");

    const result = await runInit({
      targetDir: tempDir,
      name: "../escaped",
      preset: "cli",
      structure: "workspace",
      workspaceName: "acme-workspace",
      yes: true,
      force: false,
      noTooling: true,
      skipInstall: true,
      skipGit: true,
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toContain("Invalid package name");
    }
    expect(existsSync(join(tempDir, "apps", "escaped"))).toBe(false);
  });

  test("rejects absolute path style workspace project names", async () => {
    const { runInit } = await import("../commands/init.js");

    const result = await runInit({
      targetDir: tempDir,
      name: "/tmp/outside-root",
      preset: "cli",
      structure: "workspace",
      workspaceName: "acme-workspace",
      yes: true,
      force: false,
      noTooling: true,
      skipInstall: true,
      skipGit: true,
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toContain("Invalid package name");
    }
  });

  test("scaffolds workspace root and places runnable preset under apps/", async () => {
    const { runInit } = await import("../commands/init.js");

    const result = await runInit({
      targetDir: tempDir,
      name: "@acme/my-mcp",
      preset: "mcp",
      structure: "workspace",
      workspaceName: "acme-workspace",
      yes: true,
      force: false,
      noTooling: true,
      skipInstall: true,
      skipGit: true,
    });

    expect(result.isOk()).toBe(true);
    if (result.isErr()) {
      return;
    }

    const rootPackageJsonPath = join(tempDir, "package.json");
    expect(existsSync(rootPackageJsonPath)).toBe(true);
    const rootPackageJson = JSON.parse(
      readFileSync(rootPackageJsonPath, "utf-8")
    );
    expect(rootPackageJson.name).toBe("acme-workspace");
    expect(rootPackageJson.private).toBe(true);
    expect(rootPackageJson.workspaces).toEqual(["apps/*", "packages/*"]);

    // Workspace root README
    const readmePath = join(tempDir, "README.md");
    expect(existsSync(readmePath)).toBe(true);
    const readme = readFileSync(readmePath, "utf-8");
    expect(readme).toContain("acme-workspace");
    expect(readme).toContain("apps/");
    expect(readme).toContain("packages/");

    const projectPackageJsonPath = join(
      tempDir,
      "apps",
      "my-mcp",
      "package.json"
    );
    expect(existsSync(projectPackageJsonPath)).toBe(true);

    const projectPackageJson = JSON.parse(
      readFileSync(projectPackageJsonPath, "utf-8")
    );
    expect(projectPackageJson.name).toBe("@acme/my-mcp");
    expect(result.value.structure).toBe("workspace");
    expect(result.value.projectDir).toBe(join(tempDir, "apps", "my-mcp"));
  });

  test("renders scoped workspace README examples without double @", async () => {
    const { runInit } = await import("../commands/init.js");

    const result = await runInit({
      targetDir: tempDir,
      name: "@acme/my-mcp",
      preset: "mcp",
      structure: "workspace",
      workspaceName: "@acme/workspace",
      yes: true,
      force: false,
      noTooling: true,
      skipInstall: true,
      skipGit: true,
    });

    expect(result.isOk()).toBe(true);
    if (result.isErr()) {
      return;
    }

    const readmePath = join(tempDir, "README.md");
    const readme = readFileSync(readmePath, "utf-8");

    expect(readme).toContain("outfitter init --name @acme/my-app --preset cli");
    expect(readme).toContain(
      "outfitter init --name @acme/my-lib --preset library"
    );
    expect(readme).not.toContain("@@acme");
  });

  test("renders workspace README examples with npm-safe scope for unsanitized workspace names", async () => {
    const { buildWorkspaceRootReadme } = await import("../engine/workspace.js");

    const readme = buildWorkspaceRootReadme("My Cool Project");

    expect(readme).toContain(
      "outfitter init --name @my-cool-project/my-app --preset cli"
    );
    expect(readme).toContain(
      "outfitter init --name @my-cool-project/my-lib --preset library"
    );
    expect(readme).not.toContain("@My Cool Project/");
  });

  test("stamps manifest inside workspace project directory", async () => {
    const { runInit } = await import("../commands/init.js");

    const result = await runInit({
      targetDir: tempDir,
      name: "@acme/my-tool",
      preset: "minimal",
      structure: "workspace",
      workspaceName: "acme-workspace",
      yes: true,
      force: false,
      skipInstall: true,
      skipGit: true,
    });

    expect(result.isOk()).toBe(true);

    const projectDir = join(tempDir, "packages", "my-tool");
    const manifestPath = join(projectDir, ".outfitter/manifest.json");
    expect(existsSync(manifestPath)).toBe(true);

    const raw = readFileSync(manifestPath, "utf-8");
    const manifest = JSON.parse(raw) as Manifest;
    expect(manifest.version).toBe(1);
    expect(manifest.blocks["scaffolding"]).toBeDefined();
  });

  test("dry-run workspace init does not write workspace root files", async () => {
    const { runInit } = await import("../commands/init.js");

    const result = await runInit({
      targetDir: tempDir,
      name: "@acme/my-mcp",
      preset: "mcp",
      structure: "workspace",
      workspaceName: "acme-workspace",
      yes: true,
      dryRun: true,
      force: false,
      noTooling: true,
      skipInstall: true,
      skipGit: true,
    });

    expect(result.isOk()).toBe(true);
    if (result.isErr()) {
      return;
    }

    expect(result.value.dryRunPlan).toBeDefined();
    expect(existsSync(join(tempDir, "package.json"))).toBe(false);
    expect(existsSync(join(tempDir, "apps"))).toBe(false);
    expect(existsSync(join(tempDir, "packages"))).toBe(false);

    const operations = result.value.dryRunPlan?.operations ?? [];
    const readmeOp = operations.find((op) => {
      if (!op || typeof op !== "object") {
        return false;
      }
      const candidate = op as { type?: string; path?: string };
      return (
        candidate.path === join(tempDir, "README.md") &&
        (candidate.type === "file-create" ||
          candidate.type === "file-overwrite")
      );
    });
    expect(readmeOp).toBeDefined();
  });
});

describe("init command next steps", () => {
  test("quotes rootDir in suggested cd command", async () => {
    const { runInit } = await import("../commands/init.js");

    const targetDir = join(tempDir, "my project");
    const result = await runInit({
      targetDir,
      name: "my-project",
      preset: "minimal",
      force: false,
      skipInstall: true,
      skipGit: true,
    });

    expect(result.isOk()).toBe(true);
    if (result.isErr()) {
      return;
    }

    expect(result.value.postScaffold.nextSteps[0]).toBe(
      `cd ${JSON.stringify(targetDir)}`
    );
  });
});

describe("init command output modes", () => {
  test("matches --json payload when OUTFITTER_JSON=1 is set", async () => {
    const { runInit, printInitResults } = await import("../commands/init.js");

    const result = await runInit({
      targetDir: tempDir,
      name: "test-project",
      preset: "minimal",
      force: false,
      skipInstall: true,
      skipGit: true,
    });

    expect(result.isOk()).toBe(true);
    if (result.isErr()) {
      return;
    }

    const explicitJsonOutput = await captureStdout(async () => {
      await printInitResults(result.value, { mode: "json" });
    });

    const previousJson = process.env["OUTFITTER_JSON"];
    const previousJsonl = process.env["OUTFITTER_JSONL"];
    delete process.env["OUTFITTER_JSONL"];
    process.env["OUTFITTER_JSON"] = "1";

    let envJsonOutput = "";
    try {
      envJsonOutput = await captureStdout(async () => {
        await printInitResults(result.value);
      });
    } finally {
      if (previousJson === undefined) {
        delete process.env["OUTFITTER_JSON"];
      } else {
        process.env["OUTFITTER_JSON"] = previousJson;
      }

      if (previousJsonl === undefined) {
        delete process.env["OUTFITTER_JSONL"];
      } else {
        process.env["OUTFITTER_JSONL"] = previousJsonl;
      }
    }

    const explicitPayload = JSON.parse(explicitJsonOutput.trim()) as unknown;
    const envPayload = JSON.parse(envJsonOutput.trim()) as unknown;

    expect(envPayload).toEqual(explicitPayload);
    expect(Array.isArray(envPayload)).toBe(false);
  });
});

// =============================================================================
// Init Command Force Flag Tests
// =============================================================================

describe("init command --force flag", () => {
  test("fails without --force when directory has existing files", async () => {
    const { runInit } = await import("../commands/init.js");

    // Create existing file
    writeFileSync(
      join(tempDir, "package.json"),
      JSON.stringify({ name: "existing" })
    );

    const result = await runInit({
      targetDir: tempDir,
      name: "test-project",
      preset: "minimal",
      force: false,
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toContain("already has a package.json");
    }
  });

  test("overwrites existing files with --force flag", async () => {
    const { runInit } = await import("../commands/init.js");

    // Create existing file
    writeFileSync(
      join(tempDir, "package.json"),
      JSON.stringify({ name: "existing" })
    );

    const result = await runInit({
      targetDir: tempDir,
      name: "new-project",
      preset: "minimal",
      force: true,
    });

    expect(result.isOk()).toBe(true);

    const packageJsonPath = join(tempDir, "package.json");
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
    expect(packageJson.name).toBe("new-project");
  });
});

// =============================================================================
// Init Command Error Handling Tests
// =============================================================================

describe("init command error handling", () => {
  test("returns error for invalid explicit package name", async () => {
    const { runInit } = await import("../commands/init.js");

    const result = await runInit({
      targetDir: tempDir,
      name: "App Space",
      preset: "minimal",
      force: false,
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toContain("Invalid package name");
    }
  });

  test("returns error when target directory does not exist and cannot be created", async () => {
    const { runInit } = await import("../commands/init.js");

    // Use a path that cannot be created (under a file instead of a directory)
    const invalidPath = join(tempDir, "file.txt", "nested");
    writeFileSync(join(tempDir, "file.txt"), "content");

    const result = await runInit({
      targetDir: invalidPath,
      name: "test-project",
      preset: "minimal",
      force: false,
    });

    expect(result.isErr()).toBe(true);
  });
});

// =============================================================================
// Init Command Result Type Tests
// =============================================================================

describe("init command result type", () => {
  test("returns Ok result on success", async () => {
    const { runInit } = await import("../commands/init.js");

    const result = await runInit({
      targetDir: tempDir,
      name: "test-project",
      preset: "minimal",
      force: false,
    });

    expect(result.isOk()).toBe(true);
  });

  test("returns Err result on failure", async () => {
    const { runInit } = await import("../commands/init.js");

    // Create existing file without force flag
    writeFileSync(
      join(tempDir, "package.json"),
      JSON.stringify({ name: "existing" })
    );

    const result = await runInit({
      targetDir: tempDir,
      name: "test-project",
      preset: "minimal",
      force: false,
    });

    expect(result.isErr()).toBe(true);
  });
});

// =============================================================================
// Init Command Registry Blocks Tests
// =============================================================================

describe("init command registry blocks", () => {
  test("adds scaffolding by default in non-interactive mode", async () => {
    const { runInit } = await import("../commands/init.js");

    const result = await runInit({
      targetDir: tempDir,
      name: "test-project",
      preset: "minimal",
      force: false,
      // No --with or --no-tooling specified, non-interactive mode
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.blocksAdded).toBeDefined();
      // Should have scaffolding files
      expect(result.value.blocksAdded?.created).toContain(
        ".claude/settings.json"
      );
      expect(result.value.blocksAdded?.created).toContain("biome.json");
    }
  });

  test("does not add tooling when noTooling is true", async () => {
    const { runInit } = await import("../commands/init.js");

    const result = await runInit({
      targetDir: tempDir,
      name: "test-project",
      preset: "minimal",
      force: false,
      noTooling: true,
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.blocksAdded).toBeUndefined();
    }
  });

  test("adds claude block when specified", async () => {
    const { runInit } = await import("../commands/init.js");

    const result = await runInit({
      targetDir: tempDir,
      name: "test-project",
      preset: "minimal",
      force: false,
      with: "claude",
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.blocksAdded).toBeDefined();
      expect(result.value.blocksAdded?.created).toContain(
        ".claude/settings.json"
      );
    }

    // Verify file was actually created
    const settingsPath = join(tempDir, ".claude/settings.json");
    expect(existsSync(settingsPath)).toBe(true);
  });

  test("adds biome block with biome.json file", async () => {
    const { runInit } = await import("../commands/init.js");

    const result = await runInit({
      targetDir: tempDir,
      name: "test-project",
      preset: "minimal",
      force: false,
      with: "biome",
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.blocksAdded).toBeDefined();
      expect(result.value.blocksAdded?.created).toContain("biome.json");
      // Note: ultracite is already in SHARED_DEV_DEPS so it won't be in the added list
    }

    // Verify biome.json was created
    const biomePath = join(tempDir, "biome.json");
    expect(existsSync(biomePath)).toBe(true);
  });

  test("adds multiple blocks from comma-separated list", async () => {
    const { runInit } = await import("../commands/init.js");

    const result = await runInit({
      targetDir: tempDir,
      name: "test-project",
      preset: "minimal",
      force: false,
      with: "claude,biome",
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.blocksAdded).toBeDefined();
      // Should have files from both blocks
      expect(result.value.blocksAdded?.created).toContain(
        ".claude/settings.json"
      );
      expect(result.value.blocksAdded?.created).toContain("biome.json");
    }
  });

  test("adds scaffolding block which extends all other blocks", async () => {
    const { runInit } = await import("../commands/init.js");

    const result = await runInit({
      targetDir: tempDir,
      name: "test-project",
      preset: "minimal",
      force: false,
      with: "scaffolding",
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.blocksAdded).toBeDefined();
      // Blocks are the canonical source for tooling files — no template duplicates.
      expect(result.value.blocksAdded?.created).toContain(
        ".claude/settings.json"
      );
      expect(result.value.blocksAdded?.created).toContain("biome.json");
      expect(result.value.blocksAdded?.created).toContain(
        "scripts/bootstrap.sh"
      );
      // .lefthook.yml is provided by both the preset template and the block.
      // Since the template is copied first, the block's version is skipped.
      // OS-302 will remove tooling files from presets so blocks are canonical.
      const allBlockFiles = [
        ...(result.value.blocksAdded?.created ?? []),
        ...(result.value.blocksAdded?.skipped ?? []),
      ];
      expect(allBlockFiles).toContain(".lefthook.yml");
    }
  });

  test("returns error for invalid block name", async () => {
    const { runInit } = await import("../commands/init.js");

    const result = await runInit({
      targetDir: tempDir,
      name: "test-project",
      preset: "minimal",
      force: false,
      with: "nonexistent-block",
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toContain("nonexistent-block");
    }
  });
});

// =============================================================================
// Init Command Manifest Stamping Tests
// =============================================================================

describe("init command manifest stamping", () => {
  test("stamps manifest with installed blocks after successful init", async () => {
    const { runInit } = await import("../commands/init.js");

    const result = await runInit({
      targetDir: tempDir,
      name: "test-project",
      preset: "minimal",
      force: false,
      with: "claude",
    });

    expect(result.isOk()).toBe(true);

    const manifestPath = join(tempDir, ".outfitter/manifest.json");
    expect(existsSync(manifestPath)).toBe(true);

    const raw = readFileSync(manifestPath, "utf-8");
    const manifest = JSON.parse(raw) as Manifest;
    expect(manifest.version).toBe(1);
    expect(manifest.blocks["claude"]).toBeDefined();
    expect(manifest.blocks["claude"]?.installedFrom).toMatch(/^\d+\.\d+\.\d+/);
    expect(manifest.blocks["claude"]?.installedAt).toBeDefined();
  });

  test("stamps manifest for default scaffolding block", async () => {
    const { runInit } = await import("../commands/init.js");

    const result = await runInit({
      targetDir: tempDir,
      name: "test-project",
      preset: "minimal",
      force: false,
      // Default: adds "scaffolding" block
    });

    expect(result.isOk()).toBe(true);

    const manifestPath = join(tempDir, ".outfitter/manifest.json");
    expect(existsSync(manifestPath)).toBe(true);

    const raw = readFileSync(manifestPath, "utf-8");
    const manifest = JSON.parse(raw) as Manifest;
    expect(manifest.version).toBe(1);
    expect(manifest.blocks["scaffolding"]).toBeDefined();
    expect(manifest.blocks["scaffolding"]?.installedFrom).toMatch(
      /^\d+\.\d+\.\d+/
    );
  });

  test("does not create manifest when noTooling is true", async () => {
    const { runInit } = await import("../commands/init.js");

    const result = await runInit({
      targetDir: tempDir,
      name: "test-project",
      preset: "minimal",
      force: false,
      noTooling: true,
    });

    expect(result.isOk()).toBe(true);

    const manifestPath = join(tempDir, ".outfitter/manifest.json");
    expect(existsSync(manifestPath)).toBe(false);
  });

  test("stamps manifest with multiple blocks from comma-separated list", async () => {
    const { runInit } = await import("../commands/init.js");

    const result = await runInit({
      targetDir: tempDir,
      name: "test-project",
      preset: "minimal",
      force: false,
      with: "claude,biome",
    });

    expect(result.isOk()).toBe(true);

    const manifestPath = join(tempDir, ".outfitter/manifest.json");
    expect(existsSync(manifestPath)).toBe(true);

    const raw = readFileSync(manifestPath, "utf-8");
    const manifest = JSON.parse(raw) as Manifest;
    expect(manifest.version).toBe(1);
    expect(manifest.blocks["claude"]).toBeDefined();
    expect(manifest.blocks["biome"]).toBeDefined();
  });
});
