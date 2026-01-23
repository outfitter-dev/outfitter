/**
 * @outfitter/kit - Version coordination meta-package
 *
 * This package coordinates versions across all @outfitter packages.
 * Install it alongside specific packages to ensure compatible versions.
 *
 * @packageDocumentation
 */

/**
 * Kit version - matches package.json version
 */
export const KIT_VERSION = "0.1.0";

/**
 * Minimum compatible versions for each package
 */
export const MINIMUM_VERSIONS = {
	"@outfitter/cli": "0.1.0",
	"@outfitter/config": "0.1.0",
	"@outfitter/contracts": "0.1.0",
	"@outfitter/daemon": "0.1.0",
	"@outfitter/file-ops": "0.1.0",
	"@outfitter/index": "0.1.0",
	"@outfitter/logging": "0.1.0",
	"@outfitter/mcp": "0.1.0",
	"@outfitter/state": "0.1.0",
	"@outfitter/testing": "0.1.0",
	"@outfitter/types": "0.1.0",
	"@outfitter/ui": "0.1.0",
} as const;

/**
 * Type for package names in the kit
 */
export type OutfitterPackage = keyof typeof MINIMUM_VERSIONS;
