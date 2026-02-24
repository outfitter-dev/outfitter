/**
 * Tests for structured migration frontmatter parsing.
 *
 * Tests parseMigrationFrontmatter() and the MigrationChange types
 * introduced for codemod infrastructure.
 *
 * @packageDocumentation
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  parseMigrationFrontmatter,
  readMigrationDocsWithMetadata,
} from "../commands/upgrade.js";

// =============================================================================
// Test Utilities
// =============================================================================

function createTempDir(): string {
  const tempDir = join(
    tmpdir(),
    `outfitter-frontmatter-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  mkdirSync(tempDir, { recursive: true });
  return tempDir;
}

function cleanupTempDir(dir: string): void {
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
}

// =============================================================================
// Test Setup/Teardown
// =============================================================================

let tempDir: string;

beforeEach(() => {
  tempDir = createTempDir();
});

afterEach(() => {
  cleanupTempDir(tempDir);
});

// =============================================================================
// parseMigrationFrontmatter — Basic Fields
// =============================================================================

describe("parseMigrationFrontmatter", () => {
  test("parses basic frontmatter fields", () => {
    const content = `---
package: "@outfitter/cli"
version: 0.4.0
breaking: true
---

# Migration content here`;

    const result = parseMigrationFrontmatter(content);

    expect(result).not.toBeNull();
    expect(result?.package).toBe("@outfitter/cli");
    expect(result?.version).toBe("0.4.0");
    expect(result?.breaking).toBe(true);
  });

  test("parses non-breaking frontmatter", () => {
    const content = `---
package: "@outfitter/contracts"
version: 0.2.1
breaking: false
---

# Content`;

    const result = parseMigrationFrontmatter(content);

    expect(result).not.toBeNull();
    expect(result?.breaking).toBe(false);
  });

  test("returns null for content without frontmatter", () => {
    const content = "# Just a heading\n\nNo frontmatter here.";

    const result = parseMigrationFrontmatter(content);

    expect(result).toBeNull();
  });

  test("returns null for empty frontmatter", () => {
    const content = `---
---

# Empty frontmatter`;

    const result = parseMigrationFrontmatter(content);

    expect(result).toBeNull();
  });

  test("returns null when required fields are missing", () => {
    const content = `---
package: "@outfitter/cli"
---

# Missing version and breaking`;

    const result = parseMigrationFrontmatter(content);

    expect(result).toBeNull();
  });
});

// =============================================================================
// parseMigrationFrontmatter — Changes Array
// =============================================================================

describe("parseMigrationFrontmatter changes array", () => {
  test("parses changes array with renamed type", () => {
    const content = `---
package: "@outfitter/cli"
version: 0.4.0
breaking: true
changes:
  - type: renamed
    from: "@outfitter/cli/render"
    to: "@outfitter/tui/render"
---

# Migration content`;

    const result = parseMigrationFrontmatter(content);

    expect(result).not.toBeNull();
    expect(result?.changes).toHaveLength(1);
    expect(result?.changes?.[0]?.type).toBe("renamed");
    expect(result?.changes?.[0]?.from).toBe("@outfitter/cli/render");
    expect(result?.changes?.[0]?.to).toBe("@outfitter/tui/render");
  });

  test("parses multiple changes", () => {
    const content = `---
package: "@outfitter/cli"
version: 0.4.0
breaking: true
changes:
  - type: renamed
    from: "@outfitter/cli/render"
    to: "@outfitter/tui/render"
  - type: renamed
    from: "@outfitter/cli/streaming"
    to: "@outfitter/tui/streaming"
  - type: removed
    export: "oldHelper"
    path: "@outfitter/cli"
    detail: "Use newHelper from @outfitter/tui instead"
---

# Content`;

    const result = parseMigrationFrontmatter(content);

    expect(result?.changes).toHaveLength(3);
    expect(result?.changes?.[0]?.type).toBe("renamed");
    expect(result?.changes?.[1]?.type).toBe("renamed");
    expect(result?.changes?.[2]?.type).toBe("removed");
    expect(result?.changes?.[2]?.export).toBe("oldHelper");
    expect(result?.changes?.[2]?.detail).toBe(
      "Use newHelper from @outfitter/tui instead"
    );
  });

  test("parses change with codemod reference", () => {
    const content = `---
package: "@outfitter/cli"
version: 0.4.0
breaking: true
changes:
  - type: moved
    from: "@outfitter/cli/render"
    to: "@outfitter/tui/render"
    codemod: "cli/0.4.0-move-tui-imports.ts"
---

# Content`;

    const result = parseMigrationFrontmatter(content);

    expect(result?.changes?.[0]?.codemod).toBe("cli/0.4.0-move-tui-imports.ts");
  });

  test("parses signature-changed type", () => {
    const content = `---
package: "@outfitter/contracts"
version: 0.3.0
breaking: true
changes:
  - type: signature-changed
    export: "createError"
    path: "@outfitter/contracts"
    detail: "Now requires ErrorOptions object instead of positional args"
---

# Content`;

    const result = parseMigrationFrontmatter(content);

    expect(result?.changes?.[0]?.type).toBe("signature-changed");
    expect(result?.changes?.[0]?.export).toBe("createError");
    expect(result?.changes?.[0]?.path).toBe("@outfitter/contracts");
  });

  test("parses added and deprecated types", () => {
    const content = `---
package: "@outfitter/tui"
version: 0.2.0
breaking: false
changes:
  - type: added
    export: "renderTree"
    path: "@outfitter/tui/render"
  - type: deprecated
    export: "renderList"
    path: "@outfitter/tui/render"
    detail: "Use renderTree instead"
---

# Content`;

    const result = parseMigrationFrontmatter(content);

    expect(result?.changes).toHaveLength(2);
    expect(result?.changes?.[0]?.type).toBe("added");
    expect(result?.changes?.[1]?.type).toBe("deprecated");
    expect(result?.changes?.[1]?.detail).toBe("Use renderTree instead");
  });

  test("returns frontmatter without changes when changes not present", () => {
    const content = `---
package: "@outfitter/cli"
version: 0.4.0
breaking: true
---

# Content`;

    const result = parseMigrationFrontmatter(content);

    expect(result).not.toBeNull();
    expect(result?.changes).toBeUndefined();
  });

  test("handles quoted values in changes", () => {
    const content = `---
package: "@outfitter/cli"
version: 0.4.0
breaking: true
changes:
  - type: renamed
    from: "@outfitter/cli/input"
    to: "@outfitter/tui/confirm"
---

# Content`;

    const result = parseMigrationFrontmatter(content);

    expect(result?.changes?.[0]?.from).toBe("@outfitter/cli/input");
    expect(result?.changes?.[0]?.to).toBe("@outfitter/tui/confirm");
  });
});

// =============================================================================
// readMigrationDocsWithMetadata
// =============================================================================

describe("readMigrationDocsWithMetadata", () => {
  test("returns docs with parsed frontmatter and body", () => {
    const migrationsDir = join(tempDir, "migrations");
    mkdirSync(migrationsDir, { recursive: true });

    const content = `---
package: "@outfitter/contracts"
version: 0.2.0
breaking: true
changes:
  - type: renamed
    from: "OldError"
    to: "NewError"
---

# Migration steps here`;

    writeFileSync(join(migrationsDir, "outfitter-contracts-0.2.0.md"), content);

    const docs = readMigrationDocsWithMetadata(
      migrationsDir,
      "contracts",
      "0.1.0",
      "0.2.0"
    );

    expect(docs).toHaveLength(1);
    expect(docs[0]?.frontmatter.package).toBe("@outfitter/contracts");
    expect(docs[0]?.frontmatter.version).toBe("0.2.0");
    expect(docs[0]?.frontmatter.breaking).toBe(true);
    expect(docs[0]?.frontmatter.changes).toHaveLength(1);
    expect(docs[0]?.body).toContain("Migration steps here");
    expect(docs[0]?.body).not.toContain("---");
  });

  test("strips frontmatter from metadata docs with CRLF newlines", () => {
    const migrationsDir = join(tempDir, "migrations");
    mkdirSync(migrationsDir, { recursive: true });

    writeFileSync(
      join(migrationsDir, "outfitter-contracts-0.2.0.md"),
      `---\r\npackage: "@outfitter/contracts"\r\nversion: 0.2.0\r\nbreaking: true\r\n---\r\n\r\nCRLF migration body\r\n`
    );

    const docs = readMigrationDocsWithMetadata(
      migrationsDir,
      "contracts",
      "0.1.0",
      "0.2.0"
    );

    expect(docs).toHaveLength(1);
    expect(docs[0]?.body).toBe("CRLF migration body");
    expect(docs[0]?.body).not.toContain("---");
  });

  test("returns multiple docs sorted by version ascending", () => {
    const migrationsDir = join(tempDir, "migrations");
    mkdirSync(migrationsDir, { recursive: true });

    writeFileSync(
      join(migrationsDir, "outfitter-cli-0.3.0.md"),
      `---\npackage: "@outfitter/cli"\nversion: 0.3.0\nbreaking: false\n---\n\nV3 changes`
    );
    writeFileSync(
      join(migrationsDir, "outfitter-cli-0.2.0.md"),
      `---\npackage: "@outfitter/cli"\nversion: 0.2.0\nbreaking: false\n---\n\nV2 changes`
    );

    const docs = readMigrationDocsWithMetadata(
      migrationsDir,
      "cli",
      "0.1.0",
      "0.3.0"
    );

    expect(docs).toHaveLength(2);
    expect(docs[0]?.frontmatter.version).toBe("0.2.0");
    expect(docs[1]?.frontmatter.version).toBe("0.3.0");
  });

  test("filters docs by version range", () => {
    const migrationsDir = join(tempDir, "migrations");
    mkdirSync(migrationsDir, { recursive: true });

    writeFileSync(
      join(migrationsDir, "outfitter-cli-0.2.0.md"),
      `---\npackage: "@outfitter/cli"\nversion: 0.2.0\nbreaking: false\n---\n\nV2`
    );
    writeFileSync(
      join(migrationsDir, "outfitter-cli-0.5.0.md"),
      `---\npackage: "@outfitter/cli"\nversion: 0.5.0\nbreaking: true\n---\n\nV5`
    );

    const docs = readMigrationDocsWithMetadata(
      migrationsDir,
      "cli",
      "0.1.0",
      "0.3.0"
    );

    expect(docs).toHaveLength(1);
    expect(docs[0]?.frontmatter.version).toBe("0.2.0");
  });

  test("returns empty array when no docs match", () => {
    const migrationsDir = join(tempDir, "migrations");
    mkdirSync(migrationsDir, { recursive: true });

    const docs = readMigrationDocsWithMetadata(
      migrationsDir,
      "contracts",
      "0.1.0",
      "0.3.0"
    );

    expect(docs).toHaveLength(0);
  });

  test("handles docs without changes array in frontmatter", () => {
    const migrationsDir = join(tempDir, "migrations");
    mkdirSync(migrationsDir, { recursive: true });

    writeFileSync(
      join(migrationsDir, "outfitter-logging-0.2.0.md"),
      `---\npackage: "@outfitter/logging"\nversion: 0.2.0\nbreaking: false\n---\n\nSimple changes`
    );

    const docs = readMigrationDocsWithMetadata(
      migrationsDir,
      "logging",
      "0.1.0",
      "0.2.0"
    );

    expect(docs).toHaveLength(1);
    expect(docs[0]?.frontmatter.changes).toBeUndefined();
    expect(docs[0]?.body).toContain("Simple changes");
  });
});

// =============================================================================
// MigrationGuide.changes integration
// =============================================================================

describe("MigrationGuide includes changes from frontmatter", () => {
  test("buildMigrationGuides populates changes from frontmatter", async () => {
    const { buildMigrationGuides } = await import("../commands/upgrade.js");

    const migrationsDir = join(tempDir, "migrations");
    mkdirSync(migrationsDir, { recursive: true });

    writeFileSync(
      join(migrationsDir, "outfitter-cli-0.4.0.md"),
      `---
package: "@outfitter/cli"
version: 0.4.0
breaking: true
changes:
  - type: renamed
    from: "@outfitter/cli/render"
    to: "@outfitter/tui/render"
---

# Move TUI imports`
    );

    const packages = [
      {
        name: "@outfitter/cli",
        current: "0.3.0",
        latest: "0.4.0",
        updateAvailable: true,
        breaking: true,
      },
    ];

    const guides = buildMigrationGuides(packages, migrationsDir);

    expect(guides).toHaveLength(1);
    expect(guides[0]?.changes).toBeDefined();
    expect(guides[0]?.changes).toHaveLength(1);
    expect(guides[0]?.changes?.[0]?.type).toBe("renamed");
    expect(guides[0]?.changes?.[0]?.from).toBe("@outfitter/cli/render");
    expect(guides[0]?.changes?.[0]?.to).toBe("@outfitter/tui/render");
  });

  test("buildMigrationGuides returns no changes for docs without changes array", async () => {
    const { buildMigrationGuides } = await import("../commands/upgrade.js");

    const migrationsDir = join(tempDir, "migrations");
    mkdirSync(migrationsDir, { recursive: true });

    writeFileSync(
      join(migrationsDir, "outfitter-logging-0.2.0.md"),
      `---\npackage: "@outfitter/logging"\nversion: 0.2.0\nbreaking: false\n---\n\nSimple update`
    );

    const packages = [
      {
        name: "@outfitter/logging",
        current: "0.1.0",
        latest: "0.2.0",
        updateAvailable: true,
        breaking: false,
      },
    ];

    const guides = buildMigrationGuides(packages, migrationsDir);

    expect(guides).toHaveLength(1);
    expect(guides[0]?.changes).toBeUndefined();
  });
});
