#!/usr/bin/env bun
/**
 * init-plugin.ts
 *
 * Non-interactive plugin initialization. Creates a Claude Code plugin directory
 * with scaffolded structure based on CLI flags.
 *
 * Converted from init-plugin.sh — all interactive prompts replaced with
 * CLI flags and sensible defaults.
 *
 * Exit codes:
 *   0 - Success
 *   1 - Error
 *   2 - Invalid arguments
 */

import { chmodSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  printError,
  printHeader,
  printInfo,
  printStep,
  printWarning,
  validateName,
} from "./_shared.ts";

// ── CLI Parsing ──────────────────────────────────────────────────────────────

interface Options {
  pluginName: string;
  directory: string;
  description: string;
  version: string;
  license: string;
  authorName: string;
  authorEmail: string;
  withSkills: boolean;
  withCommands: boolean;
  withAgents: boolean;
  withHooks: boolean;
  withMcp: boolean;
  git: boolean;
  githubActions: boolean;
}

function usage(): never {
  console.log(`Usage: init-plugin.ts [options] <plugin-name>

Initialize a new Claude Code plugin.

Arguments:
  plugin-name           Plugin name (kebab-case)

Options:
  -d, --directory DIR        Target directory (default: .)
  --description TEXT          Plugin description
  --version TEXT              Initial version (default: 0.1.0)
  --license TEXT              License (default: MIT)
  --author-name TEXT          Author name (default: git config)
  --author-email TEXT         Author email (default: git config)
  --with-skills              Include skills scaffold
  --with-commands            Include commands scaffold
  --with-agents              Include agents scaffold
  --with-hooks               Include hooks scaffold
  --with-mcp                 Include MCP server scaffold
  --no-git                   Skip git initialization
  --github-actions           Add GitHub Actions workflow
  -h, --help                 Show this help
`);
  process.exit(2);
}

async function getGitConfig(key: string): Promise<string> {
  try {
    const result = await Bun.$`git config ${key}`.text();
    return result.trim();
  } catch {
    return "";
  }
}

function parseArgs(argv: string[]): Options {
  const opts: Options = {
    pluginName: "",
    directory: ".",
    description: "A Claude Code plugin",
    version: "0.1.0",
    license: "MIT",
    authorName: "",
    authorEmail: "",
    withSkills: false,
    withCommands: false,
    withAgents: false,
    withHooks: false,
    withMcp: false,
    git: true,
    githubActions: false,
  };

  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    switch (arg) {
      case "-d":
      case "--directory":
        opts.directory = argv[++i] ?? ".";
        break;
      case "--description":
        opts.description = argv[++i] ?? opts.description;
        break;
      case "--version":
        opts.version = argv[++i] ?? opts.version;
        break;
      case "--license":
        opts.license = argv[++i] ?? opts.license;
        break;
      case "--author-name":
        opts.authorName = argv[++i] ?? "";
        break;
      case "--author-email":
        opts.authorEmail = argv[++i] ?? "";
        break;
      case "--with-skills":
        opts.withSkills = true;
        break;
      case "--with-commands":
        opts.withCommands = true;
        break;
      case "--with-agents":
        opts.withAgents = true;
        break;
      case "--with-hooks":
        opts.withHooks = true;
        break;
      case "--with-mcp":
        opts.withMcp = true;
        break;
      case "--no-git":
        opts.git = false;
        break;
      case "--github-actions":
        opts.githubActions = true;
        break;
      case "-h":
      case "--help":
        usage();
        break;
      default:
        if (arg?.startsWith("-")) {
          printError(`Unknown option: ${arg}`);
          usage();
        }
        opts.pluginName = arg;
    }
    i++;
  }

  return opts;
}

// ── Templates ────────────────────────────────────────────────────────────────

function pluginJsonTemplate(opts: Options): string {
  const obj: Record<string, unknown> = {
    name: opts.pluginName,
    version: opts.version,
    description: opts.description,
    author: {
      name: opts.authorName,
      email: opts.authorEmail,
    },
    license: opts.license,
    keywords: [],
  };

  if (opts.withAgents) {
    obj.agents = ["./agents/helper.md"];
  }

  if (opts.withMcp) {
    obj.mcpServers = {
      [opts.pluginName]: {
        command: "uv",
        args: [
          "--directory",
          `\${CLAUDE_PLUGIN_ROOT}/servers/${opts.pluginName}-server`,
          "run",
          "server.py",
        ],
      },
    };
  }

  return JSON.stringify(obj, null, 2);
}

function readmeTemplate(opts: Options): string {
  return `# ${opts.pluginName}

${opts.description}

## Installation

\`\`\`bash
# Add marketplace
/plugin marketplace add <path-or-repo>

# Install plugin
/plugin install ${opts.pluginName}@${opts.pluginName}
\`\`\`

## Features

TODO: List your plugin features

## Usage

TODO: Describe how to use your plugin

## Development

TODO: Add development instructions

## License

${opts.license} License - see [LICENSE](LICENSE) for details.
`;
}

function changelogTemplate(opts: Options): string {
  const date = new Date().toISOString().slice(0, 10);
  return `# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [${opts.version}] - ${date}

### Added
- Initial release
`;
}

function mitLicenseTemplate(authorName: string): string {
  const year = new Date().getFullYear();
  return `MIT License

Copyright (c) ${year} ${authorName}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`;
}

const GITIGNORE_TEMPLATE = `# Logs
*.log
logs/

# OS files
.DS_Store
Thumbs.db

# Editor directories
.vscode/
.idea/
*.swp
*.swo
*~

# Environment
.env
.env.local

# Dependencies
node_modules/
__pycache__/
*.pyc
.venv/
venv/
dist/
build/

# Test coverage
coverage/
.coverage
*.cover
`;

function exampleSkillTemplate(): string {
  return `---
name: example-skill
description: "An example skill that demonstrates skill authoring. Use when learning skill development patterns."
metadata:
  version: "0.1.0"
---

# Example Skill

This is an example skill. Skills are automatically activated based on:
- Keywords in the description
- User mentioning the skill name
- Context matching skill capabilities

## What This Skill Does

Describe what this skill helps with.

## When to Use

This skill activates when:
- Condition 1
- Condition 2
- Condition 3

## Quick Start

Provide a quick example of using this skill.

## Detailed Guide

Add comprehensive documentation here.
`;
}

function exampleCommandTemplate(): string {
  return `---
description: "Say hello with a friendly greeting"
---

Generate a friendly greeting for {{0:name}}.

Make the greeting:
- Warm and welcoming
- Include time of day
- Professional yet friendly
`;
}

function exampleAgentTemplate(): string {
  return `---
name: helper
description: "A helpful assistant for common tasks"
---

You are a helpful assistant specialized in [domain].

Your responsibilities:
1. Task 1
2. Task 2
3. Task 3

Guidelines:
- Be clear and concise
- Provide examples
- Explain your reasoning
`;
}

function exampleHookTemplate(): string {
  return `#!/usr/bin/env bash

# Example hook - receives JSON on stdin, outputs JSON to stdout
input=$(cat)

# Parse input
file_path=$(echo "$input" | jq -r '.parameters.file_path // empty')

# Add your logic here
# For PreToolUse hooks, you can approve/block:
# echo '{"allowed": true}'
# echo '{"allowed": false, "reason": "validation failed"}'

# Default: allow the operation
echo '{"allowed": true}'
`;
}

function exampleMcpServerTemplate(pluginName: string): string {
  return `"""MCP server for ${pluginName}"""
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("${pluginName}")

@mcp.tool()
async def example_tool(param: str) -> str:
    """
    Example tool implementation.

    Args:
        param: Parameter description

    Returns:
        Result description
    """
    return f"Processed: {param}"

if __name__ == "__main__":
    mcp.run(transport='stdio')
`;
}

function mcpPyprojectTemplate(pluginName: string, version: string): string {
  return `[project]
name = "${pluginName}-server"
version = "${version}"
description = "MCP server for ${pluginName}"
requires-python = ">=3.10"
dependencies = [
    "mcp>=1.2.0",
]
`;
}

function githubActionsTemplate(): string {
  return `name: Validate Plugin

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Validate plugin.json
        run: |
          if [ ! -f ".claude-plugin/plugin.json" ]; then
            echo "Error: plugin.json not found"
            exit 1
          fi
          python3 -c "import json; json.load(open('.claude-plugin/plugin.json'))"
`;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));

  if (!opts.pluginName) {
    printError("Plugin name required");
    usage();
  }

  // Validate name
  const nameErrors = validateName(opts.pluginName);
  if (nameErrors.length > 0) {
    for (const err of nameErrors) {
      printError(err);
    }
    process.exit(2);
  }

  // Default author from git config
  if (!opts.authorName) {
    opts.authorName = (await getGitConfig("user.name")) || "Author Name";
  }
  if (!opts.authorEmail) {
    opts.authorEmail =
      (await getGitConfig("user.email")) || "author@example.com";
  }

  const pluginPath = resolve(opts.directory, opts.pluginName);

  if (existsSync(pluginPath)) {
    printError(`Directory already exists: ${pluginPath}`);
    process.exit(1);
  }

  // Print header
  printHeader("Claude Code Plugin Initialization");
  console.log();

  // Print summary
  printStep("Creating plugin");
  console.log();
  console.log(`Plugin Name:    ${opts.pluginName}`);
  console.log(`Location:       ${pluginPath}`);
  console.log(`Description:    ${opts.description}`);
  console.log(`Version:        ${opts.version}`);
  console.log(`License:        ${opts.license}`);
  console.log(`Author:         ${opts.authorName} <${opts.authorEmail}>`);
  console.log();

  // Create structure
  printInfo("Creating plugin structure...");

  mkdirSync(`${pluginPath}/.claude-plugin`, { recursive: true });

  // plugin.json
  printInfo("Creating plugin.json");
  writeFileSync(
    `${pluginPath}/.claude-plugin/plugin.json`,
    pluginJsonTemplate(opts)
  );

  // README.md
  printInfo("Creating README.md");
  writeFileSync(`${pluginPath}/README.md`, readmeTemplate(opts));

  // CHANGELOG.md
  printInfo("Creating CHANGELOG.md");
  writeFileSync(`${pluginPath}/CHANGELOG.md`, changelogTemplate(opts));

  // LICENSE
  printInfo("Creating LICENSE");
  if (opts.license === "MIT") {
    writeFileSync(`${pluginPath}/LICENSE`, mitLicenseTemplate(opts.authorName));
  } else {
    writeFileSync(`${pluginPath}/LICENSE`, "");
    printWarning(`Please add ${opts.license} license text to LICENSE file`);
  }

  // .gitignore
  writeFileSync(`${pluginPath}/.gitignore`, GITIGNORE_TEMPLATE);

  // Skills
  if (opts.withSkills) {
    printInfo("Creating skills structure");
    mkdirSync(`${pluginPath}/skills/example-skill`, { recursive: true });
    writeFileSync(
      `${pluginPath}/skills/example-skill/SKILL.md`,
      exampleSkillTemplate()
    );
  }

  // Commands
  if (opts.withCommands) {
    printInfo("Creating commands structure");
    mkdirSync(`${pluginPath}/commands`, { recursive: true });
    writeFileSync(`${pluginPath}/commands/hello.md`, exampleCommandTemplate());
  }

  // Agents
  if (opts.withAgents) {
    printInfo("Creating agents structure");
    mkdirSync(`${pluginPath}/agents`, { recursive: true });
    writeFileSync(`${pluginPath}/agents/helper.md`, exampleAgentTemplate());
  }

  // Hooks
  if (opts.withHooks) {
    printInfo("Creating hooks structure");
    mkdirSync(`${pluginPath}/hooks`, { recursive: true });
    const hookPath = `${pluginPath}/hooks/example-hook.sh`;
    writeFileSync(hookPath, exampleHookTemplate());
    chmodSync(hookPath, 0o755);
  }

  // MCP server
  if (opts.withMcp) {
    printInfo("Creating MCP server structure");
    const serverDir = `${pluginPath}/servers/${opts.pluginName}-server`;
    mkdirSync(serverDir, { recursive: true });
    writeFileSync(
      `${serverDir}/server.py`,
      exampleMcpServerTemplate(opts.pluginName)
    );
    writeFileSync(
      `${serverDir}/pyproject.toml`,
      mcpPyprojectTemplate(opts.pluginName, opts.version)
    );
  }

  // GitHub Actions
  if (opts.githubActions) {
    printInfo("Creating GitHub Actions workflow");
    mkdirSync(`${pluginPath}/.github/workflows`, { recursive: true });
    writeFileSync(
      `${pluginPath}/.github/workflows/validate.yml`,
      githubActionsTemplate()
    );
  }

  // Git init
  if (opts.git) {
    printInfo("Initializing git repository");
    try {
      await Bun.$`git -C ${pluginPath} init -q`;
      await Bun.$`git -C ${pluginPath} add .`;
      await Bun.$`git -C ${pluginPath} commit -q -m ${`feat: initial plugin structure\n\n- Generated with outfitter init-plugin.ts\n- Initialized ${opts.pluginName} v${opts.version}`}`;
    } catch {
      printWarning("Git initialization failed — skipping");
    }
  }

  // Success
  console.log();
  printInfo("Plugin created successfully!");
  console.log();
  console.log(`\x1b[0;34mPlugin Location:\x1b[0m ${pluginPath}`);
  console.log();
  console.log("\x1b[1;33mNext Steps:\x1b[0m");
  console.log(`  1. cd ${pluginPath}`);
  console.log("  2. Edit .claude-plugin/plugin.json to update metadata");
  console.log("  3. Update README.md with plugin details");
  if (opts.withSkills) console.log("  4. Customize skills in skills/");
  if (opts.withCommands) console.log("  4. Add commands to commands/");
  if (opts.withAgents) console.log("  4. Customize agents in agents/");
  if (opts.withHooks) console.log("  4. Implement hooks in hooks/");
  if (opts.withMcp) console.log("  4. Implement MCP server in servers/");
  console.log();
  console.log("\x1b[1;33mTest Locally:\x1b[0m");
  console.log(`  /plugin marketplace add ${pluginPath}`);
  console.log(`  /plugin install ${opts.pluginName}@${opts.pluginName}`);
  console.log();
  printInfo("Happy coding!");
}

main();
