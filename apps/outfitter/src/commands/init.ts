/**
 * `outfitter init` - Scaffolds a new Outfitter project.
 *
 * Creates a new project structure from a template, replacing placeholders
 * with project-specific values.
 *
 * @packageDocumentation
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { confirm, isCancel, text } from "@clack/prompts";
import { Result } from "@outfitter/contracts";
import type { Command } from "commander";

// =============================================================================
// Types
// =============================================================================

/**
 * Options for the init command.
 */
export interface InitOptions {
	/** Target directory to initialize the project in */
	readonly targetDir: string;
	/** Project name (defaults to directory name if not provided) */
	readonly name: string | undefined;
	/** Binary name (defaults to project name if not provided) */
	readonly bin?: string;
	/** Template to use (defaults to 'basic') */
	readonly template: string | undefined;
	/** Whether to overwrite existing files */
	readonly force: boolean;
}

/**
 * Placeholder values for template substitution.
 */
interface PlaceholderValues {
	readonly name: string;
	readonly projectName: string;
	readonly binName: string;
	readonly version: string;
	readonly description: string;
}

/**
 * Error returned when initialization fails.
 */
export class InitError extends Error {
	readonly _tag = "InitError" as const;

	constructor(message: string) {
		super(message);
		this.name = "InitError";
	}
}

// =============================================================================
// Binary File Detection
// =============================================================================

/**
 * Set of file extensions known to be binary formats.
 * These files should be copied as raw buffers without placeholder substitution.
 */
const BINARY_EXTENSIONS = new Set([
	// Images
	".png",
	".jpg",
	".jpeg",
	".gif",
	".ico",
	".webp",
	".bmp",
	".tiff",
	".svg", // SVG is text but often contains complex content that shouldn't be modified
	// Fonts
	".woff",
	".woff2",
	".ttf",
	".otf",
	".eot",
	// Audio/Video
	".mp3",
	".mp4",
	".wav",
	".ogg",
	".webm",
	// Archives
	".zip",
	".tar",
	".gz",
	".bz2",
	".7z",
	// Documents
	".pdf",
	// Executables/Libraries
	".exe",
	".dll",
	".so",
	".dylib",
	".node",
	".wasm",
	// Other binary formats
	".bin",
	".dat",
	".db",
	".sqlite",
	".sqlite3",
]);

/**
 * Checks if a file should be treated as binary based on its extension.
 *
 * @param filename - The filename to check
 * @returns True if the file is binary, false otherwise
 */
function isBinaryFile(filename: string): boolean {
	const ext = extname(filename).toLowerCase();
	return BINARY_EXTENSIONS.has(ext);
}

// =============================================================================
// Template Processing
// =============================================================================

/**
 * Gets the path to the templates directory.
 */
function getTemplatesDir(): string {
	// Templates are stored at the monorepo root
	// Walk up from the current file location to find templates/
	// Use fileURLToPath to properly decode percent-encoded paths (e.g., spaces)
	let currentDir = dirname(fileURLToPath(import.meta.url));

	// Walk up until we find the templates directory
	for (let i = 0; i < 10; i++) {
		const templatesPath = join(currentDir, "templates");
		if (existsSync(templatesPath)) {
			return templatesPath;
		}
		currentDir = dirname(currentDir);
	}

	// Fallback: assume we're running from the monorepo root
	return join(process.cwd(), "templates");
}

/**
 * Validates that a template exists.
 */
function validateTemplate(templateName: string): Result<string, InitError> {
	const templatesDir = getTemplatesDir();
	const templatePath = join(templatesDir, templateName);

	if (!existsSync(templatePath)) {
		return Result.err(
			new InitError(
				`Template '${templateName}' not found. Available templates are in: ${templatesDir}`,
			),
		);
	}

	return Result.ok(templatePath);
}

/**
 * Replaces placeholders in content.
 *
 * Placeholders are in the format {{name}}, {{version}}, etc.
 */
function replacePlaceholders(content: string, values: PlaceholderValues): string {
	return content.replace(/\{\{(\w+)\}\}/g, (match, key) => {
		if (Object.hasOwn(values, key)) {
			return values[key as keyof PlaceholderValues];
		}
		return match;
	});
}

/**
 * Gets the output filename by removing .template extension.
 */
function getOutputFilename(templateFilename: string): string {
	if (templateFilename.endsWith(".template")) {
		return templateFilename.slice(0, -".template".length);
	}
	return templateFilename;
}

// =============================================================================
// Name Resolution
// =============================================================================

function isInteractive(): boolean {
	// biome-ignore lint/complexity/useLiteralKeys: noPropertyAccessFromIndexSignature requires bracket notation
	return process.stdout.isTTY === true && process.env["TERM"] !== "dumb";
}

interface PackageInfo {
	readonly name?: string;
	readonly bin?: string;
}

function readPackageInfo(targetDir: string): PackageInfo {
	const packageJsonPath = join(targetDir, "package.json");
	if (!existsSync(packageJsonPath)) {
		return {};
	}

	try {
		const content = readFileSync(packageJsonPath, "utf-8");
		const parsed = JSON.parse(content) as Record<string, unknown>;
		// biome-ignore lint/complexity/useLiteralKeys: noPropertyAccessFromIndexSignature requires bracket notation
		const name = parsed["name"];
		const resolvedName = typeof name === "string" && name.length > 0 ? name : undefined;

		// biome-ignore lint/complexity/useLiteralKeys: noPropertyAccessFromIndexSignature requires bracket notation
		const bin = parsed["bin"];
		let resolvedBin: string | undefined;
		if (typeof bin === "string") {
			resolvedBin = resolvedName ? deriveBinName(resolvedName) : undefined;
		} else if (typeof bin === "object" && bin !== null) {
			const entries = Object.entries(bin as Record<string, unknown>).filter(
				([, value]) => typeof value === "string",
			);
			const keys = entries.map(([key]) => key);
			if (keys.length > 0) {
				const derived = resolvedName ? deriveBinName(resolvedName) : undefined;
				if (derived && keys.includes(derived)) {
					resolvedBin = derived;
				} else if (resolvedName && keys.includes(resolvedName)) {
					resolvedBin = resolvedName;
				} else {
					resolvedBin = keys[0];
				}
			}
		}

		return {
			...(resolvedName ? { name: resolvedName } : {}),
			...(resolvedBin ? { bin: resolvedBin } : {}),
		};
	} catch {
		return {};
	}
}

function deriveBinName(projectName: string): string {
	if (projectName.startsWith("@")) {
		const parts = projectName.split("/");
		if (parts.length > 1 && parts[1]) {
			return parts[1];
		}
	}
	return projectName;
}

async function resolveProjectName(
	options: InitOptions,
	resolvedTargetDir: string,
	packageInfo: PackageInfo,
): Promise<Result<string, InitError>> {
	if (options.name) {
		return Result.ok(options.name);
	}

	const detectedName = packageInfo.name;
	if (detectedName) {
		if (isInteractive()) {
			const useDetected = await confirm({
				message: `Detected package name "${detectedName}". Use this as the project name?`,
			});

			if (isCancel(useDetected)) {
				return Result.err(new InitError("Initialization cancelled."));
			}

			if (useDetected) {
				return Result.ok(detectedName);
			}

			const custom = await text({
				message: "Project name",
				placeholder: basename(resolvedTargetDir),
			});

			if (isCancel(custom)) {
				return Result.err(new InitError("Initialization cancelled."));
			}

			const trimmed = String(custom).trim();
			return Result.ok(trimmed.length > 0 ? trimmed : basename(resolvedTargetDir));
		} else {
			return Result.ok(detectedName);
		}
	}

	return Result.ok(basename(resolvedTargetDir));
}

async function resolveBinName(
	options: InitOptions,
	projectName: string,
	packageInfo: PackageInfo,
): Promise<Result<string, InitError>> {
	if (options.bin) {
		return Result.ok(options.bin);
	}

	const derived = deriveBinName(projectName);
	const detected = packageInfo.bin;
	if (!isInteractive()) {
		return Result.ok(detected ?? derived);
	}

	if (detected) {
		const useDetected = await confirm({
			message: `Detected package binary name "${detected}". Use this as the binary name?`,
		});

		if (isCancel(useDetected)) {
			return Result.err(new InitError("Initialization cancelled."));
		}

		if (useDetected) {
			return Result.ok(detected);
		}
	}

	const useDerived = await confirm({
		message: `Use "${derived}" as the binary name?`,
	});

	if (isCancel(useDerived)) {
		return Result.err(new InitError("Initialization cancelled."));
	}

	if (useDerived) {
		return Result.ok(derived);
	}

	const custom = await text({
		message: "Binary name",
		placeholder: derived,
	});

	if (isCancel(custom)) {
		return Result.err(new InitError("Initialization cancelled."));
	}

	const trimmed = String(custom).trim();
	return Result.ok(trimmed.length > 0 ? trimmed : derived);
}

/**
 * Recursively copies template files to the target directory.
 */
function copyTemplateFiles(
	templateDir: string,
	targetDir: string,
	values: PlaceholderValues,
	force: boolean,
): Result<void, InitError> {
	try {
		// Ensure target directory exists
		if (!existsSync(targetDir)) {
			mkdirSync(targetDir, { recursive: true });
		}

		const entries = readdirSync(templateDir);

		for (const entry of entries) {
			const sourcePath = join(templateDir, entry);
			const stat = statSync(sourcePath);

			if (stat.isDirectory()) {
				// Recursively copy directories
				const targetSubDir = join(targetDir, entry);
				const result = copyTemplateFiles(sourcePath, targetSubDir, values, force);
				if (result.isErr()) {
					return result;
				}
			} else if (stat.isFile()) {
				// Process and copy files
				const outputFilename = getOutputFilename(entry);
				const targetPath = join(targetDir, outputFilename);

				// Check if file exists and force is not set
				if (existsSync(targetPath) && !force) {
					return Result.err(
						new InitError(`File '${targetPath}' already exists. Use --force to overwrite.`),
					);
				}

				// Handle binary files separately to avoid corruption
				if (isBinaryFile(outputFilename)) {
					// Copy binary files as raw buffers without modification
					const buffer = readFileSync(sourcePath);
					writeFileSync(targetPath, buffer);
				} else {
					// Read and process template content for text files
					const content = readFileSync(sourcePath, "utf-8");
					const processedContent = replacePlaceholders(content, values);

					// Write the processed content
					writeFileSync(targetPath, processedContent, "utf-8");
				}
			}
		}

		return Result.ok(undefined);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		return Result.err(new InitError(`Failed to copy template files: ${message}`));
	}
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Runs the init command programmatically.
 *
 * @param options - Init options
 * @returns Result indicating success or failure
 *
 * @example
 * ```typescript
 * const result = await runInit({
 *   targetDir: "./my-project",
 *   name: "my-project",
 *   template: "basic",
 *   force: false,
 * });
 *
 * if (result.isOk()) {
 *   console.log("Project initialized successfully!");
 * } else {
 *   console.error("Failed:", result.error.message);
 * }
 * ```
 */
export async function runInit(options: InitOptions): Promise<Result<void, InitError>> {
	const { targetDir, force } = options;

	// Resolve target directory
	const resolvedTargetDir = resolve(targetDir);

	// Determine project name
	const packageInfo = readPackageInfo(resolvedTargetDir);
	const projectNameResult = await resolveProjectName(options, resolvedTargetDir, packageInfo);
	if (projectNameResult.isErr()) {
		return projectNameResult;
	}
	const projectName = projectNameResult.value;

	// Determine binary name
	const binNameResult = await resolveBinName(options, projectName, packageInfo);
	if (binNameResult.isErr()) {
		return binNameResult;
	}
	const binName = binNameResult.value;

	// Determine template
	const templateName = options.template ?? "basic";

	// Validate template exists
	const templateResult = validateTemplate(templateName);
	if (templateResult.isErr()) {
		return templateResult;
	}
	const templatePath = templateResult.value;

	// Prepare placeholder values
	const values: PlaceholderValues = {
		name: projectName,
		projectName,
		binName,
		version: "0.1.0",
		description: `A new project created with Outfitter`,
	};

	// Check if target directory exists and has files
	if (existsSync(resolvedTargetDir) && !force) {
		try {
			const entries = readdirSync(resolvedTargetDir);
			// Filter out hidden files and common ignorable files
			const significantEntries = entries.filter((e) => !e.startsWith(".") || e === ".gitignore");
			if (significantEntries.length > 0) {
				// Check if any files would be overwritten
				for (const entry of significantEntries) {
					const templateEntry = `${entry}.template`;
					const templateFilePath = join(templatePath, templateEntry);
					const plainFilePath = join(templatePath, entry);
					if (existsSync(templateFilePath) || existsSync(plainFilePath)) {
						return Result.err(
							new InitError(
								`Directory '${resolvedTargetDir}' already exists with files that would be overwritten. Use --force to overwrite.`,
							),
						);
					}
				}
			}
		} catch {
			// If we can't read the directory, proceed (will fail later if actually problematic)
		}
	}

	// Ensure target directory exists
	try {
		if (!existsSync(resolvedTargetDir)) {
			mkdirSync(resolvedTargetDir, { recursive: true });
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		return Result.err(new InitError(`Failed to create target directory: ${message}`));
	}

	// Copy template files
	const copyResult = copyTemplateFiles(templatePath, resolvedTargetDir, values, force);
	if (copyResult.isErr()) {
		return copyResult;
	}

	return Result.ok(undefined);
}

/**
 * Registers the init command with the CLI program.
 *
 * @param program - Commander program instance
 *
 * @example
 * ```typescript
 * import { Command } from "commander";
 * import { initCommand } from "./commands/init.js";
 *
 * const program = new Command();
 * initCommand(program);
 * ```
 */
export function initCommand(program: Command): void {
	const init = program.command("init").description("Scaffold a new Outfitter project");

	const withCommonOptions = (command: Command): Command =>
		command
			.option("-n, --name <name>", "Project name (defaults to directory name)")
			.option("-b, --bin <name>", "Binary name (defaults to project name)")
			.option("-f, --force", "Overwrite existing files", false);

	withCommonOptions(
		init.argument("[directory]").option("-t, --template <template>", "Template to use", "basic"),
	).action(
		async (
			directory: string | undefined,
			flags: { name?: string; bin?: string; template?: string; force?: boolean },
		) => {
			const targetDir = directory ?? process.cwd();

			const result = await runInit({
				targetDir,
				name: flags.name,
				template: flags.template,
				force: flags.force ?? false,
				...(flags.bin !== undefined ? { bin: flags.bin } : {}),
			});

			if (result.isErr()) {
				// biome-ignore lint/suspicious/noConsole: CLI output is expected
				console.error(`Error: ${result.error.message}`);
				process.exit(1);
			}

			// biome-ignore lint/suspicious/noConsole: CLI output is expected
			console.log(`Project initialized successfully in ${resolve(targetDir)}`);
		},
	);

	withCommonOptions(
		init.command("cli [directory]").description("Scaffold a new CLI project"),
	).action(
		async (
			directory: string | undefined,
			flags: { name?: string; bin?: string; force?: boolean },
		) => {
			const targetDir = directory ?? process.cwd();

			const result = await runInit({
				targetDir,
				name: flags.name,
				template: "cli",
				force: flags.force ?? false,
				...(flags.bin !== undefined ? { bin: flags.bin } : {}),
			});

			if (result.isErr()) {
				// biome-ignore lint/suspicious/noConsole: CLI output is expected
				console.error(`Error: ${result.error.message}`);
				process.exit(1);
			}

			// biome-ignore lint/suspicious/noConsole: CLI output is expected
			console.log(`Project initialized successfully in ${resolve(targetDir)}`);
		},
	);

	withCommonOptions(
		init.command("mcp [directory]").description("Scaffold a new MCP server"),
	).action(
		async (
			directory: string | undefined,
			flags: { name?: string; bin?: string; force?: boolean },
		) => {
			const targetDir = directory ?? process.cwd();

			const result = await runInit({
				targetDir,
				name: flags.name,
				template: "mcp",
				force: flags.force ?? false,
				...(flags.bin !== undefined ? { bin: flags.bin } : {}),
			});

			if (result.isErr()) {
				// biome-ignore lint/suspicious/noConsole: CLI output is expected
				console.error(`Error: ${result.error.message}`);
				process.exit(1);
			}

			// biome-ignore lint/suspicious/noConsole: CLI output is expected
			console.log(`Project initialized successfully in ${resolve(targetDir)}`);
		},
	);

	withCommonOptions(
		init.command("daemon [directory]").description("Scaffold a new daemon project"),
	).action(
		async (
			directory: string | undefined,
			flags: { name?: string; bin?: string; force?: boolean },
		) => {
			const targetDir = directory ?? process.cwd();

			const result = await runInit({
				targetDir,
				name: flags.name,
				template: "daemon",
				force: flags.force ?? false,
				...(flags.bin !== undefined ? { bin: flags.bin } : {}),
			});

			if (result.isErr()) {
				// biome-ignore lint/suspicious/noConsole: CLI output is expected
				console.error(`Error: ${result.error.message}`);
				process.exit(1);
			}

			// biome-ignore lint/suspicious/noConsole: CLI output is expected
			console.log(`Project initialized successfully in ${resolve(targetDir)}`);
		},
	);
}
