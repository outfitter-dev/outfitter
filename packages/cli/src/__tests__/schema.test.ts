import { describe, expect, it } from "bun:test";
import {
  createActionRegistry,
  defineAction,
  Result,
} from "@outfitter/contracts";
import { z } from "zod";
import {
  createSchemaCommand,
  formatManifestHuman,
  generateManifest,
} from "../schema.js";

// =============================================================================
// Test Fixtures
// =============================================================================

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
});
