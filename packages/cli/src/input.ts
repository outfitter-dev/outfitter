/**
 * Input parsing utilities for CLI commands.
 *
 * These utilities handle common input patterns like multi-ID collection,
 * file expansion, glob patterns, and various value parsing.
 *
 * @packageDocumentation
 */

import path from "node:path";
import { Err, Ok, type Result } from "better-result";
import { CancelledError, ValidationError } from "@outfitter/contracts";
import type {
	CollectIdsOptions,
	ConfirmDestructiveOptions,
	ExpandFileOptions,
	FilterExpression,
	KeyValuePair,
	NormalizeIdOptions,
	ParseGlobOptions,
	Range,
	SortCriteria,
} from "./types.js";

// =============================================================================
// Security Helpers
// =============================================================================

/**
 * Validates that a path doesn't contain traversal patterns.
 *
 * Rejects paths that:
 * - Start with .. or contain /.. or \..
 * - Contain null bytes
 * - Are absolute paths (unless explicitly allowed)
 */
function isSecurePath(filePath: string, allowAbsolute = false): boolean {
	// Reject null bytes
	if (filePath.includes("\0")) {
		return false;
	}

	// Check for .. traversal in ORIGINAL path (before normalization collapses it)
	// This catches both "../../../etc/passwd" and "/tmp/../../../etc/passwd"
	if (filePath.includes("..")) {
		return false;
	}

	// Normalize to handle different separators for absolute path check
	const normalized = path.normalize(filePath);

	// Reject absolute paths unless explicitly allowed
	if (!allowAbsolute && path.isAbsolute(normalized)) {
		return false;
	}

	return true;
}

/**
 * Validates that a glob pattern doesn't escape the workspace.
 *
 * Rejects patterns that:
 * - Start with ..
 * - Contain /../
 */
function isSecureGlobPattern(pattern: string): boolean {
	// Reject patterns that start with ..
	if (pattern.startsWith("..")) {
		return false;
	}

	// Reject patterns containing /../
	if (pattern.includes("/../")) {
		return false;
	}

	return true;
}

/**
 * Validates that a resolved path is within the workspace boundary.
 */
function isWithinWorkspace(resolvedPath: string, workspaceRoot: string): boolean {
	const normalizedPath = path.normalize(resolvedPath);
	const normalizedRoot = path.normalize(workspaceRoot);

	// Ensure the path starts with the workspace root
	return normalizedPath === normalizedRoot || normalizedPath.startsWith(normalizedRoot + path.sep);
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Reads stdin content using async iteration.
 */
async function readStdin(): Promise<string> {
	const chunks: string[] = [];
	for await (const chunk of process.stdin) {
		if (typeof chunk === "string") {
			chunks.push(chunk);
		} else if (Buffer.isBuffer(chunk)) {
			chunks.push(chunk.toString("utf-8"));
		} else if (chunk instanceof Uint8Array) {
			// Convert Uint8Array to Buffer then to string
			chunks.push(Buffer.from(chunk).toString("utf-8"));
		}
	}
	return chunks.join("");
}

/**
 * Splits a string by comma and/or space, trimming each part.
 */
function splitIds(input: string): string[] {
	// Split on commas first, then on spaces within each part
	return input
		.split(",")
		.flatMap((part) => part.trim().split(/\s+/))
		.map((id) => id.trim())
		.filter(Boolean);
}

/**
 * Checks if a path is a directory using Bun.file and $stat.
 */
async function isDirectory(path: string): Promise<boolean> {
	try {
		// Use Bun shell to check if directory
		const result = await Bun.$`test -d ${path}`.quiet();
		return result.exitCode === 0;
	} catch {
		return false;
	}
}

/**
 * Checks if a path is a file using Bun shell.
 */
async function isFile(path: string): Promise<boolean> {
	try {
		// Use Bun shell to check if file
		const result = await Bun.$`test -f ${path}`.quiet();
		return result.exitCode === 0;
	} catch {
		return false;
	}
}

// =============================================================================
// collectIds()
// =============================================================================

/**
 * Collect IDs from various input formats.
 *
 * Handles space-separated, comma-separated, repeated flags, @file, and stdin.
 *
 * @param input - Raw input from CLI arguments
 * @param options - Collection options
 * @returns Array of collected IDs
 *
 * @example
 * ```typescript
 * // All these produce the same result:
 * // wm show id1 id2 id3
 * // wm show id1,id2,id3
 * // wm show --ids id1 --ids id2
 * // wm show @ids.txt
 * const ids = await collectIds(args.ids, {
 *   allowFile: true,
 *   allowStdin: true,
 * });
 * ```
 */
export async function collectIds(
	input: string | readonly string[],
	options?: CollectIdsOptions,
): Promise<string[]> {
	const { allowFile = true, allowStdin = true } = options ?? {};

	const ids: string[] = [];

	// Normalize input to array
	const inputs = Array.isArray(input) ? input : [input];

	for (const item of inputs) {
		if (!item) continue;

		// Check for @file reference
		if (item.startsWith("@")) {
			const filePath = item.slice(1);

			// @- means stdin
			if (filePath === "-") {
				if (!allowStdin) {
					throw new Error("Reading from stdin is not allowed");
				}
				const stdinContent = await readStdin();
				const stdinIds = stdinContent
					.split("\n")
					.map((line) => line.trim())
					.filter(Boolean);
				ids.push(...stdinIds);
			} else {
				// @file reference
				if (!allowFile) {
					throw new Error("File references are not allowed");
				}

				// Security: validate path doesn't contain traversal patterns
				if (!isSecurePath(filePath, true)) {
					throw new Error(`Security error: path traversal not allowed: ${filePath}`);
				}

				const file = Bun.file(filePath);
				const exists = await file.exists();
				if (!exists) {
					throw new Error(`File not found: ${filePath}`);
				}
				const content = await file.text();
				const fileIds = content
					.split("\n")
					.map((line) => line.trim())
					.filter(Boolean);
				ids.push(...fileIds);
			}
		} else {
			// Regular input - split by comma and/or space
			ids.push(...splitIds(item));
		}
	}

	// Deduplicate while preserving order
	return [...new Set(ids)];
}

// =============================================================================
// expandFileArg()
// =============================================================================

/**
 * Expand @file references to file contents.
 *
 * If the input starts with @, reads the file and returns its contents.
 * Otherwise, returns the input unchanged.
 *
 * @param input - Raw input that may be a @file reference
 * @param options - Expansion options
 * @returns File contents or original input
 *
 * @example
 * ```typescript
 * // wm create @template.md
 * const content = await expandFileArg(args.content);
 * ```
 */
export async function expandFileArg(input: string, options?: ExpandFileOptions): Promise<string> {
	const { encoding: _encoding = "utf-8", maxSize, trim = false } = options ?? {};

	// Not a file reference - return as-is
	if (!input.startsWith("@")) {
		return input;
	}

	const filePath = input.slice(1);

	// @- means stdin
	if (filePath === "-") {
		let content = await readStdin();
		if (trim) {
			content = content.trim();
		}
		return content;
	}

	// Security: validate path doesn't contain traversal patterns
	if (!isSecurePath(filePath, true)) {
		throw new Error(`Security error: path traversal not allowed: ${filePath}`);
	}

	// Read file
	const file = Bun.file(filePath);
	const exists = await file.exists();
	if (!exists) {
		throw new Error(`File not found: ${filePath}`);
	}

	// Check size limit before reading
	if (maxSize !== undefined) {
		const size = file.size;
		if (size > maxSize) {
			throw new Error(`File exceeds maximum size of ${maxSize} bytes`);
		}
	}

	// Read file content - Bun.file.text() always uses UTF-8
	let content = await file.text();

	if (trim) {
		content = content.trim();
	}

	return content;
}

// =============================================================================
// parseGlob()
// =============================================================================

/**
 * Parse and expand glob patterns.
 *
 * Uses Bun.Glob with workspace constraints.
 *
 * @param pattern - Glob pattern to expand
 * @param options - Glob options
 * @returns Array of matched file paths
 *
 * @example
 * ```typescript
 * // wm index "src/**\/*.ts"
 * const files = await parseGlob(args.pattern, {
 *   cwd: workspaceRoot,
 *   ignore: ["node_modules/**"],
 * });
 * ```
 */
export async function parseGlob(pattern: string, options?: ParseGlobOptions): Promise<string[]> {
	const {
		cwd = process.cwd(),
		ignore = [],
		onlyFiles = false,
		onlyDirectories = false,
		followSymlinks = false,
	} = options ?? {};

	// Security: validate pattern doesn't escape workspace
	if (!isSecureGlobPattern(pattern)) {
		throw new Error(`Security error: glob pattern may escape workspace: ${pattern}`);
	}

	// Resolve workspace root for boundary checking
	const resolvedCwd = path.resolve(cwd);

	const glob = new Bun.Glob(pattern);
	const matches: string[] = [];

	// Scan with options
	// Only set onlyFiles when explicitly requested (not as default)
	const scanOptions = {
		cwd,
		followSymlinks,
		onlyFiles: onlyFiles === true,
	};

	for await (const match of glob.scan(scanOptions)) {
		// Resolve absolute path for workspace boundary check
		const fullPath = path.resolve(cwd, match);

		// Security: verify match is within workspace
		if (!isWithinWorkspace(fullPath, resolvedCwd)) {
			continue;
		}

		// Check against ignore patterns
		let shouldIgnore = false;
		for (const ignorePattern of ignore) {
			const ignoreGlob = new Bun.Glob(ignorePattern);
			if (ignoreGlob.match(match)) {
				shouldIgnore = true;
				break;
			}
		}

		if (shouldIgnore) continue;

		// If onlyDirectories, check if it's a directory
		if (onlyDirectories) {
			const isDir = await isDirectory(fullPath);
			if (!isDir) continue;
		}

		// If onlyFiles, check if it's a file
		if (onlyFiles) {
			const isF = await isFile(fullPath);
			if (!isF) continue;
		}

		matches.push(match);
	}

	return matches;
}

// =============================================================================
// parseKeyValue()
// =============================================================================

/**
 * Parse key=value pairs from CLI input.
 *
 * @param input - Raw input containing key=value pairs
 * @returns Array of parsed key-value pairs
 *
 * @example
 * ```typescript
 * // --set key=value --set key2=value2
 * // --set key=value,key2=value2
 * const pairs = parseKeyValue(args.set);
 * // => [{ key: "key", value: "value" }, { key: "key2", value: "value2" }]
 * ```
 */
export function parseKeyValue(
	input: string | readonly string[],
): Result<KeyValuePair[], InstanceType<typeof ValidationError>> {
	const pairs: KeyValuePair[] = [];

	// Normalize input to array
	const inputs = Array.isArray(input) ? input : [input];

	for (const item of inputs) {
		if (!item) continue;

		// Split by comma for multiple pairs
		const parts = item.split(",");

		for (const part of parts) {
			const trimmed = part.trim();
			if (!trimmed) continue;

			// Find first equals sign
			const eqIndex = trimmed.indexOf("=");

			if (eqIndex === -1) {
				return new Err(
					new ValidationError({ message: `Missing '=' in key-value pair: ${trimmed}` }),
				);
			}

			const key = trimmed.slice(0, eqIndex).trim();
			const value = trimmed.slice(eqIndex + 1);

			if (!key) {
				return new Err(new ValidationError({ message: "Empty key in key-value pair" }));
			}

			pairs.push({ key, value });
		}
	}

	return new Ok(pairs);
}

// =============================================================================
// parseRange()
// =============================================================================

/**
 * Parse range inputs (numeric or date).
 *
 * @param input - Range string (e.g., "1-10" or "2024-01-01..2024-12-31")
 * @param type - Type of range to parse
 * @returns Parsed range
 *
 * @example
 * ```typescript
 * parseRange("1-10", "number");
 * // => Result<{ type: "number", min: 1, max: 10 }, ValidationError>
 *
 * parseRange("2024-01-01..2024-12-31", "date");
 * // => Result<{ type: "date", start: Date, end: Date }, ValidationError>
 * ```
 */
export function parseRange(
	input: string,
	type: "number" | "date",
): Result<Range, InstanceType<typeof ValidationError>> {
	const trimmed = input.trim();

	if (type === "date") {
		// Date range uses ".." separator
		const parts = trimmed.split("..");

		if (parts.length === 1) {
			// Single date - start and end are the same
			const dateStr = parts[0];
			if (dateStr === undefined) {
				return new Err(new ValidationError({ message: "Empty date input" }));
			}
			const date = new Date(dateStr.trim());
			if (Number.isNaN(date.getTime())) {
				return new Err(new ValidationError({ message: `Invalid date format: ${dateStr}` }));
			}
			return new Ok({ type: "date", start: date, end: date });
		}

		if (parts.length === 2) {
			const startStr = parts[0];
			const endStr = parts[1];
			if (startStr === undefined || endStr === undefined) {
				return new Err(new ValidationError({ message: "Invalid date range format" }));
			}
			const start = new Date(startStr.trim());
			const end = new Date(endStr.trim());

			if (Number.isNaN(start.getTime())) {
				return new Err(new ValidationError({ message: `Invalid date format: ${startStr}` }));
			}
			if (Number.isNaN(end.getTime())) {
				return new Err(new ValidationError({ message: `Invalid date format: ${endStr}` }));
			}

			if (start.getTime() > end.getTime()) {
				return new Err(
					new ValidationError({ message: "Start date must be before or equal to end date" }),
				);
			}

			return new Ok({ type: "date", start, end });
		}

		return new Err(new ValidationError({ message: `Invalid date range format: ${input}` }));
	}

	// Numeric range uses "-" separator (but we need to handle negative numbers)
	// Pattern: handle negative numbers like -10--5 (meaning -10 to -5)

	// Try to parse as single number first
	const singleNum = Number(trimmed);
	if (!Number.isNaN(singleNum) && !trimmed.includes("-", trimmed.startsWith("-") ? 1 : 0)) {
		return new Ok({ type: "number", min: singleNum, max: singleNum });
	}

	// Parse range with potential negative numbers
	// Strategy: find the separator "-" that isn't part of a negative number
	// A "-" is a separator if:
	// - It's not the first character
	// - The character before it is a digit or space

	let separatorIndex = -1;
	for (let i = 1; i < trimmed.length; i++) {
		const char = trimmed[i];
		const prevChar = trimmed[i - 1];
		if (char === "-" && prevChar !== undefined) {
			// If previous char is a digit or space, this is likely the separator
			if (/[\d\s]/.test(prevChar)) {
				separatorIndex = i;
				break;
			}
		}
	}

	if (separatorIndex === -1) {
		return new Err(new ValidationError({ message: `Invalid numeric range format: ${input}` }));
	}

	const minStr = trimmed.slice(0, separatorIndex).trim();
	const maxStr = trimmed.slice(separatorIndex + 1).trim();

	const min = Number(minStr);
	const max = Number(maxStr);

	if (Number.isNaN(min)) {
		return new Err(new ValidationError({ message: `Invalid number: ${minStr}` }));
	}
	if (Number.isNaN(max)) {
		return new Err(new ValidationError({ message: `Invalid number: ${maxStr}` }));
	}

	if (min > max) {
		return new Err(new ValidationError({ message: "Min must be less than or equal to max" }));
	}

	return new Ok({ type: "number", min, max });
}

// =============================================================================
// parseFilter()
// =============================================================================

/**
 * Parse filter expressions from CLI input.
 *
 * @param input - Filter string (e.g., "status:active,priority:high")
 * @returns Array of parsed filter expressions
 *
 * @example
 * ```typescript
 * parseFilter("status:active,priority:high");
 * // => Result<[
 * //   { field: "status", value: "active" },
 * //   { field: "priority", value: "high" }
 * // ], ValidationError>
 * ```
 */
export function parseFilter(
	input: string,
): Result<FilterExpression[], InstanceType<typeof ValidationError>> {
	const trimmed = input.trim();

	if (!trimmed) {
		return new Ok([]);
	}

	const filters: FilterExpression[] = [];

	// Split by comma for multiple filters
	const parts = trimmed.split(",");

	for (const part of parts) {
		let partTrimmed = part.trim();
		if (!partTrimmed) continue;

		// Check for negation prefix
		let isNegated = false;
		if (partTrimmed.startsWith("!")) {
			isNegated = true;
			partTrimmed = partTrimmed.slice(1).trim();
		}

		// Find first colon (field:value separator)
		const colonIndex = partTrimmed.indexOf(":");

		if (colonIndex === -1) {
			return new Err(
				new ValidationError({ message: `Missing ':' in filter expression: ${part.trim()}` }),
			);
		}

		const field = partTrimmed.slice(0, colonIndex).trim();
		let value = partTrimmed.slice(colonIndex + 1).trim();

		// Check for operators in value
		let operator: FilterExpression["operator"] | undefined;

		if (isNegated) {
			operator = "ne";
		} else if (value.startsWith(">=")) {
			operator = "gte";
			value = value.slice(2).trim();
		} else if (value.startsWith("<=")) {
			operator = "lte";
			value = value.slice(2).trim();
		} else if (value.startsWith(">")) {
			operator = "gt";
			value = value.slice(1).trim();
		} else if (value.startsWith("<")) {
			operator = "lt";
			value = value.slice(1).trim();
		} else if (value.startsWith("~")) {
			operator = "contains";
			value = value.slice(1).trim();
		}

		const filter: FilterExpression = { field, value };
		if (operator) {
			(filter as { operator: typeof operator }).operator = operator;
		}

		filters.push(filter);
	}

	return new Ok(filters);
}

// =============================================================================
// parseSortSpec()
// =============================================================================

/**
 * Parse sort specification from CLI input.
 *
 * @param input - Sort string (e.g., "modified:desc,title:asc")
 * @returns Array of parsed sort criteria
 *
 * @example
 * ```typescript
 * parseSortSpec("modified:desc,title:asc");
 * // => Result<[
 * //   { field: "modified", direction: "desc" },
 * //   { field: "title", direction: "asc" }
 * // ], ValidationError>
 * ```
 */
export function parseSortSpec(
	input: string,
): Result<SortCriteria[], InstanceType<typeof ValidationError>> {
	const trimmed = input.trim();

	if (!trimmed) {
		return new Ok([]);
	}

	const criteria: SortCriteria[] = [];

	// Split by comma for multiple sort fields
	const parts = trimmed.split(",");

	for (const part of parts) {
		const partTrimmed = part.trim();
		if (!partTrimmed) continue;

		// Check for direction (field:direction)
		const colonIndex = partTrimmed.indexOf(":");

		if (colonIndex === -1) {
			// No direction specified - default to asc
			criteria.push({ field: partTrimmed, direction: "asc" });
		} else {
			const field = partTrimmed.slice(0, colonIndex).trim();
			const direction = partTrimmed
				.slice(colonIndex + 1)
				.trim()
				.toLowerCase();

			if (direction !== "asc" && direction !== "desc") {
				return new Err(
					new ValidationError({
						message: `Invalid sort direction: ${direction}. Must be 'asc' or 'desc'.`,
					}),
				);
			}

			criteria.push({ field, direction });
		}
	}

	return new Ok(criteria);
}

// =============================================================================
// normalizeId()
// =============================================================================

/**
 * Normalize an identifier (trim, lowercase where appropriate).
 *
 * @param input - Raw identifier input
 * @param options - Normalization options
 * @returns Normalized identifier
 *
 * @example
 * ```typescript
 * normalizeId("  MY-ID  ", { lowercase: true, trim: true });
 * // => Result<"my-id", ValidationError>
 * ```
 */
export function normalizeId(
	input: string,
	options?: NormalizeIdOptions,
): Result<string, InstanceType<typeof ValidationError>> {
	const { trim = false, lowercase = false, minLength, maxLength, pattern } = options ?? {};

	let normalized = input;

	if (trim) {
		normalized = normalized.trim();
	}

	if (lowercase) {
		normalized = normalized.toLowerCase();
	}

	// Validate length constraints
	if (minLength !== undefined && normalized.length < minLength) {
		return new Err(
			new ValidationError({
				message: `ID must be at least ${minLength} characters long`,
				field: "id",
			}),
		);
	}

	if (maxLength !== undefined && normalized.length > maxLength) {
		return new Err(
			new ValidationError({
				message: `ID must be at most ${maxLength} characters long`,
				field: "id",
			}),
		);
	}

	// Validate pattern
	if (pattern && !pattern.test(normalized)) {
		return new Err(
			new ValidationError({
				message: `ID does not match required pattern: ${pattern.source}`,
				field: "id",
			}),
		);
	}

	return new Ok(normalized);
}

// =============================================================================
// confirmDestructive()
// =============================================================================

/**
 * Prompt for confirmation before destructive operations.
 *
 * Respects --yes flag for non-interactive mode.
 *
 * @param options - Confirmation options
 * @returns Whether the user confirmed
 *
 * @example
 * ```typescript
 * const confirmed = await confirmDestructive({
 *   message: "Delete 5 notes?",
 *   bypassFlag: flags.yes,
 *   itemCount: 5,
 * });
 *
 * if (confirmed.isErr()) {
 *   // User cancelled
 *   process.exit(0);
 * }
 * ```
 */
export async function confirmDestructive(
	options: ConfirmDestructiveOptions,
): Promise<Result<boolean, InstanceType<typeof CancelledError>>> {
	const { message, bypassFlag = false, itemCount } = options;

	// If bypass flag is set, skip confirmation
	if (bypassFlag) {
		return new Ok(true);
	}

	// Check if we're in a TTY environment
	const isTTY = process.stdout.isTTY;
	// biome-ignore lint/complexity/useLiteralKeys: noPropertyAccessFromIndexSignature requires bracket notation
	const isDumbTerminal = process.env["TERM"] === "dumb";

	if (!isTTY || isDumbTerminal) {
		// Can't prompt in non-TTY or dumb terminal - return Err
		return new Err(
			new CancelledError({
				message: "Cannot prompt for confirmation in non-interactive mode. Use --yes to bypass.",
			}),
		);
	}

	// Build the prompt message
	let promptMessage = message;
	if (itemCount !== undefined) {
		promptMessage = `${message} (${itemCount} items)`;
	}

	const { confirm, isCancel } = await import("@clack/prompts");
	const response = await confirm({ message: promptMessage });

	if (isCancel(response) || response === false) {
		return new Err(
			new CancelledError({
				message: "Operation cancelled by user.",
			}),
		);
	}

	return new Ok(true);
}
