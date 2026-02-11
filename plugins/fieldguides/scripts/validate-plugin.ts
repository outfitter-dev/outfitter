#!/usr/bin/env bun
/**
 * validate-plugin.ts
 *
 * Comprehensive Claude Code plugin validation.
 * Converted from validate-plugin.sh — same CLI interface, same exit codes.
 *
 * Exit codes:
 *   0 - No errors (may have warnings)
 *   1 - Validation errors found
 *   2 - Invalid arguments or plugin not found
 */

import { chmodSync, existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import {
  extractFrontmatter,
  isAllowedToolsCommaSeparated,
  isDescriptionQuoted,
  type PluginValidationResult,
  printCheck,
  printError,
  printHeader,
  printInfo,
  printSuccess,
  printWarning,
} from "./_shared.ts";

// ── CLI Parsing ──────────────────────────────────────────────────────────────

interface Options {
  strict: boolean;
  quiet: boolean;
  fix: boolean;
  pluginDir: string;
}

function usage(): never {
  console.log(`Usage: validate-plugin.ts [options] <plugin-directory>

Comprehensive validation for Claude Code plugins.

Arguments:
  plugin-directory    Path to plugin root directory

Options:
  -s, --strict        Treat warnings as errors
  -q, --quiet         Only show errors and warnings
  -f, --fix           Auto-fix issues where possible
  -h, --help          Show this help

Examples:
  # Validate current plugin
  validate-plugin.ts .

  # Validate specific plugin
  validate-plugin.ts /path/to/my-plugin

  # Strict validation
  validate-plugin.ts --strict .

  # Auto-fix common issues
  validate-plugin.ts --fix .

Exit Codes:
  0 - No errors
  1 - Validation errors found
  2 - Invalid arguments or plugin not found
`);
  process.exit(2);
}

function parseArgs(argv: string[]): Options {
  const opts: Options = {
    strict: false,
    quiet: false,
    fix: false,
    pluginDir: "",
  };

  for (const arg of argv) {
    switch (arg) {
      case "-s":
      case "--strict":
        opts.strict = true;
        break;
      case "-q":
      case "--quiet":
        opts.quiet = true;
        break;
      case "-f":
      case "--fix":
        opts.fix = true;
        break;
      case "-h":
      case "--help":
        usage();
        break;
      default:
        if (arg.startsWith("-")) {
          console.error(`Error: Unknown option ${arg}`);
          usage();
        }
        opts.pluginDir = arg;
    }
  }

  return opts;
}

// ── Validation Logic ─────────────────────────────────────────────────────────

interface PluginJson {
  name?: string;
  version?: string;
  description?: string;
  author?: { name?: string; email?: string };
  license?: string;
  agents?: string[];
  hooks?: Record<string, unknown>;
  mcpServers?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Runs all 13 validation checks on a plugin directory.
 */
export function validatePlugin(
  pluginDir: string,
  opts: { strict?: boolean; quiet?: boolean; fix?: boolean } = {}
): PluginValidationResult {
  const { quiet = false, fix = false } = opts;

  const result: PluginValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    checks: 0,
  };

  function error(msg: string): void {
    result.errors.push(msg);
    result.valid = false;
    if (!quiet) printError(msg);
  }

  function warn(msg: string): void {
    result.warnings.push(msg);
    if (!quiet) printWarning(msg);
  }

  function info(msg: string): void {
    if (!quiet) printInfo(msg);
  }

  function success(msg: string): void {
    if (!quiet) printSuccess(msg);
  }

  function check(msg: string): void {
    result.checks++;
    if (!quiet) printCheck(result.checks, msg);
  }

  // ── Check 1: plugin.json exists ────────────────────────────────────────
  check("Checking for plugin.json");
  const pluginJsonPath = `${pluginDir}/.claude-plugin/plugin.json`;

  if (!existsSync(pluginJsonPath)) {
    error("plugin.json not found at .claude-plugin/plugin.json");
    return result;
  }
  success("plugin.json exists");

  // ── Check 2: plugin.json is valid JSON ─────────────────────────────────
  check("Validating plugin.json syntax");
  let pluginJson: PluginJson;
  try {
    const raw = readFileSync(pluginJsonPath, "utf-8");
    pluginJson = JSON.parse(raw) as PluginJson;
  } catch (e) {
    error(
      `plugin.json contains invalid JSON: ${e instanceof Error ? e.message : String(e)}`
    );
    return result;
  }
  success("plugin.json is valid JSON");

  // ── Check 3: Required fields ───────────────────────────────────────────
  check("Validating plugin.json required fields");

  if (pluginJson.name) {
    success(`Plugin name: ${pluginJson.name}`);
    if (!/^[a-z][a-z0-9-]*$/.test(pluginJson.name)) {
      error(`Plugin name must be kebab-case: ${pluginJson.name}`);
    }
  } else {
    error("plugin.json missing required field: name");
  }

  if (pluginJson.version) {
    success(`Plugin version: ${pluginJson.version}`);
    if (!/^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.]+)?$/.test(pluginJson.version)) {
      warn("Version should follow semantic versioning (e.g., 1.0.0)");
    }
  } else {
    error("plugin.json missing required field: version");
  }

  if (pluginJson.description) {
    success("Plugin description present");
    const descLen = pluginJson.description.length;
    if (descLen < 20) {
      warn(`Description is very short (${descLen} chars)`);
    } else if (descLen > 200) {
      warn(`Description is very long (${descLen} chars), consider shortening`);
    }
  } else {
    warn("plugin.json missing recommended field: description");
  }

  // ── Check 4: Author info ───────────────────────────────────────────────
  check("Validating author information");

  if (pluginJson.author?.name) {
    success(`Author: ${pluginJson.author.name}`);
  } else {
    warn("plugin.json missing recommended field: author.name");
  }

  if (!pluginJson.author?.email) {
    warn("plugin.json missing recommended field: author.email");
  } else if (
    !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(
      pluginJson.author.email
    )
  ) {
    warn(`Author email appears invalid: ${pluginJson.author.email}`);
  }

  // ── Check 5: License ───────────────────────────────────────────────────
  check("Checking license");

  if (pluginJson.license) {
    success(`License: ${pluginJson.license}`);
    if (
      !(
        existsSync(`${pluginDir}/LICENSE`) ||
        existsSync(`${pluginDir}/LICENSE.md`)
      )
    ) {
      warn("No LICENSE file found in plugin root");
    }
  } else {
    warn("plugin.json missing recommended field: license");
  }

  // ── Check 6: README.md ─────────────────────────────────────────────────
  check("Checking README.md");

  if (existsSync(`${pluginDir}/README.md`)) {
    success("README.md exists");
    const readmeContent = readFileSync(`${pluginDir}/README.md`, "utf-8");
    const readmeLines = readmeContent.split("\n").length;
    if (readmeLines < 10) {
      warn(`README.md is very short (${readmeLines} lines)`);
    }
  } else {
    warn("No README.md found in plugin root");
  }

  // ── Check 7: Validate skills ───────────────────────────────────────────
  check("Validating skills");
  const skillsDir = `${pluginDir}/skills`;

  if (existsSync(skillsDir) && statSync(skillsDir).isDirectory()) {
    const skillFiles = findFiles(skillsDir, "SKILL.md");
    if (skillFiles.length === 0) {
      warn("skills/ directory exists but contains no SKILL.md files");
    } else {
      success(`Found ${skillFiles.length} skill(s)`);

      for (const skillFile of skillFiles) {
        const skillName = skillFile.split("/").at(-2) ?? "unknown";
        info(`Validating skill: ${skillName}`);

        const content = readFileSync(skillFile, "utf-8");
        const { yaml } = extractFrontmatter(content);

        if (yaml === null) {
          warn(`Skill ${skillName} missing frontmatter`);
        } else {
          if (!/^name:/m.test(yaml)) {
            error(`Skill ${skillName} missing 'name' in frontmatter`);
          }
          if (!/^description:/m.test(yaml)) {
            error(`Skill ${skillName} missing 'description' in frontmatter`);
          }
          if (!(/^version:/m.test(yaml) || /^\s+version:/m.test(yaml))) {
            warn(`Skill ${skillName} missing 'version' in frontmatter`);
          }
          if (!isDescriptionQuoted(yaml)) {
            warn(
              `Skill ${skillName} description should be wrapped in double quotes`
            );
          }
          const atCheck = isAllowedToolsCommaSeparated(yaml);
          if (atCheck.present && !atCheck.valid) {
            warn(
              `Skill ${skillName} allowed-tools should use comma separation`
            );
          }
        }

        const skillSize = statSync(skillFile).size;
        if (skillSize < 500) {
          warn(`Skill ${skillName} is very small (${skillSize} bytes)`);
        }
      }
    }
  } else {
    info("No skills/ directory found");
  }

  // ── Check 8: Validate commands ─────────────────────────────────────────
  check("Validating slash commands");
  const commandsDir = `${pluginDir}/commands`;

  if (existsSync(commandsDir) && statSync(commandsDir).isDirectory()) {
    const cmdFiles = findFiles(commandsDir, "*.md");
    if (cmdFiles.length === 0) {
      warn("commands/ directory exists but contains no .md files");
    } else {
      success(`Found ${cmdFiles.length} command(s)`);

      for (const cmdFile of cmdFiles) {
        const cmdName = cmdFile.split("/").pop()?.replace(/\.md$/, "") ?? "";
        info(`Validating command: ${cmdName}`);

        if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(cmdName)) {
          warn(`Command name should be kebab-case: ${cmdName}`);
        }

        const content = readFileSync(cmdFile, "utf-8");
        if (!content.trim()) {
          error(`Command ${cmdName} is empty`);
          continue;
        }

        const { yaml } = extractFrontmatter(content);
        if (yaml !== null) {
          if (/^description:/m.test(yaml)) {
            const descMatch = yaml.match(/^description:\s*(.*)/m);
            if (descMatch && !descMatch[1]?.trim()) {
              warn(`Command ${cmdName} has empty description`);
            }
          }
          if (yaml.includes("\t")) {
            error(`Command ${cmdName} frontmatter contains tabs (use spaces)`);
          }
        }
      }
    }
  } else {
    info("No commands/ directory found");
  }

  // ── Check 9: Validate agents ───────────────────────────────────────────
  check("Validating custom agents");
  const agentsDir = `${pluginDir}/agents`;

  if (existsSync(agentsDir) && statSync(agentsDir).isDirectory()) {
    const agentFiles = findFiles(agentsDir, "*.md");
    if (agentFiles.length === 0) {
      warn("agents/ directory exists but contains no .md files");
    } else {
      success(`Found ${agentFiles.length} agent(s)`);

      const agentsInJson = Array.isArray(pluginJson.agents)
        ? pluginJson.agents.length
        : 0;
      if (agentsInJson === 0) {
        warn("Agents found but not referenced in plugin.json");
      }

      for (const agentFile of agentFiles) {
        const agentName =
          agentFile.split("/").pop()?.replace(/\.md$/, "") ?? "";
        info(`Validating agent: ${agentName}`);

        const content = readFileSync(agentFile, "utf-8");
        const { yaml } = extractFrontmatter(content);

        if (yaml === null) {
          warn(`Agent ${agentName} missing frontmatter`);
        } else {
          if (!/^name:/m.test(yaml)) {
            error(`Agent ${agentName} missing 'name' in frontmatter`);
          }
          if (!/^description:/m.test(yaml)) {
            error(`Agent ${agentName} missing 'description' in frontmatter`);
          }
        }
      }
    }
  } else {
    info("No agents/ directory found");
  }

  // ── Check 10: Validate hooks ───────────────────────────────────────────
  check("Validating event hooks");
  const hooksDir = `${pluginDir}/hooks`;

  if (existsSync(hooksDir) && statSync(hooksDir).isDirectory()) {
    const hookFiles = findAllFiles(hooksDir);
    if (hookFiles.length === 0) {
      warn("hooks/ directory exists but contains no files");
    } else {
      success(`Found ${hookFiles.length} hook file(s)`);

      const hooksInJson =
        pluginJson.hooks && typeof pluginJson.hooks === "object"
          ? Object.keys(pluginJson.hooks).length
          : 0;
      if (hooksInJson === 0) {
        warn("Hook files found but not configured in plugin.json");
      }

      for (const hookFile of hookFiles) {
        const hookName = hookFile.split("/").pop() ?? "";
        info(`Validating hook: ${hookName}`);

        const stat = statSync(hookFile);
        const isExecutable = (stat.mode & 0o111) !== 0;

        if (!isExecutable) {
          if (fix) {
            chmodSync(hookFile, stat.mode | 0o755);
            info(`Fixed: Made ${hookName} executable`);
          } else {
            warn(`Hook ${hookName} is not executable (use chmod +x)`);
          }
        }

        const firstLine = readFileSync(hookFile, "utf-8")
          .split("\n")[0]
          ?.trim();
        if (!firstLine?.startsWith("#!")) {
          warn(`Hook ${hookName} missing shebang line`);
        }
      }
    }
  } else {
    info("No hooks/ directory found");
  }

  // ── Check 11: Validate MCP servers ─────────────────────────────────────
  check("Validating MCP servers");
  const serversDir = `${pluginDir}/servers`;

  if (existsSync(serversDir) && statSync(serversDir).isDirectory()) {
    const serverDirs = listDirectories(serversDir);
    if (serverDirs.length === 0) {
      warn("servers/ directory exists but contains no server directories");
    } else {
      success(`Found ${serverDirs.length} MCP server(s)`);

      const serversInJson =
        pluginJson.mcpServers && typeof pluginJson.mcpServers === "object"
          ? Object.keys(pluginJson.mcpServers).length
          : 0;
      if (serversInJson === 0) {
        warn("MCP servers found but not configured in plugin.json");
      }

      for (const serverDir of serverDirs) {
        const serverName = serverDir.split("/").pop() ?? "";
        info(`Validating MCP server: ${serverName}`);

        if (existsSync(`${serverDir}/server.py`)) {
          success("Found Python server implementation");
          if (!existsSync(`${serverDir}/pyproject.toml`)) {
            warn(`Server ${serverName} missing pyproject.toml`);
          }
        } else if (
          existsSync(`${serverDir}/index.js`) ||
          existsSync(`${serverDir}/index.ts`)
        ) {
          success("Found Node.js server implementation");
          if (!existsSync(`${serverDir}/package.json`)) {
            warn(`Server ${serverName} missing package.json`);
          }
        } else {
          warn(`Server ${serverName} missing server implementation file`);
        }
      }
    }
  } else {
    info("No servers/ directory found");
  }

  // ── Check 12: Common files ─────────────────────────────────────────────
  check("Checking for common files");

  if (existsSync(`${pluginDir}/.gitignore`)) {
    success(".gitignore exists");
  } else {
    warn("No .gitignore found");
  }

  if (existsSync(`${pluginDir}/CHANGELOG.md`)) {
    success("CHANGELOG.md exists");
  } else {
    warn("No CHANGELOG.md found (recommended for versioning)");
  }

  // ── Check 13: Git repository ───────────────────────────────────────────
  check("Checking git repository");

  if (existsSync(`${pluginDir}/.git`)) {
    success("Git repository initialized");
  } else {
    info("Not a git repository");
  }

  return result;
}

// ── File System Helpers ──────────────────────────────────────────────────────

function findFiles(dir: string, pattern: string): string[] {
  const glob = new Bun.Glob(`**/${pattern}`);
  const results: string[] = [];
  for (const match of glob.scanSync({ cwd: dir, absolute: true })) {
    results.push(match);
  }
  return results.sort();
}

function findAllFiles(dir: string): string[] {
  const glob = new Bun.Glob("**/*");
  const results: string[] = [];
  for (const match of glob.scanSync({
    cwd: dir,
    absolute: true,
    onlyFiles: true,
  })) {
    results.push(match);
  }
  return results.sort();
}

function listDirectories(dir: string): string[] {
  const glob = new Bun.Glob("*");
  const results: string[] = [];
  for (const match of glob.scanSync({ cwd: dir, absolute: true })) {
    try {
      if (statSync(match).isDirectory()) {
        results.push(match);
      }
    } catch {
      // skip inaccessible entries
    }
  }
  return results.sort();
}

// ── Summary Output ───────────────────────────────────────────────────────────

function printSummary(result: PluginValidationResult, strict: boolean): void {
  printHeader("Validation Summary");
  console.log();
  console.log(`\x1b[0;36mChecks Performed:\x1b[0m ${result.checks}`);

  if (result.errors.length > 0) {
    console.log(`\x1b[0;31mErrors Found:\x1b[0m     ${result.errors.length}`);
  }

  if (result.warnings.length > 0) {
    console.log(`\x1b[1;33mWarnings Found:\x1b[0m   ${result.warnings.length}`);
  }

  console.log();

  if (strict && result.warnings.length > 0) {
    console.log("\x1b[1;33m(Strict mode: warnings treated as errors)\x1b[0m");
    console.log();
  }

  const totalErrors = strict
    ? result.errors.length + result.warnings.length
    : result.errors.length;

  if (totalErrors === 0 && result.warnings.length === 0) {
    console.log(
      "\x1b[0;32m✓ Validation passed! Plugin is ready to use.\x1b[0m"
    );
  } else if (totalErrors === 0) {
    console.log("\x1b[1;33m⚠ Validation passed with warnings.\x1b[0m");
    console.log(
      "\x1b[1;33m  Consider addressing warnings before distribution.\x1b[0m"
    );
  } else {
    console.log("\x1b[0;31m✗ Validation failed!\x1b[0m");
    console.log(
      "\x1b[0;31m  Please fix errors before using this plugin.\x1b[0m"
    );
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

function main(): void {
  const opts = parseArgs(process.argv.slice(2));

  if (!opts.pluginDir) {
    console.error("Error: Plugin directory required");
    usage();
  }

  if (!(existsSync(opts.pluginDir) && statSync(opts.pluginDir).isDirectory())) {
    console.error(`Error: Directory not found: ${opts.pluginDir}`);
    process.exit(2);
  }

  const pluginDir = resolve(opts.pluginDir);

  if (!opts.quiet) {
    printHeader("Claude Code Plugin Validation");
    console.log();
    console.log(`\x1b[0;36mPlugin Directory:\x1b[0m ${pluginDir}`);
    console.log();
  }

  const result = validatePlugin(pluginDir, {
    strict: opts.strict,
    quiet: opts.quiet,
    fix: opts.fix,
  });

  if (!opts.quiet) {
    console.log();
    printSummary(result, opts.strict);
  }

  const totalErrors = opts.strict
    ? result.errors.length + result.warnings.length
    : result.errors.length;

  process.exit(totalErrors > 0 ? 1 : 0);
}

// Only run main when this is the entry point (not when imported)
if (import.meta.main) {
  main();
}
