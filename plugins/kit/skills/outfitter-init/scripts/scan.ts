#!/usr/bin/env bun
/**
 * Outfitter Init Scanner & Plan Generator
 *
 * Scans a codebase for Outfitter Stack adoption candidates and generates
 * a structured plan with stage-specific task files.
 *
 * Usage:
 *   bun run scan.ts [project-root]
 *
 * Output:
 *   .agents/plans/outfitter-init/
 *   ├── PLAN.md                 # Entry point with navigation
 *   ├── SCAN.md                 # Scan results
 *   └── stages/
 *       ├── overview.md         # Status dashboard
 *       ├── foundation.md       # Dependencies, context, logger
 *       ├── handlers.md         # Handler conversions
 *       ├── errors.md           # Error taxonomy mappings
 *       ├── paths.md            # XDG path migrations
 *       ├── adapters.md         # CLI/MCP transport layers
 *       ├── documents.md        # Documentation updates
 *       └── unknowns.md         # Items requiring review
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

// Constants
const FUNCTION_PROXIMITY_LINES = 50; // How close a throw must be to a function to be associated

// Types
interface ScanResult {
  file: string;
  line: number;
  content: string;
}

interface HandlerInfo {
  name: string;
  file: string;
  line: number;
  signature: string;
  throws: string[];
  priority: "high" | "medium" | "low";
}

interface ErrorClassInfo {
  name: string;
  file: string;
  line: number;
  usageCount: number;
  suggestedMapping: string;
}

interface PathUsage {
  file: string;
  line: number;
  current: string;
  pattern: "homedir" | "tilde" | "hardcoded";
}

interface Unknown {
  id: string;
  title: string;
  file: string;
  line: number;
  priority: "high" | "medium" | "low";
  category: string;
  code: string;
  reason: string;
  options: string[];
}

interface ScanData {
  projectName: string;
  projectType: "greenfield" | "migration" | "partial";
  date: string;
  throws: ScanResult[];
  tryCatch: ScanResult[];
  console: ScanResult[];
  paths: PathUsage[];
  errorClasses: ErrorClassInfo[];
  handlers: HandlerInfo[];
  docs: string[];
  unknowns: Unknown[];
}

// Scanner functions
async function runRg(
  pattern: string,
  options: string[] = []
): Promise<ScanResult[]> {
  try {
    const proc = Bun.spawn(["rg", pattern, "--type", "ts", "-n", ...options], {
      stdout: "pipe",
      stderr: "pipe",
    });

    const output = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;

    // Exit code 1 means no matches (not an error), 2+ means actual error
    if (exitCode > 1) {
      console.error(
        `Warning: rg failed with exit code ${exitCode}. Is ripgrep installed?`
      );
      return [];
    }

    const results: ScanResult[] = [];

    for (const line of output.split("\n").filter(Boolean)) {
      const match = line.match(/^(.+?):(\d+):(.*)$/);
      if (match) {
        results.push({
          file: match[1],
          line: Number.parseInt(match[2], 10),
          content: match[3].trim(),
        });
      }
    }

    return results;
  } catch (error) {
    console.error("Warning: Failed to run rg. Is ripgrep installed?", error);
    return [];
  }
}

async function countMatches(pattern: string): Promise<number> {
  try {
    const proc = Bun.spawn(["rg", pattern, "--type", "ts", "-c"], {
      stdout: "pipe",
      stderr: "pipe",
    });

    const output = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;

    // Exit code 1 means no matches (not an error), 2+ means actual error
    if (exitCode > 1) {
      return 0;
    }

    let total = 0;

    for (const line of output.split("\n").filter(Boolean)) {
      // rg -c outputs "file:count" for multiple files, or just "count" for single file
      const colonIndex = line.lastIndexOf(":");
      if (colonIndex !== -1) {
        // file:count format
        const count = Number.parseInt(line.slice(colonIndex + 1), 10);
        if (!Number.isNaN(count)) total += count;
      } else {
        // just count (single file case)
        const count = Number.parseInt(line, 10);
        if (!Number.isNaN(count)) total += count;
      }
    }

    return total;
  } catch {
    return 0;
  }
}

function scanThrows(): Promise<ScanResult[]> {
  return runRg("throw (new |[a-zA-Z])");
}

function scanTryCatch(): Promise<ScanResult[]> {
  return runRg("(try \\{|catch \\()");
}

function scanConsole(): Promise<ScanResult[]> {
  return runRg("console\\.(log|error|warn|debug|info)");
}

async function scanPaths(): Promise<PathUsage[]> {
  const homedirResults = await runRg("(homedir\\(\\)|os\\.homedir)");
  const tildeResults = await runRg("~/\\.");

  const paths: PathUsage[] = [];

  for (const r of homedirResults) {
    paths.push({
      file: r.file,
      line: r.line,
      current: r.content,
      pattern: "homedir",
    });
  }

  for (const r of tildeResults) {
    paths.push({
      file: r.file,
      line: r.line,
      current: r.content,
      pattern: "tilde",
    });
  }

  return paths;
}

async function scanErrorClasses(): Promise<ErrorClassInfo[]> {
  const results = await runRg("class (\\w+Error) extends Error");
  const classes: ErrorClassInfo[] = [];

  for (const r of results) {
    const match = r.content.match(/class (\w+Error)/);
    if (match) {
      const name = match[1];
      const usages = await countMatches(`new ${name}\\(`);

      classes.push({
        name,
        file: r.file,
        line: r.line,
        usageCount: usages,
        suggestedMapping: suggestErrorMapping(name),
      });
    }
  }

  return classes;
}

function suggestErrorMapping(name: string): string {
  const lower = name.toLowerCase();

  if (lower.includes("notfound") || lower.includes("missing"))
    return "NotFoundError";
  if (
    lower.includes("validation") ||
    lower.includes("invalid") ||
    lower.includes("input")
  )
    return "ValidationError";
  if (
    lower.includes("conflict") ||
    lower.includes("duplicate") ||
    lower.includes("exists")
  )
    return "ConflictError";
  if (lower.includes("permission") || lower.includes("forbidden"))
    return "PermissionError";
  if (lower.includes("timeout")) return "TimeoutError";
  if (lower.includes("ratelimit") || lower.includes("rate"))
    return "RateLimitError";
  if (lower.includes("network") || lower.includes("connection"))
    return "NetworkError";
  if (
    lower.includes("auth") ||
    lower.includes("unauthorized") ||
    lower.includes("unauthenticated")
  )
    return "AuthError";
  if (lower.includes("cancel")) return "CancelledError";

  return "InternalError";
}

function getPriority(throwCount: number): "high" | "medium" | "low" {
  if (throwCount > 3) return "high";
  if (throwCount > 1) return "medium";
  return "low";
}

async function scanHandlers(throws: ScanResult[]): Promise<HandlerInfo[]> {
  const handlers: HandlerInfo[] = [];
  const fileThrows = new Map<string, ScanResult[]>();

  // Group throws by file
  for (const t of throws) {
    const existing = fileThrows.get(t.file) || [];
    existing.push(t);
    fileThrows.set(t.file, existing);
  }

  // Find functions containing throws
  // NOTE: This regex finds common function patterns but may miss:
  // - Arrow functions without const (e.g., assigned to object properties)
  // - Class methods
  // - export default function
  // These limitations are acceptable for audit purposes; manual review catches edge cases.
  for (const [file, fileResults] of fileThrows) {
    const funcResults = await runRg(
      "(async )?(function |const )\\w+.*=.*async|async \\w+\\(",
      [file]
    );

    for (const func of funcResults) {
      const nameMatch = func.content.match(
        /(function |const )(\w+)|async (\w+)\(/
      );
      if (nameMatch) {
        const name = nameMatch[2] || nameMatch[3];
        const nearbyThrows = fileResults.filter(
          (t) => Math.abs(t.line - func.line) < FUNCTION_PROXIMITY_LINES
        );

        if (nearbyThrows.length > 0) {
          handlers.push({
            name,
            file: func.file,
            line: func.line,
            signature: func.content.slice(0, 80),
            throws: nearbyThrows.map((t) => t.content),
            priority: getPriority(nearbyThrows.length),
          });
        }
      }
    }
  }

  return handlers;
}

async function scanDocs(): Promise<string[]> {
  const proc = Bun.spawn(["find", ".", "-name", "*.md", "-type", "f"], {
    stdout: "pipe",
  });
  const output = await new Response(proc.stdout).text();
  return output
    .split("\n")
    .filter(Boolean)
    .filter((f) => !f.includes("node_modules"));
}

function detectProjectType(data: Partial<ScanData>): ScanData["projectType"] {
  const throws = data.throws?.length ?? 0;
  const errorClasses = data.errorClasses?.length ?? 0;

  // Check for existing Result usage
  // If there's significant Result usage alongside throws, it's partial migration
  // This is a synchronous check based on what we already scanned

  if (throws === 0 && errorClasses === 0) {
    return "greenfield";
  }

  return "migration";
}

function identifyUnknowns(data: Partial<ScanData>): Unknown[] {
  const unknowns: Unknown[] = [];
  let id = 1;

  // Complex try-catch (nested or multi-catch)
  const tryCatch = data.tryCatch || [];
  const tryCatchFiles = new Map<string, number>();
  for (const t of tryCatch) {
    tryCatchFiles.set(t.file, (tryCatchFiles.get(t.file) || 0) + 1);
  }

  for (const [file, count] of tryCatchFiles) {
    if (count > 3) {
      unknowns.push({
        id: `U${id++}`,
        title: `Complex try-catch in ${basename(file)}`,
        file,
        line: 0,
        priority: "medium",
        category: "complex-pattern",
        code: `${count} try-catch blocks`,
        reason: "Multiple try-catch blocks may need manual restructuring",
        options: [
          "Convert each to Result-returning helper",
          "Combine into single Result chain",
          "Use wrapAsync for third-party calls",
        ],
      });
    }
  }

  return unknowns;
}

// Template rendering
function render(template: string, data: Record<string, unknown>): string {
  let result = template;

  // Simple variable replacement
  result = result.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const value = data[key];
    if (value === undefined) return `{{${key}}}`;
    return String(value);
  });

  // Handle {{#each}} blocks
  result = result.replace(
    /\{\{#each (\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g,
    (_, key, content) => {
      const items = data[key] as unknown[];
      if (!(items && Array.isArray(items))) return "";
      return items
        .map((item) => render(content, item as Record<string, unknown>))
        .join("");
    }
  );

  return result;
}

// File generation
function generatePlanMd(data: ScanData): string {
  const templatePath = join(dirname(import.meta.path), "../templates/PLAN.md");
  const template = readFileSync(templatePath, "utf-8");

  return render(template, {
    PROJECT_NAME: data.projectName,
    PROJECT_TYPE: data.projectType,
    DATE: data.date,
  });
}

function generateScanReport(data: ScanData): string {
  const templatePath = join(dirname(import.meta.path), "../templates/SCAN.md");
  const template = readFileSync(templatePath, "utf-8");

  return render(template, {
    PROJECT_NAME: data.projectName,
    DATE: data.date,
    THROW_COUNT: data.throws.length,
    THROW_FILES: [...new Set(data.throws.map((t) => t.file))].length,
    TRY_CATCH_COUNT: data.tryCatch.length,
    TRY_CATCH_FILES: [...new Set(data.tryCatch.map((t) => t.file))].length,
    CONSOLE_COUNT: data.console.length,
    CONSOLE_FILES: [...new Set(data.console.map((t) => t.file))].length,
    PATH_COUNT: data.paths.length,
    PATH_FILES: [...new Set(data.paths.map((p) => p.file))].length,
    ERROR_CLASS_COUNT: data.errorClasses.length,
    DOC_COUNT: data.docs.length,
    UNKNOWN_COUNT: data.unknowns.length,
    HANDLER_COUNT: data.handlers.length,
    HANDLER_EFFORT: effortLevel(data.handlers.length),
    ERROR_EFFORT: effortLevel(data.errorClasses.length * 2),
    PATH_EFFORT: effortLevel(data.paths.length),
    ADAPTER_COUNT: 0,
    ADAPTER_EFFORT: "TBD",
    DOC_EFFORT: effortLevel(data.docs.length),
  });
}

function effortLevel(count: number): string {
  if (count === 0) return "None";
  if (count <= 5) return "Low";
  if (count <= 15) return "Medium";
  return "High";
}

function generateStageFile(stage: string, data: ScanData): string {
  // Validate stage to prevent path traversal
  if (!/^[\w-]+\.md$/.test(stage)) {
    return `# ${stage}\n\nInvalid stage name.`;
  }

  const templatePath = join(
    dirname(import.meta.path),
    `../templates/stages/${stage}`
  );

  if (!existsSync(templatePath)) {
    return `# ${stage}\n\nTemplate not found.`;
  }

  const template = readFileSync(templatePath, "utf-8");

  return render(template, {
    PROJECT_NAME: data.projectName,
    DATE: data.date,
    HANDLER_COUNT: data.handlers.length,
    ERROR_CLASS_COUNT: data.errorClasses.length,
    PATH_COUNT: data.paths.length,
    ADAPTER_COUNT: 0,
    DOC_COUNT: data.docs.length,
    UNKNOWN_COUNT: data.unknowns.length,
    HANDLERS: data.handlers,
    ERROR_CLASSES: data.errorClasses,
    PATH_FILES: data.paths,
    DOC_FILES: data.docs.map((f) => ({
      file: f,
      type: "markdown",
      issues: [],
      updates: [],
    })),
    UNKNOWNS: data.unknowns,
    CLI_COMMANDS: [],
    MCP_TOOLS: [],
    FOUNDATION_NOTES: "",
    HANDLER_NOTES: "",
    ERROR_NOTES: "",
    PATH_NOTES: "",
    ADAPTER_NOTES: "",
    DOC_NOTES: "",
    UNKNOWN_NOTES: "",
  });
}

// Main
async function main() {
  const projectRoot = process.argv[2] || process.cwd();
  const projectName = basename(projectRoot);
  const outputDir = join(projectRoot, ".agents", "plans", "outfitter-init");

  console.log(`Scanning ${projectName}...`);

  // Run scans
  const [throws, tryCatch, consoleLog, paths, errorClasses, docs] =
    await Promise.all([
      scanThrows(),
      scanTryCatch(),
      scanConsole(),
      scanPaths(),
      scanErrorClasses(),
      scanDocs(),
    ]);

  const handlers = await scanHandlers(throws);

  // Detect project type
  const projectType = detectProjectType({
    throws,
    errorClasses,
  });

  const data: ScanData = {
    projectName,
    projectType,
    date: new Date().toISOString().split("T")[0],
    throws,
    tryCatch,
    console: consoleLog,
    paths,
    errorClasses,
    handlers,
    docs,
    unknowns: [],
  };

  data.unknowns = identifyUnknowns(data);

  // Print summary
  console.log("\nScan Results:");
  console.log(`  Project Type:   ${projectType}`);
  console.log(`  Exceptions:     ${throws.length}`);
  console.log(`  Try/Catch:      ${tryCatch.length}`);
  console.log(`  Console:        ${consoleLog.length}`);
  console.log(`  Paths:          ${paths.length}`);
  console.log(`  Error Classes:  ${errorClasses.length}`);
  console.log(`  Handlers:       ${handlers.length}`);
  console.log(`  Docs:           ${docs.length}`);
  console.log(`  Unknowns:       ${data.unknowns.length}`);

  // Create output directory
  mkdirSync(join(outputDir, "stages"), { recursive: true });

  // Generate files
  console.log("\nGenerating plan...");

  // Generate PLAN.md entry point
  writeFileSync(join(outputDir, "PLAN.md"), generatePlanMd(data));
  console.log("  Created: PLAN.md");

  // Generate scan report
  writeFileSync(join(outputDir, "SCAN.md"), generateScanReport(data));
  console.log("  Created: SCAN.md");

  // Generate stage files (without numbered prefixes)
  const stages = [
    "overview.md",
    "foundation.md",
    "handlers.md",
    "errors.md",
    "paths.md",
    "adapters.md",
    "documents.md",
    "unknowns.md",
  ];

  for (const stage of stages) {
    const content = generateStageFile(stage, data);
    writeFileSync(join(outputDir, "stages", stage), content);
    console.log(`  Created: stages/${stage}`);
  }

  console.log(`\nPlan created at: ${outputDir}`);
  console.log("\nNext steps:");
  console.log("  1. Review PLAN.md for navigation");
  console.log("  2. Check SCAN.md for scope");
  console.log("  3. Adjust priorities in stages/overview.md");
  console.log(
    "  4. Load kit:outfitter-fieldguide for patterns and templates"
  );
  console.log("  5. Begin adoption with stages/foundation.md");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
