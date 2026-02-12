/**
 * Tests for the pure `analyzeUpdates()` planner extracted from the update command.
 *
 * @packageDocumentation
 */

import { describe, expect, test } from "bun:test";
import { analyzeUpdates } from "../commands/update-planner.js";

// =============================================================================
// Helper
// =============================================================================

/**
 * Build the `installed` map from a record of name -> version.
 */
function installed(packages: Record<string, string>): Map<string, string> {
  return new Map(Object.entries(packages));
}

/**
 * Build the `latest` map from a record of name -> { version, breaking? }.
 */
function latest(
  packages: Record<string, { version: string; breaking?: boolean }>
): Map<string, { version: string; breaking?: boolean }> {
  return new Map(Object.entries(packages));
}

// =============================================================================
// Empty / trivial inputs
// =============================================================================

describe("analyzeUpdates — empty inputs", () => {
  test("empty installed map produces empty plan", () => {
    const plan = analyzeUpdates(new Map(), new Map());

    expect(plan.packages).toEqual([]);
    expect(plan.summary).toEqual({
      upToDate: 0,
      upgradableNonBreaking: 0,
      upgradableBreaking: 0,
      blocked: 0,
    });
  });

  test("installed packages with no matching latest entries produce upToDate (no latest info)", () => {
    const plan = analyzeUpdates(
      installed({ "@outfitter/cli": "1.0.0" }),
      new Map()
    );

    // If there's no latest info, the package should be classified as upToDate
    // since we can't determine if an update is available
    expect(plan.packages).toHaveLength(1);
    expect(plan.packages[0]?.classification).toBe("upToDate");
  });
});

// =============================================================================
// Up-to-date classification
// =============================================================================

describe("analyzeUpdates — upToDate", () => {
  test("all packages at latest version are classified upToDate", () => {
    const plan = analyzeUpdates(
      installed({
        "@outfitter/cli": "1.2.0",
        "@outfitter/contracts": "2.0.0",
      }),
      latest({
        "@outfitter/cli": { version: "1.2.0", breaking: false },
        "@outfitter/contracts": { version: "2.0.0", breaking: false },
      })
    );

    expect(plan.packages).toHaveLength(2);
    for (const pkg of plan.packages) {
      expect(pkg.classification).toBe("upToDate");
      expect(pkg.breaking).toBe(false);
    }
    expect(plan.summary.upToDate).toBe(2);
    expect(plan.summary.upgradableNonBreaking).toBe(0);
    expect(plan.summary.upgradableBreaking).toBe(0);
    expect(plan.summary.blocked).toBe(0);
  });

  test("installed version newer than latest is classified upToDate", () => {
    const plan = analyzeUpdates(
      installed({ "@outfitter/cli": "2.0.0" }),
      latest({ "@outfitter/cli": { version: "1.5.0", breaking: false } })
    );

    expect(plan.packages[0]?.classification).toBe("upToDate");
  });
});

// =============================================================================
// Patch bump (non-breaking)
// =============================================================================

describe("analyzeUpdates — patch bumps", () => {
  test("patch bump is classified as upgradableNonBreaking", () => {
    const plan = analyzeUpdates(
      installed({ "@outfitter/cli": "1.2.0" }),
      latest({ "@outfitter/cli": { version: "1.2.1", breaking: false } })
    );

    expect(plan.packages[0]?.classification).toBe("upgradableNonBreaking");
    expect(plan.packages[0]?.breaking).toBe(false);
    expect(plan.summary.upgradableNonBreaking).toBe(1);
  });

  test("pre-1.0 patch bump is classified as upgradableNonBreaking", () => {
    const plan = analyzeUpdates(
      installed({ "@outfitter/cli": "0.1.0" }),
      latest({ "@outfitter/cli": { version: "0.1.1", breaking: false } })
    );

    expect(plan.packages[0]?.classification).toBe("upgradableNonBreaking");
    expect(plan.packages[0]?.breaking).toBe(false);
  });
});

// =============================================================================
// Minor bump (non-breaking for stable, breaking for pre-1.0)
// =============================================================================

describe("analyzeUpdates — minor bumps", () => {
  test("minor bump with breaking: false on stable package is upgradableNonBreaking", () => {
    const plan = analyzeUpdates(
      installed({ "@outfitter/cli": "1.2.0" }),
      latest({ "@outfitter/cli": { version: "1.3.0", breaking: false } })
    );

    expect(plan.packages[0]?.classification).toBe("upgradableNonBreaking");
    expect(plan.packages[0]?.breaking).toBe(false);
  });

  test("minor bump with breaking: true is upgradableBreaking", () => {
    const plan = analyzeUpdates(
      installed({ "@outfitter/cli": "1.2.0" }),
      latest({ "@outfitter/cli": { version: "1.3.0", breaking: true } })
    );

    expect(plan.packages[0]?.classification).toBe("upgradableBreaking");
    expect(plan.packages[0]?.breaking).toBe(true);
    expect(plan.summary.upgradableBreaking).toBe(1);
  });

  test("pre-1.0 minor bump with no explicit flag uses semver heuristic (breaking)", () => {
    const plan = analyzeUpdates(
      installed({ "@outfitter/cli": "0.1.0" }),
      latest({ "@outfitter/cli": { version: "0.2.0" } })
    );

    expect(plan.packages[0]?.classification).toBe("upgradableBreaking");
    expect(plan.packages[0]?.breaking).toBe(true);
    expect(plan.summary.upgradableBreaking).toBe(1);
  });

  test("pre-1.0 minor bump with breaking: false overrides semver to non-breaking", () => {
    const plan = analyzeUpdates(
      installed({ "@outfitter/cli": "0.1.0" }),
      latest({ "@outfitter/cli": { version: "0.2.0", breaking: false } })
    );

    expect(plan.packages[0]?.classification).toBe("upgradableNonBreaking");
    expect(plan.packages[0]?.breaking).toBe(false);
  });

  test("pre-1.0 minor bump with breaking: true is upgradableBreaking", () => {
    const plan = analyzeUpdates(
      installed({ "@outfitter/cli": "0.1.0" }),
      latest({ "@outfitter/cli": { version: "0.2.0", breaking: true } })
    );

    expect(plan.packages[0]?.classification).toBe("upgradableBreaking");
    expect(plan.packages[0]?.breaking).toBe(true);
  });
});

// =============================================================================
// Major bump (always breaking)
// =============================================================================

describe("analyzeUpdates — major bumps", () => {
  test("major bump with no explicit flag uses semver heuristic (breaking)", () => {
    const plan = analyzeUpdates(
      installed({ "@outfitter/cli": "1.2.0" }),
      latest({ "@outfitter/cli": { version: "2.0.0" } })
    );

    expect(plan.packages[0]?.classification).toBe("upgradableBreaking");
    expect(plan.packages[0]?.breaking).toBe(true);
    expect(plan.summary.upgradableBreaking).toBe(1);
  });

  test("major bump with breaking: false overrides semver to non-breaking", () => {
    const plan = analyzeUpdates(
      installed({ "@outfitter/cli": "1.2.0" }),
      latest({ "@outfitter/cli": { version: "2.0.0", breaking: false } })
    );

    expect(plan.packages[0]?.classification).toBe("upgradableNonBreaking");
    expect(plan.packages[0]?.breaking).toBe(false);
  });

  test("major bump from 0.x to 1.x with no flag is upgradableBreaking", () => {
    const plan = analyzeUpdates(
      installed({ "@outfitter/cli": "0.5.0" }),
      latest({ "@outfitter/cli": { version: "1.0.0" } })
    );

    expect(plan.packages[0]?.classification).toBe("upgradableBreaking");
    expect(plan.packages[0]?.breaking).toBe(true);
  });
});

// =============================================================================
// Summary counts
// =============================================================================

describe("analyzeUpdates — summary counts", () => {
  test("summary counts match classification results", () => {
    const plan = analyzeUpdates(
      installed({
        "@outfitter/contracts": "1.0.0",
        "@outfitter/cli": "1.0.0",
        "@outfitter/types": "0.1.0",
        "@outfitter/config": "1.0.0",
      }),
      latest({
        "@outfitter/contracts": { version: "1.0.0", breaking: false }, // upToDate
        "@outfitter/cli": { version: "1.0.1", breaking: false }, // patch → nonBreaking
        "@outfitter/types": { version: "0.2.0" }, // pre-1.0 minor, no flag → breaking via semver
        "@outfitter/config": { version: "2.0.0" }, // major, no flag → breaking via semver
      })
    );

    expect(plan.summary.upToDate).toBe(1);
    expect(plan.summary.upgradableNonBreaking).toBe(1);
    expect(plan.summary.upgradableBreaking).toBe(2);
    expect(plan.summary.blocked).toBe(0);
    expect(plan.packages).toHaveLength(4);
  });
});

// =============================================================================
// Migration docs
// =============================================================================

describe("analyzeUpdates — migration docs", () => {
  test("migration doc path is attached when provided", () => {
    const migrations = new Map([
      ["@outfitter/cli", "/docs/migrations/cli-2.0.0.md"],
    ]);

    const plan = analyzeUpdates(
      installed({ "@outfitter/cli": "1.0.0" }),
      latest({ "@outfitter/cli": { version: "2.0.0", breaking: false } }),
      migrations
    );

    expect(plan.packages[0]?.migrationDoc).toBe(
      "/docs/migrations/cli-2.0.0.md"
    );
  });

  test("migrationDoc is undefined when no migration docs provided", () => {
    const plan = analyzeUpdates(
      installed({ "@outfitter/cli": "1.0.0" }),
      latest({ "@outfitter/cli": { version: "2.0.0", breaking: false } })
    );

    expect(plan.packages[0]?.migrationDoc).toBeUndefined();
  });

  test("migrationDoc is undefined for packages not in migration map", () => {
    const migrations = new Map([
      ["@outfitter/other", "/docs/migrations/other-1.0.0.md"],
    ]);

    const plan = analyzeUpdates(
      installed({ "@outfitter/cli": "1.0.0" }),
      latest({ "@outfitter/cli": { version: "2.0.0", breaking: false } }),
      migrations
    );

    expect(plan.packages[0]?.migrationDoc).toBeUndefined();
  });
});

// =============================================================================
// Determinism and ordering
// =============================================================================

describe("analyzeUpdates — determinism", () => {
  test("output is deterministic for same inputs", () => {
    const inst = installed({
      "@outfitter/cli": "1.0.0",
      "@outfitter/contracts": "1.0.0",
      "@outfitter/types": "0.5.0",
    });
    const lat = latest({
      "@outfitter/cli": { version: "1.1.0", breaking: false },
      "@outfitter/contracts": { version: "1.0.0", breaking: false },
      "@outfitter/types": { version: "0.6.0", breaking: false },
    });

    const plan1 = analyzeUpdates(inst, lat);
    const plan2 = analyzeUpdates(inst, lat);

    expect(plan1).toEqual(plan2);
  });

  test("packages are sorted by name for stable output", () => {
    const plan = analyzeUpdates(
      installed({
        "@outfitter/types": "1.0.0",
        "@outfitter/cli": "1.0.0",
        "@outfitter/contracts": "1.0.0",
      }),
      latest({
        "@outfitter/types": { version: "1.1.0", breaking: false },
        "@outfitter/cli": { version: "1.1.0", breaking: false },
        "@outfitter/contracts": { version: "1.1.0", breaking: false },
      })
    );

    const names = plan.packages.map((p) => p.name);
    expect(names).toEqual([...names].sort());
  });
});

// =============================================================================
// Version field correctness
// =============================================================================

describe("analyzeUpdates — version fields", () => {
  test("currentVersion and latestVersion are set correctly", () => {
    const plan = analyzeUpdates(
      installed({ "@outfitter/cli": "1.2.3" }),
      latest({ "@outfitter/cli": { version: "1.3.0", breaking: false } })
    );

    const pkg = plan.packages[0];
    expect(pkg?.name).toBe("@outfitter/cli");
    expect(pkg?.currentVersion).toBe("1.2.3");
    expect(pkg?.latestVersion).toBe("1.3.0");
  });

  test("latestVersion matches currentVersion when up to date", () => {
    const plan = analyzeUpdates(
      installed({ "@outfitter/cli": "1.0.0" }),
      latest({ "@outfitter/cli": { version: "1.0.0", breaking: false } })
    );

    const pkg = plan.packages[0];
    expect(pkg?.latestVersion).toBe("1.0.0");
  });

  test("latestVersion equals currentVersion when no latest info available", () => {
    const plan = analyzeUpdates(
      installed({ "@outfitter/cli": "1.0.0" }),
      new Map()
    );

    const pkg = plan.packages[0];
    expect(pkg?.latestVersion).toBe("1.0.0");
  });
});
