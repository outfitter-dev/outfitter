/**
 * Shared dependencies and scripts injected into all scaffolded projects.
 *
 * Edit this file to update versions across all templates. These are merged
 * with template-specific values, with template values taking precedence.
 *
 * @packageDocumentation
 */

import type { ResolvedTemplateDependencyVersions } from "../engine/dependency-versions.js";
import { resolveTemplateDependencyVersions } from "../engine/dependency-versions.js";

let _dependencyVersions: ResolvedTemplateDependencyVersions | undefined;
function getDependencyVersions(): ResolvedTemplateDependencyVersions {
  if (!_dependencyVersions) {
    _dependencyVersions = resolveTemplateDependencyVersions();
  }
  return _dependencyVersions;
}

function pickVersion(
  source: Record<string, string>,
  name: string,
  fallback: string
): string {
  return source[name] ?? fallback;
}

/**
 * Shared devDependencies injected into all scaffolded projects.
 * Template-specific devDependencies take precedence over these defaults.
 *
 * Keep these in sync with the root package.json versions.
 */
export const SHARED_DEV_DEPS: Readonly<Record<string, string>> = {
  "@biomejs/biome": pickVersion(
    getDependencyVersions().external,
    "@biomejs/biome",
    "^2.3.12"
  ),
  "@outfitter/tooling": pickVersion(
    getDependencyVersions().internal,
    "@outfitter/tooling",
    "^0.2.4"
  ),
  "@types/bun": pickVersion(
    getDependencyVersions().external,
    "@types/bun",
    "^1.3.7"
  ),
  lefthook: pickVersion(
    getDependencyVersions().external,
    "lefthook",
    "^2.0.16"
  ),
  typescript: pickVersion(
    getDependencyVersions().external,
    "typescript",
    "^5.9.3"
  ),
  ultracite: pickVersion(
    getDependencyVersions().external,
    "ultracite",
    "^7.1.1"
  ),
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
  lint: "biome check .",
  "lint:fix": "biome check . --write",
  format: "biome format --write .",
  typecheck: "tsc --noEmit",
} as const;
