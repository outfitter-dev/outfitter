/**
 * Shared dependencies and scripts injected into all scaffolded projects.
 *
 * Edit this file to update versions across all templates. These are merged
 * with template-specific values, with template values taking precedence.
 *
 * @packageDocumentation
 */

/**
 * Shared devDependencies injected into all scaffolded projects.
 * Template-specific devDependencies take precedence over these defaults.
 *
 * Keep these in sync with the root package.json versions.
 */
export const SHARED_DEV_DEPS = {
	"@biomejs/biome": "^2.3.11",
	"@types/bun": "latest",
	lefthook: "^2.0.15",
	typescript: "^5.9.3",
	ultracite: "^7.0.12",
} as const;

/**
 * Shared scripts injected into all scaffolded projects.
 * Template-specific scripts take precedence over these defaults.
 */
export const SHARED_SCRIPTS = {
	lint: "biome check .",
	"lint:fix": "biome check . --write",
	format: "biome format --write .",
	typecheck: "tsc --noEmit",
} as const;
