/**
 * Validates that every testable workspace package appears in exactly one
 * CI test shard's `OUTFITTER_CI_TEST_FILTER`.
 *
 * @packageDocumentation
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

interface ShardCoverageViolations {
  readonly duplicated: readonly {
    readonly package: string;
    readonly shards: readonly string[];
  }[];
  readonly missing: readonly string[];
}

/**
 * Parse `OUTFITTER_CI_TEST_SHARD` / `OUTFITTER_CI_TEST_FILTER` pairs from
 * the CI workflow YAML. Uses simple regex — no YAML parser needed.
 */
export function parseShardFilters(yaml: string): Map<string, string[]> {
  const shards = new Map<string, string[]>();
  const shardRegex = /OUTFITTER_CI_TEST_SHARD:\s*["']?(\w+)["']?/g;
  const filterRegex = /OUTFITTER_CI_TEST_FILTER:\s*["']?([^"'\n]+)["']?/g;

  const shardMatches = [...yaml.matchAll(shardRegex)].map((m) => m[1]!);
  const filterMatches = [...yaml.matchAll(filterRegex)].map((m) =>
    m[1]!
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
  );

  for (let i = 0; i < shardMatches.length; i++) {
    const shard = shardMatches[i]!;
    const filters = filterMatches[i];
    if (filters) {
      shards.set(shard, filters);
    }
  }

  return shards;
}

/**
 * Find packages that are missing from all shards or duplicated across shards.
 */
export function findShardCoverageViolations(
  shards: Map<string, string[]>,
  testablePackages: readonly string[]
): ShardCoverageViolations {
  const packageToShards = new Map<string, string[]>();

  for (const [shard, packages] of shards) {
    for (const pkg of packages) {
      const existing = packageToShards.get(pkg);
      if (existing) {
        existing.push(shard);
      } else {
        packageToShards.set(pkg, [shard]);
      }
    }
  }

  const testableSet = new Set(testablePackages);

  const missing = testablePackages.filter((pkg) => !packageToShards.has(pkg));

  const duplicated: { package: string; shards: string[] }[] = [];
  for (const [pkg, shardList] of packageToShards) {
    if (shardList.length > 1 && testableSet.has(pkg)) {
      duplicated.push({ package: pkg, shards: shardList });
    }
  }

  return { missing, duplicated };
}

function findTestablePackages(rootDir: string): string[] {
  const workspaceDirs = ["packages", "apps", "examples"];
  const testable: string[] = [];

  for (const wsDir of workspaceDirs) {
    const dir = join(rootDir, wsDir);
    if (!existsSync(dir)) continue;

    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;

      const pkgPath = join(dir, entry.name, "package.json");
      if (!existsSync(pkgPath)) continue;

      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as {
        name?: string;
        scripts?: Record<string, string>;
      };
      if (!pkg.name) continue;

      // A package is testable if it has a `test` script
      if (pkg.scripts?.["test"]) {
        testable.push(pkg.name);
      }
    }
  }

  return testable.toSorted();
}

if (import.meta.main) {
  const rootDir = resolve(process.argv[2] ?? ".");
  const ciPath = join(rootDir, ".github", "workflows", "ci.yml");

  if (!existsSync(ciPath)) {
    console.error(`CI workflow not found: ${ciPath}`);
    process.exit(1);
  }

  const yaml = readFileSync(ciPath, "utf-8");
  const shards = parseShardFilters(yaml);
  const testablePackages = findTestablePackages(rootDir);

  if (shards.size === 0) {
    console.error("No test shards found in CI workflow");
    process.exit(1);
  }

  console.log(
    `Found ${shards.size} shards covering ${[...shards.values()].flat().length} entries`
  );
  console.log(`Found ${testablePackages.length} testable workspace packages`);

  const violations = findShardCoverageViolations(shards, testablePackages);

  if (violations.missing.length === 0 && violations.duplicated.length === 0) {
    console.log("All testable packages are covered by exactly one shard");
    process.exit(0);
  }

  if (violations.missing.length > 0) {
    console.error(
      `\nPackages missing from all shards (tests will not run in CI):`
    );
    for (const pkg of violations.missing) {
      console.error(`  - ${pkg}`);
    }
  }

  if (violations.duplicated.length > 0) {
    console.error(`\nPackages appearing in multiple shards:`);
    for (const { package: pkg, shards: s } of violations.duplicated) {
      console.error(`  - ${pkg} → ${s.join(", ")}`);
    }
  }

  process.exit(1);
}
