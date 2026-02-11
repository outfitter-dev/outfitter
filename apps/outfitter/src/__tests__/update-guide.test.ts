/**
 * Tests for `outfitter update --guide` structured migration guidance.
 *
 * Tests the MigrationGuide type, guide population in UpdateResult,
 * and formatted output for both human and JSON modes.
 *
 * @packageDocumentation
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildMigrationGuides,
  type MigrationGuide,
  printUpdateResults,
  type UpdateResult,
} from "../commands/update.js";

// =============================================================================
// Test Utilities
// =============================================================================

function createTempDir(): string {
  const tempDir = join(
    tmpdir(),
    `outfitter-update-guide-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  mkdirSync(tempDir, { recursive: true });
  return tempDir;
}

function cleanupTempDir(dir: string): void {
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
}

function writeMigrationDoc(
  dir: string,
  shortName: string,
  version: string,
  body: string
): void {
  const filename = `outfitter-${shortName}-${version}.md`;
  const content = `---\npackage: "@outfitter/${shortName}"\nversion: ${version}\nbreaking: true\n---\n\n${body}\n`;
  writeFileSync(join(dir, filename), content);
}

/**
 * Capture stdout output from printUpdateResults.
 */
async function captureOutput(
  result: UpdateResult,
  options?: Parameters<typeof printUpdateResults>[1]
): Promise<string> {
  const chunks: string[] = [];
  const mockStream = {
    write(data: string, cb?: (error?: Error | null) => void): boolean {
      chunks.push(data);
      if (cb) cb(null);
      return true;
    },
    once(_event: string, _handler: (...args: unknown[]) => void): void {
      // no-op for mock stream
    },
  } as unknown as NodeJS.WritableStream;

  // Patch process.stdout temporarily for the output call
  const origStdout = process.stdout;
  Object.defineProperty(process, "stdout", {
    value: mockStream,
    writable: true,
  });

  try {
    await printUpdateResults(result, options);
  } finally {
    Object.defineProperty(process, "stdout", {
      value: origStdout,
      writable: true,
    });
  }

  return chunks.join("");
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
// MigrationGuide Type Shape
// =============================================================================

describe("MigrationGuide type", () => {
  test("has correct shape with all required fields", () => {
    const guide: MigrationGuide = {
      packageName: "@outfitter/contracts",
      fromVersion: "0.1.0",
      toVersion: "0.2.0",
      breaking: true,
      steps: ["Update import paths from contracts/v1 to contracts/v2"],
    };

    expect(guide.packageName).toBe("@outfitter/contracts");
    expect(guide.fromVersion).toBe("0.1.0");
    expect(guide.toVersion).toBe("0.2.0");
    expect(guide.breaking).toBe(true);
    expect(guide.steps).toHaveLength(1);
  });

  test("steps can be empty when no guide exists", () => {
    const guide: MigrationGuide = {
      packageName: "@outfitter/cli",
      fromVersion: "1.0.0",
      toVersion: "2.0.0",
      breaking: true,
      steps: [],
    };

    expect(guide.steps).toHaveLength(0);
  });
});

// =============================================================================
// buildMigrationGuides — Pure Function
// =============================================================================

describe("buildMigrationGuides", () => {
  test("returns empty array when no packages have updates", () => {
    const result: UpdateResult = {
      packages: [
        {
          name: "@outfitter/contracts",
          current: "0.1.0",
          latest: "0.1.0",
          updateAvailable: false,
          breaking: false,
        },
      ],
      total: 1,
      updatesAvailable: 0,
      hasBreaking: false,
      applied: false,
      appliedPackages: [],
      skippedBreaking: [],
    };

    const guides = buildMigrationGuides(result.packages, null);

    expect(guides).toHaveLength(0);
  });

  test("returns guide with steps from migration docs", () => {
    const migrationsDir = join(tempDir, "migrations");
    mkdirSync(migrationsDir, { recursive: true });
    writeMigrationDoc(
      migrationsDir,
      "contracts",
      "0.2.0",
      "Step 1: Update imports\n\nStep 2: Run codemod"
    );

    const packages = [
      {
        name: "@outfitter/contracts",
        current: "0.1.0",
        latest: "0.2.0",
        updateAvailable: true,
        breaking: true,
      },
    ];

    const guides = buildMigrationGuides(packages, migrationsDir);

    expect(guides).toHaveLength(1);
    expect(guides[0]?.packageName).toBe("@outfitter/contracts");
    expect(guides[0]?.fromVersion).toBe("0.1.0");
    expect(guides[0]?.toVersion).toBe("0.2.0");
    expect(guides[0]?.breaking).toBe(true);
    expect(guides[0]?.steps.length).toBeGreaterThan(0);
  });

  test("returns guide with empty steps when no migration docs exist", () => {
    const packages = [
      {
        name: "@outfitter/cli",
        current: "1.0.0",
        latest: "2.0.0",
        updateAvailable: true,
        breaking: true,
      },
    ];

    const guides = buildMigrationGuides(packages, null);

    expect(guides).toHaveLength(1);
    expect(guides[0]?.packageName).toBe("@outfitter/cli");
    expect(guides[0]?.fromVersion).toBe("1.0.0");
    expect(guides[0]?.toVersion).toBe("2.0.0");
    expect(guides[0]?.breaking).toBe(true);
    expect(guides[0]?.steps).toHaveLength(0);
  });

  test("includes non-breaking updates in guides", () => {
    const packages = [
      {
        name: "@outfitter/cli",
        current: "1.0.0",
        latest: "1.1.0",
        updateAvailable: true,
        breaking: false,
      },
    ];

    const guides = buildMigrationGuides(packages, null);

    expect(guides).toHaveLength(1);
    expect(guides[0]?.breaking).toBe(false);
    expect(guides[0]?.steps).toHaveLength(0);
  });

  test("skips packages without latest version", () => {
    const packages = [
      {
        name: "@outfitter/contracts",
        current: "0.1.0",
        latest: null,
        updateAvailable: false,
        breaking: false,
      },
    ];

    const guides = buildMigrationGuides(packages, null);

    expect(guides).toHaveLength(0);
  });

  test("includes multiple packages with mixed breaking status", () => {
    const migrationsDir = join(tempDir, "migrations");
    mkdirSync(migrationsDir, { recursive: true });
    writeMigrationDoc(
      migrationsDir,
      "contracts",
      "0.2.0",
      "Breaking: new error taxonomy"
    );

    const packages = [
      {
        name: "@outfitter/contracts",
        current: "0.1.0",
        latest: "0.2.0",
        updateAvailable: true,
        breaking: true,
      },
      {
        name: "@outfitter/cli",
        current: "0.1.0",
        latest: "0.1.5",
        updateAvailable: true,
        breaking: false,
      },
    ];

    const guides = buildMigrationGuides(packages, migrationsDir);

    expect(guides).toHaveLength(2);

    const contractsGuide = guides.find(
      (g) => g.packageName === "@outfitter/contracts"
    );
    expect(contractsGuide?.breaking).toBe(true);
    expect(contractsGuide?.steps.length).toBeGreaterThan(0);

    const cliGuide = guides.find((g) => g.packageName === "@outfitter/cli");
    expect(cliGuide?.breaking).toBe(false);
    expect(cliGuide?.steps).toHaveLength(0);
  });
});

// =============================================================================
// UpdateResult.guides Field
// =============================================================================

describe("UpdateResult.guides field", () => {
  test("guides is included when populated", () => {
    const result: UpdateResult = {
      packages: [],
      total: 0,
      updatesAvailable: 0,
      hasBreaking: false,
      applied: false,
      appliedPackages: [],
      skippedBreaking: [],
      guides: [
        {
          packageName: "@outfitter/contracts",
          fromVersion: "0.1.0",
          toVersion: "0.2.0",
          breaking: true,
          steps: ["Update imports"],
        },
      ],
    };

    expect(result.guides).toHaveLength(1);
    expect(result.guides?.[0]?.packageName).toBe("@outfitter/contracts");
  });

  test("result works without guides field (backwards compatible)", () => {
    const result: UpdateResult = {
      packages: [],
      total: 0,
      updatesAvailable: 0,
      hasBreaking: false,
      applied: false,
      appliedPackages: [],
      skippedBreaking: [],
    };

    expect(result.guides).toBeUndefined();
  });
});

// =============================================================================
// JSON Output with Guides
// =============================================================================

describe("printUpdateResults JSON output with guides", () => {
  test("includes guides in JSON output when present", async () => {
    const result: UpdateResult = {
      packages: [
        {
          name: "@outfitter/contracts",
          current: "0.1.0",
          latest: "0.2.0",
          updateAvailable: true,
          breaking: true,
        },
      ],
      total: 1,
      updatesAvailable: 1,
      hasBreaking: true,
      applied: false,
      appliedPackages: [],
      skippedBreaking: ["@outfitter/contracts"],
      guides: [
        {
          packageName: "@outfitter/contracts",
          fromVersion: "0.1.0",
          toVersion: "0.2.0",
          breaking: true,
          steps: ["Update import paths"],
        },
      ],
    };

    const captured = await captureOutput(result, { mode: "json" });
    const parsed = JSON.parse(captured.trim());

    expect(parsed.guides).toBeDefined();
    expect(parsed.guides).toHaveLength(1);
    expect(parsed.guides[0].packageName).toBe("@outfitter/contracts");
    expect(parsed.guides[0].steps).toEqual(["Update import paths"]);
  });

  test("omits guides from JSON output when not present", async () => {
    const result: UpdateResult = {
      packages: [
        {
          name: "@outfitter/contracts",
          current: "0.1.0",
          latest: "0.1.0",
          updateAvailable: false,
          breaking: false,
        },
      ],
      total: 1,
      updatesAvailable: 0,
      hasBreaking: false,
      applied: false,
      appliedPackages: [],
      skippedBreaking: [],
    };

    const captured = await captureOutput(result, { mode: "json" });
    const parsed = JSON.parse(captured.trim());

    expect(parsed.guides).toBeUndefined();
  });
});

// =============================================================================
// Human Output with Guides
// =============================================================================

describe("printUpdateResults human output with guides", () => {
  test("displays migration guide section when guide option is set", async () => {
    const result: UpdateResult = {
      packages: [
        {
          name: "@outfitter/contracts",
          current: "0.1.0",
          latest: "0.2.0",
          updateAvailable: true,
          breaking: true,
        },
      ],
      total: 1,
      updatesAvailable: 1,
      hasBreaking: true,
      applied: false,
      appliedPackages: [],
      skippedBreaking: ["@outfitter/contracts"],
      guides: [
        {
          packageName: "@outfitter/contracts",
          fromVersion: "0.1.0",
          toVersion: "0.2.0",
          breaking: true,
          steps: ["Update import paths", "Run the codemod"],
        },
      ],
    };

    const captured = await captureOutput(result, { guide: true });

    expect(captured).toContain("Migration Guide");
    expect(captured).toContain("@outfitter/contracts");
    expect(captured).toContain("0.1.0");
    expect(captured).toContain("0.2.0");
    expect(captured).toContain("Update import paths");
    expect(captured).toContain("Run the codemod");
  });

  test("shows 'no steps' message for guides without steps", async () => {
    const result: UpdateResult = {
      packages: [
        {
          name: "@outfitter/cli",
          current: "1.0.0",
          latest: "2.0.0",
          updateAvailable: true,
          breaking: true,
        },
      ],
      total: 1,
      updatesAvailable: 1,
      hasBreaking: true,
      applied: false,
      appliedPackages: [],
      skippedBreaking: ["@outfitter/cli"],
      guides: [
        {
          packageName: "@outfitter/cli",
          fromVersion: "1.0.0",
          toVersion: "2.0.0",
          breaking: true,
          steps: [],
        },
      ],
    };

    const captured = await captureOutput(result, { guide: true });

    expect(captured).toContain("Migration Guide");
    expect(captured).toContain("@outfitter/cli");
    expect(captured).toContain("No migration steps available");
  });

  test("does not show guide section when guide option is not set", async () => {
    const result: UpdateResult = {
      packages: [
        {
          name: "@outfitter/contracts",
          current: "0.1.0",
          latest: "0.2.0",
          updateAvailable: true,
          breaking: true,
        },
      ],
      total: 1,
      updatesAvailable: 1,
      hasBreaking: true,
      applied: false,
      appliedPackages: [],
      skippedBreaking: ["@outfitter/contracts"],
      guides: [
        {
          packageName: "@outfitter/contracts",
          fromVersion: "0.1.0",
          toVersion: "0.2.0",
          breaking: true,
          steps: ["Update import paths"],
        },
      ],
    };

    const captured = await captureOutput(result);

    // The structured guides section should NOT appear without --guide
    expect(captured).not.toContain("Update import paths");
  });
});
