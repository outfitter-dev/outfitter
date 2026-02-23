import { describe, expect, it } from "bun:test";
import {
  createActionRegistry,
  defineAction,
  Result,
} from "@outfitter/contracts";
import { z } from "zod";
import { diffSurfaceMaps } from "../diff.js";
import { generateSurfaceMap } from "../surface.js";

// =============================================================================
// Test Fixtures
// =============================================================================

function createBaseRegistry() {
  return createActionRegistry()
    .add(
      defineAction({
        id: "init",
        description: "Create a new project",
        surfaces: ["cli"],
        input: z.object({
          name: z.string().optional(),
        }),
        cli: { command: "init [name]", description: "Create a new project" },
        handler: async () => Result.ok({ ok: true }),
      })
    )
    .add(
      defineAction({
        id: "doctor",
        description: "Validate environment",
        surfaces: ["cli", "mcp"],
        input: z.object({}),
        cli: { command: "doctor" },
        mcp: { tool: "doctor" },
        handler: async () => Result.ok({ ok: true }),
      })
    );
}

// =============================================================================
// diffSurfaceMaps
// =============================================================================

describe("diffSurfaceMaps", () => {
  it("reports no changes for identical maps", () => {
    const registry = createBaseRegistry();
    const committed = generateSurfaceMap(registry);
    const current = generateSurfaceMap(registry);

    const diff = diffSurfaceMaps(committed, current);

    expect(diff.hasChanges).toBe(false);
    expect(diff.added).toHaveLength(0);
    expect(diff.removed).toHaveLength(0);
    expect(diff.modified).toHaveLength(0);
  });

  it("detects added actions", () => {
    const baseRegistry = createBaseRegistry();
    const committed = generateSurfaceMap(baseRegistry);

    const extendedRegistry = createBaseRegistry().add(
      defineAction({
        id: "check",
        description: "Run checks",
        surfaces: ["cli"],
        input: z.object({}),
        cli: { command: "check" },
        handler: async () => Result.ok({ ok: true }),
      })
    );
    const current = generateSurfaceMap(extendedRegistry);

    const diff = diffSurfaceMaps(committed, current);

    expect(diff.hasChanges).toBe(true);
    expect(diff.added).toHaveLength(1);
    expect(diff.added[0]?.id).toBe("check");
  });

  it("detects removed actions", () => {
    const fullRegistry = createBaseRegistry();
    const committed = generateSurfaceMap(fullRegistry);

    const reducedRegistry = createActionRegistry().add(
      defineAction({
        id: "init",
        description: "Create a new project",
        surfaces: ["cli"],
        input: z.object({
          name: z.string().optional(),
        }),
        cli: {
          command: "init [name]",
          description: "Create a new project",
        },
        handler: async () => Result.ok({ ok: true }),
      })
    );
    const current = generateSurfaceMap(reducedRegistry);

    const diff = diffSurfaceMaps(committed, current);

    expect(diff.hasChanges).toBe(true);
    expect(diff.removed).toHaveLength(1);
    expect(diff.removed[0]?.id).toBe("doctor");
  });

  it("detects modified actions (changed input schema)", () => {
    const baseRegistry = createBaseRegistry();
    const committed = generateSurfaceMap(baseRegistry);

    const modifiedRegistry = createActionRegistry()
      .add(
        defineAction({
          id: "init",
          description: "Create a new project",
          surfaces: ["cli"],
          input: z.object({
            name: z.string().optional(),
            force: z.boolean().optional(), // new field
          }),
          cli: {
            command: "init [name]",
            description: "Create a new project",
          },
          handler: async () => Result.ok({ ok: true }),
        })
      )
      .add(
        defineAction({
          id: "doctor",
          description: "Validate environment",
          surfaces: ["cli", "mcp"],
          input: z.object({}),
          cli: { command: "doctor" },
          mcp: { tool: "doctor" },
          handler: async () => Result.ok({ ok: true }),
        })
      );
    const current = generateSurfaceMap(modifiedRegistry);

    const diff = diffSurfaceMaps(committed, current);

    expect(diff.hasChanges).toBe(true);
    expect(diff.modified).toHaveLength(1);
    expect(diff.modified[0]?.id).toBe("init");
    expect(diff.modified[0]?.changes).toContain("input");
  });

  it("detects modified actions (changed surfaces)", () => {
    const baseRegistry = createBaseRegistry();
    const committed = generateSurfaceMap(baseRegistry);

    const modifiedRegistry = createActionRegistry()
      .add(
        defineAction({
          id: "init",
          description: "Create a new project",
          surfaces: ["cli"],
          input: z.object({
            name: z.string().optional(),
          }),
          cli: {
            command: "init [name]",
            description: "Create a new project",
          },
          handler: async () => Result.ok({ ok: true }),
        })
      )
      .add(
        defineAction({
          id: "doctor",
          description: "Validate environment",
          surfaces: ["cli"], // removed mcp surface
          input: z.object({}),
          cli: { command: "doctor" },
          handler: async () => Result.ok({ ok: true }),
        })
      );
    const current = generateSurfaceMap(modifiedRegistry);

    const diff = diffSurfaceMaps(committed, current);

    expect(diff.hasChanges).toBe(true);
    expect(diff.modified).toHaveLength(1);
    expect(diff.modified[0]?.id).toBe("doctor");
    expect(diff.modified[0]?.changes).toContain("surfaces");
  });

  it("detects modified actions (changed description)", () => {
    const baseRegistry = createBaseRegistry();
    const committed = generateSurfaceMap(baseRegistry);

    const modifiedRegistry = createActionRegistry()
      .add(
        defineAction({
          id: "init",
          description: "Initialize a new project", // changed desc
          surfaces: ["cli"],
          input: z.object({
            name: z.string().optional(),
          }),
          cli: {
            command: "init [name]",
            description: "Initialize a new project",
          },
          handler: async () => Result.ok({ ok: true }),
        })
      )
      .add(
        defineAction({
          id: "doctor",
          description: "Validate environment",
          surfaces: ["cli", "mcp"],
          input: z.object({}),
          cli: { command: "doctor" },
          mcp: { tool: "doctor" },
          handler: async () => Result.ok({ ok: true }),
        })
      );
    const current = generateSurfaceMap(modifiedRegistry);

    const diff = diffSurfaceMaps(committed, current);

    expect(diff.hasChanges).toBe(true);
    expect(diff.modified).toHaveLength(1);
    expect(diff.modified[0]?.id).toBe("init");
    expect(diff.modified[0]?.changes).toContain("description");
  });

  it("ignores volatile fields (generatedAt)", () => {
    const registry = createBaseRegistry();
    const committed = generateSurfaceMap(registry);

    // Simulate different generatedAt
    const current = {
      ...generateSurfaceMap(registry),
      generatedAt: "2099-01-01T00:00:00.000Z",
    };

    const diff = diffSurfaceMaps(committed, current);

    expect(diff.hasChanges).toBe(false);
    expect(diff.metadataChanges).toHaveLength(0);
  });

  it("detects top-level metadata changes (version)", () => {
    const registry = createBaseRegistry();
    const committed = generateSurfaceMap(registry);

    const current = {
      ...generateSurfaceMap(registry),
      version: "2.0.0",
    };

    const diff = diffSurfaceMaps(committed, current);

    expect(diff.hasChanges).toBe(true);
    expect(diff.metadataChanges).toContain("version");
  });

  it("detects top-level metadata changes (outputModes)", () => {
    const registry = createBaseRegistry();
    const committed = generateSurfaceMap(registry);

    const current = {
      ...generateSurfaceMap(registry),
      outputModes: ["human", "json"],
    };

    const diff = diffSurfaceMaps(committed, current);

    expect(diff.hasChanges).toBe(true);
    expect(diff.metadataChanges).toContain("outputModes");
  });

  it("detects missing $schema metadata (present vs missing)", () => {
    const registry = createBaseRegistry();
    const committed = generateSurfaceMap(registry, { generator: "build" });
    const current = {
      ...generateSurfaceMap(registry, { generator: "runtime" }),
    } as Record<string, unknown>;
    delete current.$schema;

    const diff = diffSurfaceMaps(
      committed,
      current as unknown as typeof committed
    );

    expect(diff.hasChanges).toBe(true);
    expect(diff.metadataChanges).toContain("$schema");
  });

  it("detects missing generator metadata (present vs missing)", () => {
    const registry = createBaseRegistry();
    const committed = generateSurfaceMap(registry, { generator: "build" });
    const current = {
      ...generateSurfaceMap(registry, { generator: "runtime" }),
    } as Record<string, unknown>;
    delete current.generator;

    const diff = diffSurfaceMaps(
      committed,
      current as unknown as typeof committed
    );

    expect(diff.hasChanges).toBe(true);
    expect(diff.metadataChanges).toContain("generator");
  });

  it("flags generator drift when both sides omit the metadata", () => {
    const registry = createBaseRegistry();
    const baseSurface = generateSurfaceMap(registry, { generator: "build" });

    const committed = { ...baseSurface } as Record<string, unknown>;
    const current = { ...baseSurface } as Record<string, unknown>;

    delete committed.generator;
    delete current.generator;

    const diff = diffSurfaceMaps(
      committed as unknown as typeof baseSurface,
      current as unknown as typeof baseSurface
    );

    expect(diff.hasChanges).toBe(true);
    expect(diff.metadataChanges).toContain("generator");
  });

  it("requires build/runtime generator pair in committed-to-runtime mode", () => {
    const registry = createBaseRegistry();
    const committed = generateSurfaceMap(registry, { generator: "runtime" });
    const current = generateSurfaceMap(registry, { generator: "runtime" });

    const diff = diffSurfaceMaps(committed, current, {
      mode: "committed-to-runtime",
    });

    expect(diff.hasChanges).toBe(true);
    expect(diff.metadataChanges).toContain("generator");
  });

  it("treats build/runtime generator pair as valid in committed-to-runtime mode", () => {
    const registry = createBaseRegistry();
    const committed = generateSurfaceMap(registry, { generator: "build" });
    const current = generateSurfaceMap(registry, { generator: "runtime" });

    const diff = diffSurfaceMaps(committed, current, {
      mode: "committed-to-runtime",
    });

    expect(diff.metadataChanges).not.toContain("generator");
  });

  it("treats generator mismatch as drift in snapshot-to-snapshot mode", () => {
    const registry = createBaseRegistry();
    const from = generateSurfaceMap(registry, { generator: "build" });
    const to = generateSurfaceMap(registry, { generator: "runtime" });

    const diff = diffSurfaceMaps(from, to, { mode: "snapshot-to-snapshot" });

    expect(diff.hasChanges).toBe(true);
    expect(diff.metadataChanges).toContain("generator");
  });

  it("detects multiple changes at once", () => {
    const baseRegistry = createBaseRegistry();
    const committed = generateSurfaceMap(baseRegistry);

    // Add one, modify one — "doctor" is removed, "init" is modified, "check" added
    const newRegistry = createActionRegistry()
      .add(
        defineAction({
          id: "init",
          description: "Create a new project v2",
          surfaces: ["cli", "mcp"], // added mcp
          input: z.object({ name: z.string().optional() }),
          cli: {
            command: "init [name]",
            description: "Create a new project v2",
          },
          handler: async () => Result.ok({ ok: true }),
        })
      )
      .add(
        defineAction({
          id: "check",
          description: "Run checks",
          surfaces: ["cli"],
          input: z.object({}),
          cli: { command: "check" },
          handler: async () => Result.ok({ ok: true }),
        })
      );
    const current = generateSurfaceMap(newRegistry);

    const diff = diffSurfaceMaps(committed, current);

    expect(diff.hasChanges).toBe(true);
    expect(diff.added.length).toBeGreaterThanOrEqual(1);
    expect(diff.removed.length).toBeGreaterThanOrEqual(1);
    expect(diff.modified.length).toBeGreaterThanOrEqual(1);
  });
});
