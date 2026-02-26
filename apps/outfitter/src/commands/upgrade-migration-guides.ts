import {
  readMigrationDocsWithMetadata,
  type MigrationDocWithMetadata,
} from "./upgrade-migration-docs.js";
import type { MigrationChange } from "./upgrade-migration-frontmatter.js";
import type { PackageVersionInfo } from "./upgrade.js";

type GuidePackageVersionInfo = PackageVersionInfo;

/** Structured migration guide for a single package upgrade. */
export interface MigrationGuide {
  /** Whether this is a breaking change */
  readonly breaking: boolean;
  /** Structured changes from migration frontmatter, if available */
  readonly changes?: readonly MigrationChange[];
  /** Currently installed version */
  readonly fromVersion: string;
  /** The @outfitter/* package name */
  readonly packageName: string;
  /** Migration step strings (empty if no guide exists) */
  readonly steps: readonly string[];
  /** Latest available version */
  readonly toVersion: string;
}

function collectMigrationChanges(
  docs: readonly MigrationDocWithMetadata[]
): readonly MigrationChange[] | undefined {
  const changes: MigrationChange[] = [];
  for (const doc of docs) {
    if (doc.frontmatter.changes) {
      changes.push(...doc.frontmatter.changes);
    }
  }
  return changes.length > 0 ? changes : undefined;
}

/**
 * Build structured migration guides for packages with available updates.
 *
 * For each package with an update, produces a `MigrationGuide` with steps
 * extracted from migration docs (if a migrations directory is available).
 * Packages without updates or without a resolved latest version are skipped.
 */
export function buildMigrationGuides(
  packages: readonly GuidePackageVersionInfo[],
  migrationsDir: string | null
): MigrationGuide[] {
  const guides: MigrationGuide[] = [];

  for (const pkg of packages) {
    if (!pkg.updateAvailable || pkg.latest === null) {
      continue;
    }

    let steps: string[] = [];
    let changes: readonly MigrationChange[] | undefined;

    if (migrationsDir !== null) {
      const shortName = pkg.name.replace("@outfitter/", "");
      const docs = readMigrationDocsWithMetadata(
        migrationsDir,
        shortName,
        pkg.current,
        pkg.latest
      );
      steps = docs.map((doc) => doc.body);
      changes = collectMigrationChanges(docs);
    }

    guides.push({
      packageName: pkg.name,
      fromVersion: pkg.current,
      toVersion: pkg.latest,
      breaking: pkg.breaking,
      steps,
      ...(changes !== undefined ? { changes } : {}),
    });
  }

  return guides;
}
