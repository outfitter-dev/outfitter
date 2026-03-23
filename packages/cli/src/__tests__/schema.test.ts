import { describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createActionRegistry,
  defineAction,
  Result,
} from "@outfitter/contracts";
import { z } from "zod";

import { createCLI } from "../command.js";
import {
  createSchemaCommand,
  formatManifestHuman,
  generateManifest,
} from "../schema.js";

// =============================================================================
// Test Fixtures
// =============================================================================

interface CapturedOutput {
  readonly stderr: string;
  readonly stdout: string;
}

async function captureOutput(
  fn: () => void | Promise<void>
): Promise<CapturedOutput> {
  let stdout = "";
  let stderr = "";

  const originalStdoutWrite = process.stdout.write.bind(process.stdout);
  const originalStderrWrite = process.stderr.write.bind(process.stderr);

  process.stdout.write = (chunk: string | Uint8Array): boolean => {
    stdout +=
      typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk);
    return true;
  };

  process.stderr.write = (chunk: string | Uint8Array): boolean => {
    stderr +=
      typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk);
    return true;
  };

  try {
    await fn();
  } finally {
    process.stdout.write = originalStdoutWrite;
    process.stderr.write = originalStderrWrite;
  }

  return { stdout, stderr };
}

function createTestRegistry() {
  return createActionRegistry()
    .add(
      defineAction({
        id: "init",
        description: "Create a new project",
        surfaces: ["cli"],
        input: z.object({
          directory: z.string().optional(),
          name: z.string().optional(),
          force: z.boolean().optional(),
        }),
        cli: {
          group: "init",
          command: "[directory]",
          description: "Create a new Outfitter project",
          options: [
            {
              flags: "-n, --name <name>",
              description: "Package name",
            },
            {
              flags: "-f, --force",
              description: "Overwrite existing files",
              defaultValue: false,
            },
          ],
          mapInput: () => ({}),
        },
        handler: async () => Result.ok({ ok: true }),
      })
    )
    .add(
      defineAction({
        id: "init.cli",
        description: "Create a new CLI project",
        surfaces: ["cli"],
        input: z.object({
          directory: z.string().optional(),
        }),
        cli: {
          group: "init",
          command: "cli [directory]",
          description: "Create a new CLI project",
          mapInput: () => ({}),
        },
        handler: async () => Result.ok({ ok: true }),
      })
    )
    .add(
      defineAction({
        id: "check",
        description: "Compare local config against registry",
        surfaces: ["cli"],
        input: z.object({}),
        cli: {
          command: "check",
          description: "Compare local config blocks against registry",
        },
        handler: async () => Result.ok({ ok: true }),
      })
    )
    .add(
      defineAction({
        id: "doctor",
        description: "Validate environment and dependencies",
        surfaces: ["cli", "mcp"],
        input: z.object({
          verbose: z.boolean().optional(),
        }),
        cli: {
          command: "doctor",
          description: "Validate environment and dependencies",
          options: [
            {
              flags: "-v, --verbose",
              description: "Show detailed output",
              defaultValue: false,
            },
          ],
        },
        mcp: {
          tool: "doctor",
          description: "Validate environment",
        },
        handler: async () => Result.ok({ ok: true }),
      })
    );
}

// =============================================================================
// generateManifest
// =============================================================================

describe("generateManifest", () => {
  it("generates manifest from registry", () => {
    const registry = createTestRegistry();
    const manifest = generateManifest(registry);

    expect(manifest.version).toBe("1.0.0");
    expect(manifest.generatedAt).toBeTruthy();
    expect(manifest.actions.length).toBe(4);
  });

  it("includes error taxonomy", () => {
    const registry = createTestRegistry();
    const manifest = generateManifest(registry);

    expect(manifest.errors["validation"]).toEqual({ exit: 1, http: 400 });
    expect(manifest.errors["not_found"]).toEqual({ exit: 2, http: 404 });
    expect(manifest.errors["cancelled"]).toEqual({ exit: 130, http: 499 });
  });

  it("includes output modes", () => {
    const registry = createTestRegistry();
    const manifest = generateManifest(registry);

    expect(manifest.outputModes).toContain("human");
    expect(manifest.outputModes).toContain("json");
    expect(manifest.outputModes).toContain("jsonl");
  });

  it("detects surfaces from actions", () => {
    const registry = createTestRegistry();
    const manifest = generateManifest(registry);

    expect(manifest.surfaces).toContain("cli");
    expect(manifest.surfaces).toContain("mcp");
  });

  it("converts input schema to JSON Schema", () => {
    const registry = createTestRegistry();
    const manifest = generateManifest(registry);

    const checkAction = manifest.actions.find((a) => a.id === "check");
    expect(checkAction?.input).toEqual({ type: "object", properties: {} });
  });

  it("includes CLI metadata", () => {
    const registry = createTestRegistry();
    const manifest = generateManifest(registry);

    const initAction = manifest.actions.find((a) => a.id === "init");
    expect(initAction?.cli?.group).toBe("init");
    expect(initAction?.cli?.command).toBe("[directory]");
    expect(initAction?.cli?.options).toHaveLength(2);
  });

  it("includes MCP metadata when present", () => {
    const registry = createTestRegistry();
    const manifest = generateManifest(registry);

    const doctorAction = manifest.actions.find((a) => a.id === "doctor");
    expect(doctorAction?.mcp?.tool).toBe("doctor");
  });

  it("filters by surface", () => {
    const registry = createTestRegistry();
    const manifest = generateManifest(registry, { surface: "mcp" });

    expect(manifest.actions.length).toBe(1);
    expect(manifest.actions[0]?.id).toBe("doctor");
  });

  it("includes custom version", () => {
    const registry = createTestRegistry();
    const manifest = generateManifest(registry, { version: "2.0.0" });

    expect(manifest.version).toBe("2.0.0");
  });

  it("accepts array source", () => {
    const registry = createTestRegistry();
    const manifest = generateManifest(registry.list());

    expect(manifest.actions.length).toBe(4);
  });
});

// =============================================================================
// formatManifestHuman
// =============================================================================

describe("formatManifestHuman", () => {
  it("formats summary with action count and surfaces", () => {
    const registry = createTestRegistry();
    const manifest = generateManifest(registry);
    const output = formatManifestHuman(manifest, "outfitter");

    expect(output).toContain("outfitter");
    expect(output).toContain("4 actions");
  });

  it("shows grouped commands", () => {
    const registry = createTestRegistry();
    const manifest = generateManifest(registry);
    const output = formatManifestHuman(manifest);

    expect(output).toContain("init");
    expect(output).toContain("Create a new Outfitter project");
  });

  it("shows ungrouped commands", () => {
    const registry = createTestRegistry();
    const manifest = generateManifest(registry);
    const output = formatManifestHuman(manifest);

    expect(output).toContain("check");
    expect(output).toContain("doctor");
  });

  it("includes footer hints", () => {
    const registry = createTestRegistry();
    const manifest = generateManifest(registry);
    const output = formatManifestHuman(manifest);

    expect(output).toContain("--output json");
  });

  it("formats single action detail", () => {
    const registry = createTestRegistry();
    const manifest = generateManifest(registry);
    const doctorEntry = manifest.actions.find((a) => a.id === "doctor");
    const output = formatManifestHuman(manifest, undefined, doctorEntry?.id);

    expect(output).toContain("doctor");
    expect(output).toContain("Validate environment and dependencies");
    expect(output).toContain("--verbose");
  });
});

// =============================================================================
// createSchemaCommand
// =============================================================================

describe("createSchemaCommand", () => {
  it("creates a command named 'schema'", () => {
    const registry = createTestRegistry();
    const cmd = createSchemaCommand(registry);

    expect(cmd.name()).toBe("schema");
  });

  it("has description", () => {
    const registry = createTestRegistry();
    const cmd = createSchemaCommand(registry);

    expect(cmd.description()).toBeTruthy();
  });

  it("accepts optional action argument", () => {
    const registry = createTestRegistry();
    const cmd = createSchemaCommand(registry);
    const args = cmd.registeredArguments;

    expect(args).toHaveLength(1);
    expect(args[0]?.name()).toBe("action");
  });

  it("has --output option", () => {
    const registry = createTestRegistry();
    const cmd = createSchemaCommand(registry);
    const options = cmd.options.map((o) => o.long);

    expect(options).toContain("--output");
  });

  it("has --surface option", () => {
    const registry = createTestRegistry();
    const cmd = createSchemaCommand(registry);
    const options = cmd.options.map((o) => o.long);

    expect(options).toContain("--surface");
  });

  it("has --pretty option", () => {
    const registry = createTestRegistry();
    const cmd = createSchemaCommand(registry);
    const options = cmd.options.map((o) => o.long);

    expect(options).toContain("--pretty");
  });

  it("has show subcommand", () => {
    const registry = createTestRegistry();
    const cmd = createSchemaCommand(registry);
    const subcommands = cmd.commands.map((c) => c.name());

    expect(subcommands).toContain("show");
  });

  it("does not have generate/diff/docs without surface option", () => {
    const registry = createTestRegistry();
    const cmd = createSchemaCommand(registry);
    const subcommands = cmd.commands.map((c) => c.name());

    expect(subcommands).not.toContain("generate");
    expect(subcommands).not.toContain("diff");
    expect(subcommands).not.toContain("docs");
  });

  it("has generate, diff, and docs subcommands with surface option", () => {
    const registry = createTestRegistry();
    const cmd = createSchemaCommand(registry, { surface: {} });
    const subcommands = cmd.commands.map((c) => c.name());

    expect(subcommands).toContain("show");
    expect(subcommands).toContain("generate");
    expect(subcommands).toContain("diff");
    expect(subcommands).toContain("docs");
  });

  it("generate subcommand has --dry-run and --snapshot options", () => {
    const registry = createTestRegistry();
    const cmd = createSchemaCommand(registry, { surface: {} });
    const generateCmd = cmd.commands.find((c) => c.name() === "generate");
    const options = generateCmd?.options.map((o) => o.long) ?? [];

    expect(options).toContain("--dry-run");
    expect(options).toContain("--snapshot");
  });

  it("diff subcommand has --output option", () => {
    const registry = createTestRegistry();
    const cmd = createSchemaCommand(registry, { surface: {} });
    const diffCmd = cmd.commands.find((c) => c.name() === "diff");
    const options = diffCmd?.options.map((o) => o.long) ?? [];

    expect(options).toContain("--output");
  });

  it("diff subcommand has --against option", () => {
    const registry = createTestRegistry();
    const cmd = createSchemaCommand(registry, { surface: {} });
    const diffCmd = cmd.commands.find((c) => c.name() === "diff");
    const options = diffCmd?.options.map((o) => o.long) ?? [];

    expect(options).toContain("--against");
  });

  it("diff subcommand has --from and --to options", () => {
    const registry = createTestRegistry();
    const cmd = createSchemaCommand(registry, { surface: {} });
    const diffCmd = cmd.commands.find((c) => c.name() === "diff");
    const options = diffCmd?.options.map((o) => o.long) ?? [];

    expect(options).toContain("--from");
    expect(options).toContain("--to");
  });

  it("docs subcommand has --surface, --output-dir, and --dry-run options", () => {
    const registry = createTestRegistry();
    const cmd = createSchemaCommand(registry, { surface: {} });
    const docsCmd = cmd.commands.find((c) => c.name() === "docs");
    const options = docsCmd?.options.map((o) => o.long) ?? [];

    expect(options).toContain("--surface");
    expect(options).toContain("--output-dir");
    expect(options).toContain("--dry-run");
  });

  it("show subcommand honors --output json when invoked through the parent schema command", async () => {
    const registry = createTestRegistry();
    const cmd = createSchemaCommand(registry);
    const originalExitCode = process.exitCode ?? 0;

    try {
      process.exitCode = 0;
      const { stdout, stderr } = await captureOutput(async () => {
        await cmd.parseAsync(
          ["node", "schema", "show", "doctor", "--output", "json"],
          {
            from: "node",
          }
        );
      });
      const parsed = JSON.parse(stdout) as {
        description: string;
        id: string;
      };

      expect(parsed.id).toBe("doctor");
      expect(parsed.description).toBe("Validate environment and dependencies");
      expect(stderr).toBe("");
      expect(process.exitCode).toBe(0);
    } finally {
      process.exitCode = originalExitCode;
    }
  });

  it("schema diff honors --output json when mounted under createCLI()", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "schema-root-diff-"));
    const outfitterDir = join(tempDir, ".outfitter");
    await mkdir(outfitterDir, { recursive: true });
    await writeFile(
      join(outfitterDir, "surface.lock"),
      "0000000000000000000000000000000000000000000000000000000000000000\n",
      "utf-8"
    );

    const cli = createCLI({ name: "outfitter", version: "0.0.0" });
    cli.register(
      createSchemaCommand(createTestRegistry(), {
        programName: "outfitter",
        surface: { cwd: tempDir },
      })
    );
    const originalExitCode = process.exitCode ?? 0;

    try {
      process.exitCode = 0;
      const { stdout, stderr } = await captureOutput(async () => {
        await cli.parse([
          "node",
          "outfitter",
          "schema",
          "diff",
          "--output",
          "json",
        ]);
      });
      const parsed = JSON.parse(stdout) as {
        hasChanges: boolean;
        hashMismatch: boolean;
      };

      expect(parsed.hasChanges).toBe(true);
      expect(parsed.hashMismatch).toBe(true);
      expect(stderr).toBe("");
      expect(process.exitCode).toBe(1);
    } finally {
      process.exitCode = originalExitCode;
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("diff emits structured JSON when surface.lock mismatches and _surface.json is absent", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "schema-diff-"));
    const outfitterDir = join(tempDir, ".outfitter");
    await mkdir(outfitterDir, { recursive: true });
    await writeFile(
      join(outfitterDir, "surface.lock"),
      "0000000000000000000000000000000000000000000000000000000000000000\n",
      "utf-8"
    );

    const registry = createActionRegistry().add(
      defineAction({
        id: "doctor",
        description: "Validate environment and dependencies",
        surfaces: ["cli", "mcp"],
        input: z.object({
          verbose: z.boolean().optional(),
        }),
        cli: {
          command: "doctor",
          description: "Validate environment and dependencies",
        },
        mcp: {
          tool: "doctor",
          description: "Validate environment",
        },
        handler: async () => Result.ok({ ok: true }),
      })
    );
    const cmd = createSchemaCommand(registry, {
      surface: { cwd: tempDir },
    });
    const originalExitCode = process.exitCode ?? 0;

    try {
      process.exitCode = 0;
      const { stdout, stderr } = await captureOutput(async () => {
        await cmd.parseAsync(["node", "schema", "diff", "--output", "json"], {
          from: "node",
        });
      });
      const parsed = JSON.parse(stdout) as {
        hasChanges: boolean;
        hashMismatch: boolean;
      };

      expect(parsed.hasChanges).toBe(true);
      expect(parsed.hashMismatch).toBe(true);
      expect(stderr).toBe("");
      expect(process.exitCode).toBe(1);
    } finally {
      process.exitCode = originalExitCode;
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
