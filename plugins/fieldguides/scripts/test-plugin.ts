#!/usr/bin/env bun
/**
 * test-plugin.ts
 *
 * Test a Claude Code plugin locally before distribution.
 * Creates a temporary marketplace, adds the plugin, and prints test instructions.
 *
 * Converted from test-plugin.sh — same CLI interface (minus -n/--non-interactive).
 *
 * Exit codes:
 *   0 - Success
 *   1 - Validation or runtime error
 */

import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { printError, printHeader, printInfo, printStep } from "./_shared.ts";
import { validatePlugin } from "./validate-plugin.ts";

// ── CLI Parsing ──────────────────────────────────────────────────────────────

interface Options {
  keep: boolean;
  validate: boolean;
  pluginDir: string;
}

function usage(): never {
  console.log(`Usage: test-plugin.ts [options] <plugin-directory>

Test a Claude Code plugin locally before distribution.

Arguments:
  plugin-directory    Path to plugin root directory

Options:
  -k, --keep          Keep temporary marketplace directory
  -v, --validate      Run validation before testing
  -h, --help          Show this help

Examples:
  # Test current plugin
  test-plugin.ts .

  # Test and keep marketplace
  test-plugin.ts --keep /path/to/my-plugin

  # Validate and test
  test-plugin.ts --validate .

What This Script Does:
  1. Creates a temporary local marketplace
  2. Adds your plugin to the marketplace
  3. Provides instructions for testing
  4. Cleans up temporary files (unless --keep)
`);
  process.exit(0);
}

function parseArgs(argv: string[]): Options {
  const opts: Options = { keep: false, validate: false, pluginDir: "" };

  for (const arg of argv) {
    switch (arg) {
      case "-k":
      case "--keep":
        opts.keep = true;
        break;
      case "-v":
      case "--validate":
        opts.validate = true;
        break;
      case "-h":
      case "--help":
        usage();
        break;
      default:
        if (arg.startsWith("-")) {
          printError(`Unknown option: ${arg}`);
          usage();
        }
        opts.pluginDir = arg;
    }
  }

  return opts;
}

// ── Main ─────────────────────────────────────────────────────────────────────

function main(): void {
  const opts = parseArgs(process.argv.slice(2));

  if (!opts.pluginDir) {
    printError("Plugin directory required");
    usage();
  }

  if (!existsSync(opts.pluginDir)) {
    printError(`Directory not found: ${opts.pluginDir}`);
    process.exit(1);
  }

  const pluginDir = resolve(opts.pluginDir);

  // Check for plugin.json
  const pluginJsonPath = `${pluginDir}/.claude-plugin/plugin.json`;
  if (!existsSync(pluginJsonPath)) {
    printError("Not a valid plugin: .claude-plugin/plugin.json not found");
    process.exit(1);
  }

  // Extract plugin info
  let pluginJson: { name?: string; version?: string };
  try {
    pluginJson = JSON.parse(readFileSync(pluginJsonPath, "utf-8"));
  } catch {
    printError("Failed to parse plugin.json");
    process.exit(1);
  }

  const pluginName = pluginJson.name;
  const pluginVersion = pluginJson.version ?? "unknown";

  if (!pluginName) {
    printError("Plugin name not found in plugin.json");
    process.exit(1);
  }

  // Print header
  printHeader("Claude Code Plugin Testing");
  console.log();
  console.log(`\x1b[0;36mPlugin:\x1b[0m   ${pluginName}`);
  console.log(`\x1b[0;36mVersion:\x1b[0m  ${pluginVersion}`);
  console.log(`\x1b[0;36mPath:\x1b[0m     ${pluginDir}`);
  console.log();

  // Step 1: Optional validation
  if (opts.validate) {
    printStep("Running validation");
    console.log();

    const result = validatePlugin(pluginDir);

    if (!result.valid) {
      printError("Validation failed. Fix errors before testing.");
      process.exit(1);
    }
    console.log();
  }

  // Step 2: Create temporary marketplace
  printStep("Creating test marketplace");

  const testMarketplaceDir = mkdtempSync(
    `${tmpdir()}/claude-test-marketplace.`
  );

  // Register cleanup
  function cleanup(): void {
    if (!opts.keep && existsSync(testMarketplaceDir)) {
      printInfo(`Cleaning up test marketplace: ${testMarketplaceDir}`);
      rmSync(testMarketplaceDir, { recursive: true, force: true });
    }
  }

  process.on("exit", cleanup);
  process.on("SIGINT", () => {
    cleanup();
    process.exit(130);
  });

  printInfo(`Test marketplace: ${testMarketplaceDir}`);

  // Create marketplace structure
  mkdirSync(`${testMarketplaceDir}/.claude-plugin`, { recursive: true });

  const marketplaceJson = {
    name: "test-marketplace",
    version: "1.0.0",
    description: "Temporary test marketplace for plugin development",
    plugins: [
      {
        name: pluginName,
        source: {
          type: "local",
          path: pluginDir,
        },
      },
    ],
  };

  writeFileSync(
    `${testMarketplaceDir}/.claude-plugin/marketplace.json`,
    JSON.stringify(marketplaceJson, null, 2)
  );

  printInfo("Created marketplace configuration");
  console.log();

  // Step 3: Test instructions
  printStep("Test Instructions");
  console.log();
  console.log(
    "\x1b[0;36mTo test your plugin, run these commands in Claude Code:\x1b[0m"
  );
  console.log();
  console.log("\x1b[1;33m1. Add the test marketplace:\x1b[0m");
  console.log(`   /plugin marketplace add ${testMarketplaceDir}`);
  console.log();
  console.log("\x1b[1;33m2. List available plugins:\x1b[0m");
  console.log("   /plugin");
  console.log();
  console.log("\x1b[1;33m3. Install your plugin:\x1b[0m");
  console.log(`   /plugin install ${pluginName}@test-marketplace`);
  console.log();
  console.log("\x1b[1;33m4. Test your plugin components:\x1b[0m");

  // Detect available components
  const hasSkills =
    existsSync(`${pluginDir}/skills`) &&
    [...new Bun.Glob("**/SKILL.md").scanSync({ cwd: `${pluginDir}/skills` })]
      .length > 0;
  const hasCommands =
    existsSync(`${pluginDir}/commands`) &&
    [...new Bun.Glob("**/*.md").scanSync({ cwd: `${pluginDir}/commands` })]
      .length > 0;
  const hasAgents =
    existsSync(`${pluginDir}/agents`) &&
    [...new Bun.Glob("**/*.md").scanSync({ cwd: `${pluginDir}/agents` })]
      .length > 0;
  const hasHooks = existsSync(`${pluginDir}/hooks`);
  const hasMcp = existsSync(`${pluginDir}/servers`);

  if (hasSkills) {
    console.log(
      "   - Skills are auto-activated — mention relevant keywords in prompts"
    );
  }
  if (hasCommands) {
    console.log(
      "   - Test commands by typing slash commands (e.g., /command-name)"
    );
    console.log("   - List commands: /help");
  }
  if (hasAgents) {
    console.log("   - Agents are auto-invoked based on their configuration");
  }
  if (hasHooks) {
    console.log("   - Hooks run automatically on configured events");
    console.log("   - Check settings to verify hooks are registered");
  }
  if (hasMcp) {
    console.log("   - MCP tools should be available automatically");
    console.log("   - Check Claude Code logs if tools don't appear");
  }
  if (!(hasSkills || hasCommands || hasAgents)) {
    console.log("   - Plugin components not detected");
    console.log("   - Ensure your plugin has skills/, commands/, or agents/");
  }

  console.log();
  console.log("\x1b[1;33m5. Verify installation:\x1b[0m");
  console.log(`   /plugin info ${pluginName}`);
  console.log();
  console.log("\x1b[1;33m6. When done testing, uninstall:\x1b[0m");
  console.log(`   /plugin uninstall ${pluginName}`);
  console.log("   /plugin marketplace remove test-marketplace");
  console.log();

  // Step 4: Tips
  printStep("Testing Tips");
  console.log();
  console.log("\x1b[0;36mCommon Issues:\x1b[0m");
  console.log("  - If plugin doesn't appear: Check marketplace.json syntax");
  console.log("  - If skills don't activate: Verify SKILL.md frontmatter");
  console.log("  - If commands fail: Check command syntax and arguments");
  console.log(
    "  - If hooks don't fire: Ensure scripts are executable (chmod +x)"
  );
  console.log(
    "  - If MCP tools missing: Check server configuration in plugin.json"
  );
  console.log();
  console.log("\x1b[0;36mDebugging:\x1b[0m");
  console.log("  - Check Claude Code logs for errors");
  console.log("  - Use /plugin info to see plugin details");
  console.log("  - Verify file paths in plugin.json are correct");
  console.log("  - Test components individually before combining");
  console.log();

  // Step 5: Cleanup info
  if (opts.keep) {
    printInfo("Test marketplace will be preserved at:");
    console.log(`  ${testMarketplaceDir}`);
    console.log();
    printInfo("Remember to clean up manually when done:");
    console.log(`  rm -rf ${testMarketplaceDir}`);
  } else {
    printInfo("Test marketplace will be cleaned up on exit");
  }

  console.log();
  printInfo("Testing session complete!");
}

main();
