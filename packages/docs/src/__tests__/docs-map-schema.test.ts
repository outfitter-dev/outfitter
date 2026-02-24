import { describe, expect, it } from "bun:test";

import {
  type DocKind,
  DocKindSchema,
  type DocsMap,
  type DocsMapEntry,
  DocsMapEntrySchema,
  DocsMapSchema,
} from "../core/docs-map-schema.js";

// =============================================================================
// DocKindSchema
// =============================================================================

describe("DocKindSchema", () => {
  it("accepts all expected document kinds", () => {
    const expectedKinds: readonly string[] = [
      "readme",
      "guide",
      "reference",
      "architecture",
      "release",
      "convention",
      "deep",
      "generated",
    ];

    for (const kind of expectedKinds) {
      const result = DocKindSchema.safeParse(kind);
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid document kinds", () => {
    const result = DocKindSchema.safeParse("blog");
    expect(result.success).toBe(false);
  });

  it("has exactly 8 members", () => {
    expect(DocKindSchema.options).toHaveLength(8);
  });
});

// =============================================================================
// DocsMapEntrySchema
// =============================================================================

describe("DocsMapEntrySchema", () => {
  const validEntry = {
    id: "cli/README.md",
    kind: "readme",
    title: "CLI Package",
    sourcePath: "packages/cli/README.md",
    outputPath: "docs/packages/cli/README.md",
  };

  it("parses a valid entry with required fields only", () => {
    const result = DocsMapEntrySchema.safeParse(validEntry);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe("cli/README.md");
      expect(result.data.kind).toBe("readme");
      expect(result.data.tags).toEqual([]);
    }
  });

  it("parses a valid entry with all optional fields", () => {
    const fullEntry = {
      ...validEntry,
      package: "@outfitter/cli",
      tags: ["api", "public"],
    };
    const result = DocsMapEntrySchema.safeParse(fullEntry);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.package).toBe("@outfitter/cli");
      expect(result.data.tags).toEqual(["api", "public"]);
    }
  });

  it("defaults tags to an empty array when omitted", () => {
    const result = DocsMapEntrySchema.safeParse(validEntry);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tags).toEqual([]);
    }
  });

  it("rejects an entry missing required id", () => {
    const { id: _, ...noId } = validEntry;
    const result = DocsMapEntrySchema.safeParse(noId);
    expect(result.success).toBe(false);
  });

  it("rejects an entry missing required kind", () => {
    const { kind: _, ...noKind } = validEntry;
    const result = DocsMapEntrySchema.safeParse(noKind);
    expect(result.success).toBe(false);
  });

  it("rejects an entry with an invalid kind", () => {
    const result = DocsMapEntrySchema.safeParse({
      ...validEntry,
      kind: "invalid",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an entry missing required title", () => {
    const { title: _, ...noTitle } = validEntry;
    const result = DocsMapEntrySchema.safeParse(noTitle);
    expect(result.success).toBe(false);
  });

  it("rejects an entry missing required sourcePath", () => {
    const { sourcePath: _, ...noSource } = validEntry;
    const result = DocsMapEntrySchema.safeParse(noSource);
    expect(result.success).toBe(false);
  });

  it("rejects an entry missing required outputPath", () => {
    const { outputPath: _, ...noOutput } = validEntry;
    const result = DocsMapEntrySchema.safeParse(noOutput);
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// DocsMapSchema
// =============================================================================

describe("DocsMapSchema", () => {
  const validMap = {
    generatedAt: "2026-02-21T12:00:00.000Z",
    generator: "@outfitter/docs@0.1.2",
    entries: [
      {
        id: "cli/README.md",
        kind: "readme" as const,
        title: "CLI Package",
        sourcePath: "packages/cli/README.md",
        outputPath: "docs/packages/cli/README.md",
        package: "@outfitter/cli",
      },
      {
        id: "architecture",
        kind: "architecture" as const,
        title: "Architecture",
        sourcePath: "docs/ARCHITECTURE.md",
        outputPath: "docs/ARCHITECTURE.md",
        tags: ["overview"],
      },
    ],
  };

  it("parses a valid docs map", () => {
    const result = DocsMapSchema.safeParse(validMap);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.generatedAt).toBe("2026-02-21T12:00:00.000Z");
      expect(result.data.generator).toBe("@outfitter/docs@0.1.2");
      expect(result.data.entries).toHaveLength(2);
    }
  });

  it("accepts an optional $schema field", () => {
    const withSchema = {
      ...validMap,
      $schema: "https://outfitter.dev/docs-map/v1",
    };
    const result = DocsMapSchema.safeParse(withSchema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.$schema).toBe("https://outfitter.dev/docs-map/v1");
    }
  });

  it("parses a docs map with zero entries", () => {
    const emptyMap = { ...validMap, entries: [] };
    const result = DocsMapSchema.safeParse(emptyMap);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.entries).toEqual([]);
    }
  });

  it("rejects a docs map missing generatedAt", () => {
    const { generatedAt: _, ...noTimestamp } = validMap;
    const result = DocsMapSchema.safeParse(noTimestamp);
    expect(result.success).toBe(false);
  });

  it("rejects a docs map missing generator", () => {
    const { generator: _, ...noGenerator } = validMap;
    const result = DocsMapSchema.safeParse(noGenerator);
    expect(result.success).toBe(false);
  });

  it("rejects a docs map with a non-ISO generatedAt value", () => {
    const result = DocsMapSchema.safeParse({
      ...validMap,
      generatedAt: "not-a-timestamp",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a docs map missing entries", () => {
    const { entries: _, ...noEntries } = validMap;
    const result = DocsMapSchema.safeParse(noEntries);
    expect(result.success).toBe(false);
  });

  it("rejects a docs map with invalid entries", () => {
    const badMap = { ...validMap, entries: [{ id: "only-id" }] };
    const result = DocsMapSchema.safeParse(badMap);
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// Type inference
// =============================================================================

describe("type inference", () => {
  it("infers DocKind as a union of string literals", () => {
    const kind: DocKind = "readme";
    expect(DocKindSchema.safeParse(kind).success).toBe(true);
  });

  it("infers DocsMapEntry with correct shape", () => {
    const entry: DocsMapEntry = {
      id: "test",
      kind: "guide",
      title: "Test Guide",
      sourcePath: "docs/test.md",
      outputPath: "docs/test.md",
      tags: [],
    };
    expect(DocsMapEntrySchema.safeParse(entry).success).toBe(true);
  });

  it("infers DocsMap with correct shape", () => {
    const map: DocsMap = {
      generatedAt: new Date().toISOString(),
      generator: "@outfitter/docs@0.1.2",
      entries: [],
    };
    expect(DocsMapSchema.safeParse(map).success).toBe(true);
  });
});
