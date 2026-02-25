/**
 * Tests for `outfitter init` command scaffolding behavior.
 *
 * @packageDocumentation
 */

import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  setupInitTestHarness,
  tempDir,
  workspaceVersion,
} from "./helpers/init-test-harness.js";

setupInitTestHarness();

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
    expect(packageJson.devDependencies["@outfitter/oxlint-plugin"]).toBe(
      workspaceVersion("@outfitter/oxlint-plugin")
    );
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

    expect(existsSync(join(tempDir, ".oxlintrc.json"))).toBe(false);

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
    expect(existsSync(join(tempDir, ".oxlintrc.json"))).toBe(true);
    expect(existsSync(join(tempDir, "apps", "cli", ".oxlintrc.json"))).toBe(
      false
    );
    expect(existsSync(join(tempDir, "apps", "mcp", ".oxlintrc.json"))).toBe(
      false
    );
    expect(
      existsSync(join(tempDir, "packages", "core", ".oxlintrc.json"))
    ).toBe(false);
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

  test("uses minimal preset by default", async () => {
    const { runInit } = await import("../commands/init.js");

    await runInit({
      targetDir: tempDir,
      name: "test-project",
      force: false,
    });

    // Should succeed without error using minimal preset
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
