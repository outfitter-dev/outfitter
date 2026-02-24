import { describe, expect, it } from "bun:test";

import {
  createActionRegistry,
  defineAction,
  Result,
} from "@outfitter/contracts";
import { z } from "zod";

import {
  type ActionManifest,
  type ActionManifestEntry,
  generateManifest,
} from "../manifest.js";

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
// Type exports
// =============================================================================

describe("type exports", () => {
  it("ActionManifest has expected shape", () => {
    const registry = createTestRegistry();
    const manifest: ActionManifest = generateManifest(registry);

    expect(manifest).toHaveProperty("version");
    expect(manifest).toHaveProperty("generatedAt");
    expect(manifest).toHaveProperty("surfaces");
    expect(manifest).toHaveProperty("actions");
    expect(manifest).toHaveProperty("errors");
    expect(manifest).toHaveProperty("outputModes");
  });

  it("ActionManifestEntry has expected shape", () => {
    const registry = createTestRegistry();
    const manifest = generateManifest(registry);
    const entry = manifest.actions[0];
    expect(entry).toBeDefined();
    const typedEntry: ActionManifestEntry = entry as ActionManifestEntry;

    expect(typedEntry).toHaveProperty("id");
    expect(typedEntry).toHaveProperty("surfaces");
    expect(typedEntry).toHaveProperty("input");
  });
});
