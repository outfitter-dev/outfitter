#!/usr/bin/env bun
/**
 * Script to find and replace "kit" mentions after the rename to "stack".
 *
 * Usage:
 *   bun scripts/replace-kit-mentions.ts          # Dry run - show what would change
 *   bun scripts/replace-kit-mentions.ts --apply  # Apply changes
 */

import { Glob } from "bun";

const DRY_RUN = !process.argv.includes("--apply");

// Patterns that should NOT be changed
const SKIP_PATTERNS = [
	/toolkit/i, // "toolkit" is a valid word
	/kit\.ts/, // file references (though these shouldn't exist anymore)
	/packages\/kit/, // old path references in historical context
	/outfitter-kit/, // old repo name in historical context (though we updated these)
	/@outfitter\/kit/, // old package name (though we updated these)
	/KIT_VERSION/, // old constant name (though we updated these)
];

// Files/directories to skip
const SKIP_PATHS = [
	"node_modules",
	".git",
	"dist",
	"bun.lock",
	".turbo",
	"scripts/replace-kit-mentions.ts", // Don't modify self
];

// Replacement rules with context
const REPLACEMENTS: Array<{
	pattern: RegExp;
	replacement: string;
	description: string;
}> = [
	// Capitalized "Kit" referring to the project
	{
		pattern: /\bKit\s+packages\b/g,
		replacement: "Outfitter packages",
		description: "Kit packages → Outfitter packages",
	},
	{
		pattern: /\bKit\s+contracts\b/g,
		replacement: "Outfitter contracts",
		description: "Kit contracts → Outfitter contracts",
	},
	{
		pattern: /\bKit\s+config\b/g,
		replacement: "Outfitter config",
		description: "Kit config → Outfitter config",
	},
	{
		pattern: /\bKit\s+Biome\b/g,
		replacement: "Outfitter Biome",
		description: "Kit Biome → Outfitter Biome",
	},
	{
		pattern: /\bKit\s+Result\b/g,
		replacement: "Outfitter Result",
		description: "Kit Result → Outfitter Result",
	},
	{
		pattern: /\bKit\s+error\s+taxonomy\b/g,
		replacement: "Outfitter error taxonomy",
		description: "Kit error taxonomy → Outfitter error taxonomy",
	},
	{
		pattern: /\bKit\s+action\s+registry\b/g,
		replacement: "Outfitter action registry",
		description: "Kit action registry → Outfitter action registry",
	},
	{
		pattern: /\bKit\s+testing\b/g,
		replacement: "Outfitter testing",
		description: "Kit testing → Outfitter testing",
	},
	{
		pattern: /\bKit\s+CLI\b/g,
		replacement: "Outfitter CLI",
		description: "Kit CLI → Outfitter CLI",
	},
	{
		pattern: /\bKit\s+conventions?\b/g,
		replacement: "Outfitter conventions",
		description: "Kit conventions → Outfitter conventions",
	},
	{
		pattern: /\bKit\s+baseline\b/g,
		replacement: "Outfitter baseline",
		description: "Kit baseline → Outfitter baseline",
	},
	{
		pattern: /\bKit\s+defaults?\b/g,
		replacement: "Outfitter defaults",
		description: "Kit defaults → Outfitter defaults",
	},
	{
		pattern: /\bKit\s+index\s+stack\b/g,
		replacement: "Outfitter index stack",
		description: "Kit index stack → Outfitter index stack",
	},
	{
		pattern: /\bKit\s+expects?\b/g,
		replacement: "Outfitter expects",
		description: "Kit expects → Outfitter expects",
	},
	{
		pattern: /\bKit\s+prefers?\b/g,
		replacement: "Outfitter prefers",
		description: "Kit prefers → Outfitter prefers",
	},
	{
		pattern: /\bKit\s+provides?\b/g,
		replacement: "Outfitter provides",
		description: "Kit provides → Outfitter provides",
	},
	{
		pattern: /\bKit\s+should\b/g,
		replacement: "Outfitter should",
		description: "Kit should → Outfitter should",
	},
	{
		pattern: /\bKit\s+MUST\b/g,
		replacement: "Outfitter MUST",
		description: "Kit MUST → Outfitter MUST",
	},
	{
		pattern: /\bKit\s+uses?\b/g,
		replacement: "Outfitter uses",
		description: "Kit uses → Outfitter uses",
	},
	{
		pattern: /\bKit\s+relies\b/g,
		replacement: "Outfitter relies",
		description: "Kit relies → Outfitter relies",
	},
	{
		pattern: /\bKit\s+handles?\b/g,
		replacement: "Outfitter handles",
		description: "Kit handles → Outfitter handles",
	},
	{
		pattern: /\bKit\s+supports?\b/g,
		replacement: "Outfitter supports",
		description: "Kit supports → Outfitter supports",
	},
	{
		pattern: /\bKit\s+follows?\b/g,
		replacement: "Outfitter follows",
		description: "Kit follows → Outfitter follows",
	},
	{
		pattern: /\bKit\s+standardize[sd]?\b/g,
		replacement: "Outfitter standardizes",
		description: "Kit standardizes → Outfitter standardizes",
	},
	{
		pattern: /\bKit\s+formalizes?\b/g,
		replacement: "Outfitter formalizes",
		description: "Kit formalizes → Outfitter formalizes",
	},
	{
		pattern: /\bKit\s+tokens?\b/g,
		replacement: "Outfitter tokens",
		description: "Kit tokens → Outfitter tokens",
	},
	{
		pattern: /\bKit\s+logtape\b/g,
		replacement: "Outfitter logtape",
		description: "Kit logtape → Outfitter logtape",
	},
	{
		pattern: /\bKit\s+adoption\b/g,
		replacement: "Outfitter adoption",
		description: "Kit adoption → Outfitter adoption",
	},
	{
		pattern: /\bKit\s+tiering\b/g,
		replacement: "Outfitter tiering",
		description: "Kit tiering → Outfitter tiering",
	},
	{
		pattern: /\bKit\s+implementation\b/g,
		replacement: "Outfitter implementation",
		description: "Kit implementation → Outfitter implementation",
	},
	{
		pattern: /\bKit\s+should\s+generalize\b/g,
		replacement: "Outfitter should generalize",
		description: "Kit should generalize → Outfitter should generalize",
	},
	{
		pattern: /\bKit\s+should\s+expand\b/g,
		replacement: "Outfitter should expand",
		description: "Kit should expand → Outfitter should expand",
	},
	{
		pattern: /\*\*Kit\s+implementation\s+needed\*\*/g,
		replacement: "**Outfitter implementation needed**",
		description: "**Kit implementation needed** → **Outfitter implementation needed**",
	},
	{
		pattern: /\bKit\s+implementation\s+needed\b/g,
		replacement: "Outfitter implementation needed",
		description: "Kit implementation needed → Outfitter implementation needed",
	},
	{
		pattern: /`kit`\s+repo\b/g,
		replacement: "`outfitter` repo",
		description: "`kit` repo → `outfitter` repo",
	},
	{
		pattern: /\bfor\s+Kit\./g,
		replacement: "for Outfitter.",
		description: "for Kit. → for Outfitter.",
	},
	{
		pattern: /\bSuitable\s+for\s+Kit\b/g,
		replacement: "Suitable for Outfitter",
		description: "Suitable for Kit → Suitable for Outfitter",
	},
	{
		pattern: /\bKit's\b/g,
		replacement: "Outfitter's",
		description: "Kit's → Outfitter's",
	},
	{
		pattern: /\bKit\s+`/g,
		replacement: "Outfitter `",
		description: "Kit ` → Outfitter ` (before code references)",
	},
	{
		pattern: /\bvs\s+Kit\b/g,
		replacement: "vs Outfitter",
		description: "vs Kit → vs Outfitter",
	},
	{
		pattern: /\bKit\s+taxonomy\b/g,
		replacement: "Outfitter taxonomy",
		description: "Kit taxonomy → Outfitter taxonomy",
	},
	{
		pattern: /\bKit\s+actions\b/g,
		replacement: "Outfitter actions",
		description: "Kit actions → Outfitter actions",
	},
	{
		pattern: /\bKit\s+standard\b/g,
		replacement: "Outfitter standard",
		description: "Kit standard → Outfitter standard",
	},
	{
		pattern: /\bKit-compatible\b/g,
		replacement: "Outfitter-compatible",
		description: "Kit-compatible → Outfitter-compatible",
	},
	{
		pattern: /\bAdd\s+Kit\b/g,
		replacement: "Add Outfitter",
		description: "Add Kit → Add Outfitter",
	},

	// Lowercase "kit" referring to the project
	{
		pattern: /\bThe\s+kit\s+uses\b/g,
		replacement: "Outfitter uses",
		description: "The kit uses → Outfitter uses",
	},
	{
		pattern: /\bThe\s+kit\s+enforces\b/g,
		replacement: "Outfitter enforces",
		description: "The kit enforces → Outfitter enforces",
	},
	{
		pattern: /\bThe\s+kit\s+provides\b/g,
		replacement: "Outfitter provides",
		description: "The kit provides → Outfitter provides",
	},
	{
		pattern: /\bThe\s+kit\s+should\b/g,
		replacement: "Outfitter should",
		description: "The kit should → Outfitter should",
	},
	{
		pattern: /\bThe\s+kit\s+supports\b/g,
		replacement: "Outfitter supports",
		description: "The kit supports → Outfitter supports",
	},
	{
		pattern: /\bThe\s+kit\s+follows\b/g,
		replacement: "Outfitter follows",
		description: "The kit follows → Outfitter follows",
	},
	{
		pattern: /\bthe\s+kit\b/gi,
		replacement: "Outfitter",
		description: "the kit → Outfitter",
	},
	{
		pattern: /\bkit\s+packages\b/g,
		replacement: "Outfitter packages",
		description: "kit packages → Outfitter packages",
	},
	{
		pattern: /\bkit's\b/g,
		replacement: "Outfitter's",
		description: "kit's → Outfitter's",
	},
	{
		pattern: /\bkit\s+errors\b/gi,
		replacement: "Outfitter errors",
		description: "kit errors → Outfitter errors",
	},
	{
		pattern: /\bkit\s+ecosystem\b/gi,
		replacement: "Outfitter ecosystem",
		description: "kit ecosystem → Outfitter ecosystem",
	},
	{
		pattern: /\bkit\s+package\s+updates\b/gi,
		replacement: "Outfitter package updates",
		description: "kit package updates → Outfitter package updates",
	},
	{
		pattern: /\bacross\s+the\s+kit\b/gi,
		replacement: "across Outfitter",
		description: "across the kit → across Outfitter",
	},
	{
		pattern: /\ball\s+kit\s+errors\b/gi,
		replacement: "all Outfitter errors",
		description: "all kit errors → all Outfitter errors",
	},
	{
		pattern: /\bwith\s+kit\s+packages\b/gi,
		replacement: "with Outfitter packages",
		description: "with kit packages → with Outfitter packages",
	},
	{
		pattern: /\bpass\s+with\s+kit\b/gi,
		replacement: "pass with Outfitter",
		description: "pass with kit → pass with Outfitter",
	},

	// Migration document specific
	{
		pattern: /→\s*Kit\s+Migration\b/g,
		replacement: "→ Outfitter Migration",
		description: "→ Kit Migration → → Outfitter Migration",
	},
	{
		pattern: /\bKit\s+Deltas\b/g,
		replacement: "Outfitter Deltas",
		description: "Kit Deltas → Outfitter Deltas",
	},
	{
		pattern: /\badopt\s+Kit\b/g,
		replacement: "adopt Outfitter",
		description: "adopt Kit → adopt Outfitter",
	},
	{
		pattern: /\binto\s+Kit\b/g,
		replacement: "into Outfitter",
		description: "into Kit → into Outfitter",
	},
	{
		pattern: /\bbeyond\s+Kit\b/g,
		replacement: "beyond Outfitter",
		description: "beyond Kit → beyond Outfitter",
	},
	{
		pattern: /\bto\s+Kit\b/g,
		replacement: "to Outfitter",
		description: "to Kit → to Outfitter",
	},
	{
		pattern: /\bwith\s+Kit\b/g,
		replacement: "with Outfitter",
		description: "with Kit → with Outfitter",
	},
	{
		pattern: /\bfor\s+Kit\b/g,
		replacement: "for Outfitter",
		description: "for Kit → for Outfitter",
	},
	{
		pattern: /\bfrom\s+Kit\b/g,
		replacement: "from Outfitter",
		description: "from Kit → from Outfitter",
	},

	// SPEC.md specific patterns
	{
		pattern: /\bkit-specific\b/g,
		replacement: "Outfitter-specific",
		description: "kit-specific → Outfitter-specific",
	},
	{
		pattern: /\bBun-only\s+kit\b/g,
		replacement: "Bun-only stack",
		description: "Bun-only kit → Bun-only stack",
	},
	{
		pattern: /\bpost-kit\b/g,
		replacement: "post-Outfitter",
		description: "post-kit → post-Outfitter",
	},

	// PLAN.md specific - "kit repo" → "outfitter repo"
	{
		pattern: /\bkit\s+repo\b/gi,
		replacement: "outfitter repo",
		description: "kit repo → outfitter repo",
	},
	{
		pattern: /\bconsume\s+the\s+kit\b/gi,
		replacement: "consume Outfitter packages",
		description: "consume the kit → consume Outfitter packages",
	},
	{
		pattern: /\bconsume\s+kit\s+packages\b/gi,
		replacement: "consume Outfitter packages",
		description: "consume kit packages → consume Outfitter packages",
	},

	// Linear project reference
	{
		pattern: /\bKit\s+project\b/g,
		replacement: "Stack project",
		description: "Kit project → Stack project",
	},

	// Code references
	{
		pattern: /\bKitError\b/g,
		replacement: "OutfitterError",
		description: "KitError → OutfitterError",
	},

	// Directory structure examples (careful - might be intentional examples)
	{
		pattern: /^kit\/$/gm,
		replacement: "outfitter/",
		description: "kit/ → outfitter/ (directory example)",
	},
];

interface Change {
	file: string;
	line: number;
	before: string;
	after: string;
	rule: string;
}

async function findFiles(): Promise<string[]> {
	const glob = new Glob("**/*.{ts,tsx,js,jsx,json,md}");
	const files: string[] = [];

	for await (const file of glob.scan({ cwd: process.cwd() })) {
		const shouldSkip = SKIP_PATHS.some((skip) => file.includes(skip) || file.startsWith(skip));
		if (!shouldSkip) {
			files.push(file);
		}
	}

	return files.sort();
}

function shouldSkipLine(line: string): boolean {
	return SKIP_PATTERNS.some((pattern) => pattern.test(line));
}

async function processFile(filePath: string): Promise<Change[]> {
	const changes: Change[] = [];
	const content = await Bun.file(filePath).text();
	const lines = content.split("\n");

	let newContent = content;

	for (const rule of REPLACEMENTS) {
		const matches = content.matchAll(rule.pattern);
		for (const match of matches) {
			if (match.index === undefined) continue;

			// Find line number
			const beforeMatch = content.slice(0, match.index);
			const lineNum = beforeMatch.split("\n").length;
			const line = lines[lineNum - 1] || "";

			// Skip if line matches skip patterns
			if (shouldSkipLine(line)) continue;

			changes.push({
				file: filePath,
				line: lineNum,
				before: match[0],
				after: match[0].replace(rule.pattern, rule.replacement),
				rule: rule.description,
			});
		}

		// Apply replacement (will be written if not dry run)
		newContent = newContent.replace(rule.pattern, rule.replacement);
	}

	if (!DRY_RUN && changes.length > 0) {
		await Bun.write(filePath, newContent);
	}

	return changes;
}

async function findUnmatchedKitMentions(filePath: string): Promise<string[]> {
	const content = await Bun.file(filePath).text();
	const lines = content.split("\n");
	const unmatched: string[] = [];

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (!line) continue;

		// Check for any remaining "kit" mentions (case insensitive, word boundary)
		if (/\bkit\b/i.test(line)) {
			// Skip if it's a known skip pattern
			if (shouldSkipLine(line)) continue;

			// Check if this line would be changed by any rule
			let wouldChange = false;
			for (const rule of REPLACEMENTS) {
				if (rule.pattern.test(line)) {
					wouldChange = true;
					break;
				}
				// Reset lastIndex for global patterns
				rule.pattern.lastIndex = 0;
			}

			if (!wouldChange) {
				unmatched.push(`${filePath}:${i + 1}: ${line.trim()}`);
			}
		}
	}

	return unmatched;
}

async function main() {
	console.log(DRY_RUN ? "🔍 DRY RUN MODE\n" : "✏️  APPLYING CHANGES\n");

	const files = await findFiles();
	console.log(`Scanning ${files.length} files...\n`);

	const allChanges: Change[] = [];
	const allUnmatched: string[] = [];

	for (const file of files) {
		const changes = await processFile(file);
		allChanges.push(...changes);

		const unmatched = await findUnmatchedKitMentions(file);
		allUnmatched.push(...unmatched);
	}

	// Group changes by file
	const changesByFile = new Map<string, Change[]>();
	for (const change of allChanges) {
		const existing = changesByFile.get(change.file) || [];
		existing.push(change);
		changesByFile.set(change.file, existing);
	}

	// Print changes
	if (allChanges.length > 0) {
		console.log("📝 Changes:\n");
		for (const [file, changes] of changesByFile) {
			console.log(`  ${file}:`);
			for (const change of changes) {
				console.log(`    L${change.line}: "${change.before}" → "${change.after}"`);
			}
			console.log();
		}
	}

	// Print unmatched (potential issues)
	if (allUnmatched.length > 0) {
		console.log("\n⚠️  UNMATCHED 'kit' mentions (need manual review):\n");
		for (const line of allUnmatched) {
			console.log(`  ${line}`);
		}
	}

	// Summary
	console.log("\n📊 Summary:");
	console.log(`  Files scanned: ${files.length}`);
	console.log(`  Changes ${DRY_RUN ? "to make" : "made"}: ${allChanges.length}`);
	console.log(`  Files affected: ${changesByFile.size}`);
	console.log(`  Unmatched mentions: ${allUnmatched.length}`);

	if (DRY_RUN && allChanges.length > 0) {
		console.log("\n💡 Run with --apply to make these changes");
	}
}

main().catch(console.error);
