/**
 * Shared dependencies and scripts injected into all scaffolded projects.
 *
 * Versions come from `@outfitter/presets` resolved deps (catalog-resolved at
 * publish time). Missing versions are real errors — fail loudly.
 *
 * @packageDocumentation
 */

import { getResolvedVersions } from "@outfitter/presets";

import { resolvePresetDependencyVersions } from "../engine/dependency-versions.js";

const { all: resolvedVersions } = getResolvedVersions();

function requireVersion(name: string): string {
  const version = resolvedVersions[name];
  if (!version) {
    throw new Error(
      `Missing resolved version for "${name}" in @outfitter/presets`
    );
  }
  return version;
}

function requireInternalVersion(name: string): string {
  const versions = resolvePresetDependencyVersions();
  const version = versions.internal[name];
  if (!version) {
    throw new Error(
      `Missing internal version for "${name}" — not found in workspace packages or outfitter's own dependencies`
    );
  }
  return version;
}

/**
 * Shared devDependencies injected into all scaffolded projects.
 * Template-specific devDependencies take precedence over these defaults.
 *
 * Versions are resolved from @outfitter/presets (catalog-resolved at publish time).
 * Internal @outfitter/* versions come from workspace scanning.
 */
export const SHARED_DEV_DEPS: Readonly<Record<string, string>> = {
  "@outfitter/tooling": requireInternalVersion("@outfitter/tooling"),
  "@types/bun": requireVersion("@types/bun"),
  lefthook: requireVersion("lefthook"),
  oxfmt: requireVersion("oxfmt"),
  oxlint: requireVersion("oxlint"),
  typescript: requireVersion("typescript"),
  ultracite: requireVersion("ultracite"),
};

/**
 * Shared scripts injected into all scaffolded projects.
 * Template-specific scripts take precedence over these defaults.
 */
export const SHARED_SCRIPTS = {
  check: "ultracite check",
  "clean:artifacts": "rm -rf dist .turbo",
  "verify:ci":
    "bun run typecheck && bun run check && bun run build && bun run test",
  lint: "oxlint .",
  "lint:fix": "oxlint --fix .",
  format: "oxfmt --write .",
  typecheck: "tsc --noEmit",
} as const;
