import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  composeMigrationGuide,
  detectVersions,
  findMigrationDocs,
  renderJSON,
  renderMarkdown,
} from "../migration-guide.js";

// ---------------------------------------------------------------------------
// detectVersions
// ---------------------------------------------------------------------------

describe("detectVersions", () => {
  function createTempPkg(
    deps: Record<string, string>,
    devDeps?: Record<string, string>
  ): string {
    const dir = mkdtempSync(join(tmpdir(), "migration-test-"));
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({
        name: "test-project",
        dependencies: deps,
        devDependencies: devDeps ?? {},
      })
    );
    return dir;
  }

  it("extracts @outfitter/* packages from dependencies", () => {
    const dir = createTempPkg({
      "@outfitter/contracts": "^0.1.0",
      "@outfitter/cli": "~0.1.0",
      zod: "^3.0.0",
    });

    const result = detectVersions(dir);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      name: "@outfitter/contracts",
      version: "0.1.0",
    });
    expect(result[1]).toEqual({ name: "@outfitter/cli", version: "0.1.0" });

    rmSync(dir, { recursive: true });
  });

  it("extracts from devDependencies too", () => {
    const dir = createTempPkg(
      { "@outfitter/contracts": "0.1.0" },
      { "@outfitter/testing": "^0.1.0" }
    );

    const result = detectVersions(dir);

    expect(result).toHaveLength(2);
    const names = result.map((r) => r.name);
    expect(names).toContain("@outfitter/contracts");
    expect(names).toContain("@outfitter/testing");

    rmSync(dir, { recursive: true });
  });

  it("sorts by dependency tier (foundation first)", () => {
    const dir = createTempPkg({
      "@outfitter/testing": "0.1.0",
      "@outfitter/cli": "0.1.0",
      "@outfitter/contracts": "0.1.0",
      "@outfitter/types": "0.1.0",
    });

    const result = detectVersions(dir);
    const names = result.map((r) => r.name);

    expect(names).toEqual([
      "@outfitter/contracts",
      "@outfitter/types",
      "@outfitter/cli",
      "@outfitter/testing",
    ]);

    rmSync(dir, { recursive: true });
  });

  it("strips version range prefixes", () => {
    const dir = createTempPkg({
      "@outfitter/contracts": ">=0.2.0",
      "@outfitter/cli": "~0.1.5",
    });

    const result = detectVersions(dir);

    expect(result[0]?.version).toBe("0.2.0");
    expect(result[1]?.version).toBe("0.1.5");

    rmSync(dir, { recursive: true });
  });

  it("returns empty array when no package.json exists", () => {
    const dir = mkdtempSync(join(tmpdir(), "migration-test-empty-"));
    const result = detectVersions(dir);
    expect(result).toEqual([]);
    rmSync(dir, { recursive: true });
  });

  it("returns empty array when no @outfitter packages", () => {
    const dir = createTempPkg({ zod: "^3.0.0", commander: "^14.0.0" });
    const result = detectVersions(dir);
    expect(result).toEqual([]);
    rmSync(dir, { recursive: true });
  });
});

// ---------------------------------------------------------------------------
// findMigrationDocs
// ---------------------------------------------------------------------------

describe("findMigrationDocs", () => {
  it("finds migration docs for contracts from 0.1.0", () => {
    const docs = findMigrationDocs("@outfitter/contracts", "0.1.0");

    expect(docs.length).toBeGreaterThanOrEqual(1);
    expect(docs[0]?.package).toBe("@outfitter/contracts");
    expect(docs[0]?.version).toBe("0.2.0");
  });

  it("returns empty when already at latest", () => {
    const docs = findMigrationDocs("@outfitter/contracts", "0.2.0");
    expect(docs).toEqual([]);
  });

  it("returns empty for unknown package", () => {
    const docs = findMigrationDocs("@outfitter/nonexistent", "0.1.0");
    expect(docs).toEqual([]);
  });

  it("parses breaking flag from frontmatter", () => {
    const docs = findMigrationDocs("@outfitter/contracts", "0.1.0");
    expect(docs.length).toBeGreaterThanOrEqual(1);
    // Our 0.2.0 docs are non-breaking
    expect(docs[0]?.breaking).toBe(false);
  });

  it("sorts docs by version ascending", () => {
    // With only 0.2.0 docs, this verifies sorting works with single doc
    const docs = findMigrationDocs("@outfitter/cli", "0.0.1");
    expect(docs.length).toBeGreaterThanOrEqual(1);

    for (let i = 1; i < docs.length; i++) {
      expect(
        Bun.semver.order(docs[i - 1]!.version, docs[i]!.version)
      ).toBeLessThanOrEqual(0);
    }
  });
});

// ---------------------------------------------------------------------------
// composeMigrationGuide
// ---------------------------------------------------------------------------

describe("composeMigrationGuide", () => {
  const installed = [
    { name: "@outfitter/contracts", version: "0.1.0" },
    { name: "@outfitter/cli", version: "0.1.0" },
    { name: "@outfitter/config", version: "0.1.0" },
  ];

  it("composes guides for all installed packages", () => {
    const guide = composeMigrationGuide(installed);

    expect(guide.installed).toEqual(installed);
    expect(guide.docs.length).toBeGreaterThanOrEqual(3);
  });

  it("filters by package name", () => {
    const guide = composeMigrationGuide(installed, "contracts");

    expect(guide.docs.every((d) => d.package === "@outfitter/contracts")).toBe(
      true
    );
  });

  it("orders docs by version then tier", () => {
    const guide = composeMigrationGuide(installed);

    // All 0.2.0 docs should have contracts before cli
    const contractsIdx = guide.docs.findIndex(
      (d) => d.package === "@outfitter/contracts"
    );
    const cliIdx = guide.docs.findIndex((d) => d.package === "@outfitter/cli");

    if (contractsIdx !== -1 && cliIdx !== -1) {
      expect(contractsIdx).toBeLessThan(cliIdx);
    }
  });

  it("returns empty docs for up-to-date packages", () => {
    const upToDate = [
      { name: "@outfitter/contracts", version: "0.2.0" },
      { name: "@outfitter/cli", version: "0.2.0" },
    ];

    const guide = composeMigrationGuide(upToDate);
    expect(guide.docs).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// renderMarkdown
// ---------------------------------------------------------------------------

describe("renderMarkdown", () => {
  it("renders installed packages table", () => {
    const guide = composeMigrationGuide([
      { name: "@outfitter/contracts", version: "0.1.0" },
    ]);

    const md = renderMarkdown(guide);

    expect(md).toContain("# Migration Guide");
    expect(md).toContain("@outfitter/contracts");
    expect(md).toContain("0.1.0");
  });

  it("renders up-to-date message when no migrations", () => {
    const guide: {
      installed: { name: string; version: string }[];
      docs: never[];
    } = {
      installed: [{ name: "@outfitter/contracts", version: "0.2.0" }],
      docs: [],
    };

    const md = renderMarkdown(guide);
    expect(md).toContain("All packages are up to date");
  });

  it("strips frontmatter from doc content", () => {
    const guide = composeMigrationGuide([
      { name: "@outfitter/contracts", version: "0.1.0" },
    ]);

    const md = renderMarkdown(guide);
    expect(md).not.toContain("---\npackage:");
  });
});

// ---------------------------------------------------------------------------
// renderJSON
// ---------------------------------------------------------------------------

describe("renderJSON", () => {
  it("produces valid JSON", () => {
    const guide = composeMigrationGuide([
      { name: "@outfitter/contracts", version: "0.1.0" },
    ]);

    const json = renderJSON(guide);
    const parsed = JSON.parse(json);

    expect(parsed.installed).toBeDefined();
    expect(parsed.migrations).toBeDefined();
    expect(typeof parsed.totalMigrations).toBe("number");
    expect(typeof parsed.hasBreaking).toBe("boolean");
  });

  it("includes migration metadata without full content", () => {
    const guide = composeMigrationGuide([
      { name: "@outfitter/contracts", version: "0.1.0" },
    ]);

    const json = renderJSON(guide);
    const parsed = JSON.parse(json);

    for (const m of parsed.migrations) {
      expect(m.package).toBeDefined();
      expect(m.version).toBeDefined();
      expect(typeof m.breaking).toBe("boolean");
      expect(m.filePath).toBeDefined();
      // Content should not be in JSON output
      expect(m.content).toBeUndefined();
    }
  });

  it("reports hasBreaking correctly for non-breaking migrations", () => {
    const guide = composeMigrationGuide([
      { name: "@outfitter/contracts", version: "0.1.0" },
    ]);

    const parsed = JSON.parse(renderJSON(guide));
    expect(parsed.hasBreaking).toBe(false);
  });
});
