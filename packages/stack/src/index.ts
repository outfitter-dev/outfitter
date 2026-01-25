/**
 * @outfitter/stack - Version coordination meta-package
 *
 * This package coordinates versions across all @outfitter packages.
 * Install it alongside specific packages to ensure compatible versions.
 *
 * @packageDocumentation
 */

/**
 * Stack version - matches package.json version
 */
export const STACK_VERSION = "0.1.0-rc.1";

/**
 * Minimum compatible versions for each package
 */
export const MINIMUM_VERSIONS = {
	"@outfitter/agents": "0.1.0-rc.1",
	"@outfitter/cli": "0.1.0-rc.1",
	"@outfitter/config": "0.1.0-rc.1",
	"@outfitter/contracts": "0.1.0-rc.1",
	"@outfitter/daemon": "0.1.0-rc.1",
	"@outfitter/file-ops": "0.1.0-rc.1",
	"@outfitter/index": "0.1.0-rc.1",
	"@outfitter/logging": "0.1.0-rc.1",
	"@outfitter/mcp": "0.1.0-rc.1",
	"@outfitter/state": "0.1.0-rc.1",
	"@outfitter/testing": "0.1.0-rc.1",
	"@outfitter/types": "0.1.0-rc.1",
	"@outfitter/ui": "0.1.0-rc.1",
} as const;

/**
 * Type for package names in the stack
 */
export type OutfitterPackage = keyof typeof MINIMUM_VERSIONS;
