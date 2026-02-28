/**
 * Tests for the Commander-to-builder codemod transform.
 *
 * Verifies detection and transformation of .command().action() patterns
 * into .input(schema).action() with generated Zod schema skeletons.
 *
 * @packageDocumentation
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runCodemod } from "../commands/upgrade-codemods.js";

// =============================================================================
// Test Utilities
// =============================================================================

const CODEMOD_PATH = join(
  import.meta.dir,
  "../../../../plugins/outfitter/shared/codemods/cli/commander-to-builder.ts"
);

function createTempDir(): string {
  const tempDir = join(
    tmpdir(),
    `outfitter-builder-codemod-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  mkdirSync(tempDir, { recursive: true });
  return tempDir;
}

function cleanupTempDir(dir: string): void {
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
}

let tempDir: string;
let targetDir: string;

function writeTarget(filename: string, content: string): void {
  const filePath = join(targetDir, filename);
  const dir = filePath.substring(0, filePath.lastIndexOf("/"));
  mkdirSync(dir, { recursive: true });
  writeFileSync(filePath, content);
}

function readTarget(filename: string): string {
  return readFileSync(join(targetDir, filename), "utf-8");
}

beforeEach(() => {
  tempDir = createTempDir();
  targetDir = join(tempDir, "src");
  mkdirSync(targetDir, { recursive: true });
});

afterEach(() => {
  cleanupTempDir(tempDir);
});

// =============================================================================
// Simple .option() → Zod schema generation
// =============================================================================

describe("option detection and schema generation", () => {
  test("transforms string option to z.string()", async () => {
    writeTarget(
      "commands/greet.ts",
      `import { Command } from "commander";

export function createGreetCommand(): Command {
  return new Command("greet")
    .description("Greet someone")
    .option("--name <name>", "Name to greet")
    .action((flags) => {
      console.log(\`Hello \${flags.name}\`);
    });
}
`
    );

    const result = await runCodemod(CODEMOD_PATH, tempDir, false);
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.changedFiles).toContain("src/commands/greet.ts");
    }

    const updated = readTarget("commands/greet.ts");
    expect(updated).toContain("z.object(");
    expect(updated).toContain('name: z.string().describe("Name to greet")');
    expect(updated).toContain('import { z } from "zod"');
  });

  test("transforms boolean flag to z.boolean()", async () => {
    writeTarget(
      "commands/build.ts",
      `import { Command } from "commander";

export function createBuildCommand(): Command {
  return new Command("build")
    .description("Build the project")
    .option("--verbose", "Enable verbose output")
    .action((flags) => {
      if (flags.verbose) console.log("Verbose mode");
    });
}
`
    );

    const result = await runCodemod(CODEMOD_PATH, tempDir, false);
    expect(result.isOk()).toBe(true);

    const updated = readTarget("commands/build.ts");
    expect(updated).toContain("z.object(");
    expect(updated).toContain(
      'verbose: z.boolean().default(false).describe("Enable verbose output")'
    );
  });

  test("transforms negated boolean flag (--no-flag)", async () => {
    writeTarget(
      "commands/deploy.ts",
      `import { Command } from "commander";

export function createDeployCommand(): Command {
  return new Command("deploy")
    .description("Deploy the project")
    .option("--no-cache", "Disable caching")
    .action((flags) => {
      console.log(flags.cache);
    });
}
`
    );

    const result = await runCodemod(CODEMOD_PATH, tempDir, false);
    expect(result.isOk()).toBe(true);

    const updated = readTarget("commands/deploy.ts");
    expect(updated).toContain("z.object(");
    expect(updated).toContain(
      'cache: z.boolean().default(true).describe("Disable caching")'
    );
  });

  test("transforms option with default value", async () => {
    writeTarget(
      "commands/list.ts",
      `import { Command } from "commander";

export function createListCommand(): Command {
  return new Command("list")
    .description("List items")
    .option("--limit <n>", "Max results", "20")
    .action((flags) => {
      console.log(flags.limit);
    });
}
`
    );

    const result = await runCodemod(CODEMOD_PATH, tempDir, false);
    expect(result.isOk()).toBe(true);

    const updated = readTarget("commands/list.ts");
    expect(updated).toContain("z.object(");
    expect(updated).toContain(
      'limit: z.string().default("20").describe("Max results")'
    );
  });

  test("transforms multiple options", async () => {
    writeTarget(
      "commands/search.ts",
      `import { Command } from "commander";

export function createSearchCommand(): Command {
  return new Command("search")
    .description("Search for items")
    .option("--query <q>", "Search query")
    .option("--limit <n>", "Max results", "10")
    .option("--json", "Output as JSON")
    .action((flags) => {
      console.log(flags);
    });
}
`
    );

    const result = await runCodemod(CODEMOD_PATH, tempDir, false);
    expect(result.isOk()).toBe(true);

    const updated = readTarget("commands/search.ts");
    expect(updated).toContain("z.object(");
    expect(updated).toContain('query: z.string().describe("Search query")');
    expect(updated).toContain(
      'limit: z.string().default("10").describe("Max results")'
    );
    expect(updated).toContain(
      'json: z.boolean().default(false).describe("Output as JSON")'
    );
  });

  test("transforms short flag aliases", async () => {
    writeTarget(
      "commands/run.ts",
      `import { Command } from "commander";

export function createRunCommand(): Command {
  return new Command("run")
    .description("Run a task")
    .option("-n, --name <name>", "Task name")
    .option("-v, --verbose", "Verbose output")
    .action((flags) => {
      console.log(flags.name);
    });
}
`
    );

    const result = await runCodemod(CODEMOD_PATH, tempDir, false);
    expect(result.isOk()).toBe(true);

    const updated = readTarget("commands/run.ts");
    expect(updated).toContain('name: z.string().describe("Task name")');
    expect(updated).toContain(
      'verbose: z.boolean().default(false).describe("Verbose output")'
    );
  });
});

// =============================================================================
// Complex patterns — skip with cli.register() fallback
// =============================================================================

describe("complex command detection and skipping", () => {
  test("skips files with multiple .command() calls (nested subcommands)", async () => {
    writeTarget(
      "commands/multi.ts",
      `import { Command } from "commander";

export function createMultiCommand(): Command {
  const program = new Command("multi");
  program.command("sub1").action(() => {});
  program.command("sub2").action(() => {});
  return program;
}
`
    );

    const result = await runCodemod(CODEMOD_PATH, tempDir, false);
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.skippedFiles).toContain("src/commands/multi.ts");
      expect(result.value.changedFiles).not.toContain("src/commands/multi.ts");
    }
  });

  test("skips files already using .input() builder pattern", async () => {
    writeTarget(
      "commands/modern.ts",
      `import { command } from "@outfitter/cli";
import { z } from "zod";

const schema = z.object({ name: z.string() });

export const greet = command("greet")
  .input(schema)
  .action(({ input }) => {
    console.log(input.name);
  });
`
    );

    const result = await runCodemod(CODEMOD_PATH, tempDir, false);
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.changedFiles).not.toContain("src/commands/modern.ts");
      expect(result.value.skippedFiles).toContain("src/commands/modern.ts");
    }
  });

  test("skips files without Commander patterns", async () => {
    writeTarget(
      "commands/utils.ts",
      `export function formatName(name: string): string {
  return name.trim().toLowerCase();
}
`
    );

    const result = await runCodemod(CODEMOD_PATH, tempDir, false);
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.changedFiles).not.toContain("src/commands/utils.ts");
    }
  });
});

// =============================================================================
// Dry run mode
// =============================================================================

describe("dry run", () => {
  test("reports changes without modifying files", async () => {
    const original = `import { Command } from "commander";

export function createGreetCommand(): Command {
  return new Command("greet")
    .description("Greet someone")
    .option("--name <name>", "Name to greet")
    .action((flags) => {
      console.log(flags.name);
    });
}
`;
    writeTarget("commands/greet.ts", original);

    const result = await runCodemod(CODEMOD_PATH, tempDir, true);
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.changedFiles).toContain("src/commands/greet.ts");
    }

    // File should be unchanged
    expect(readTarget("commands/greet.ts")).toBe(original);
  });
});

// =============================================================================
// Edge cases
// =============================================================================

describe("edge cases", () => {
  test("handles empty directories gracefully", async () => {
    // No files in targetDir
    const result = await runCodemod(CODEMOD_PATH, tempDir, false);
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.changedFiles).toHaveLength(0);
      expect(result.value.errors).toHaveLength(0);
    }
  });

  test("handles .requiredOption() calls", async () => {
    writeTarget(
      "commands/init.ts",
      `import { Command } from "commander";

export function createInitCommand(): Command {
  return new Command("init")
    .description("Initialize project")
    .requiredOption("--name <name>", "Project name")
    .option("--force", "Overwrite existing")
    .action((flags) => {
      console.log(flags.name);
    });
}
`
    );

    const result = await runCodemod(CODEMOD_PATH, tempDir, false);
    expect(result.isOk()).toBe(true);

    const updated = readTarget("commands/init.ts");
    expect(updated).toContain("z.object(");
    expect(updated).toContain('name: z.string().describe("Project name")');
    expect(updated).toContain(
      'force: z.boolean().default(false).describe("Overwrite existing")'
    );
  });

  test("adds zod import when not present", async () => {
    writeTarget(
      "commands/simple.ts",
      `import { Command } from "commander";

export function createSimpleCommand(): Command {
  return new Command("simple")
    .description("Simple command")
    .option("--flag", "A flag")
    .action(() => {});
}
`
    );

    const result = await runCodemod(CODEMOD_PATH, tempDir, false);
    expect(result.isOk()).toBe(true);

    const updated = readTarget("commands/simple.ts");
    expect(updated).toContain('import { z } from "zod"');
  });

  test("does not duplicate zod import when already present", async () => {
    writeTarget(
      "commands/with-zod.ts",
      `import { Command } from "commander";
import { z } from "zod";

export function createCmd(): Command {
  return new Command("cmd")
    .description("A command")
    .option("--name <name>", "Name")
    .action(() => {});
}
`
    );

    const result = await runCodemod(CODEMOD_PATH, tempDir, false);
    expect(result.isOk()).toBe(true);

    const updated = readTarget("commands/with-zod.ts");
    const zodImports = updated
      .split("\n")
      .filter((line) => line.includes('from "zod"'));
    expect(zodImports).toHaveLength(1);
  });

  test("handles .argument() declarations with comment", async () => {
    writeTarget(
      "commands/get.ts",
      `import { Command } from "commander";

export function createGetCommand(): Command {
  return new Command("get")
    .description("Get an item")
    .argument("<id>", "Item ID")
    .option("--json", "Output as JSON")
    .action((id, flags) => {
      console.log(id, flags);
    });
}
`
    );

    const result = await runCodemod(CODEMOD_PATH, tempDir, false);
    expect(result.isOk()).toBe(true);

    const updated = readTarget("commands/get.ts");
    // Should still generate schema for the option
    expect(updated).toContain(
      'json: z.boolean().default(false).describe("Output as JSON")'
    );
    // Should add a comment about the positional argument
    expect(updated).toContain("// TODO: positional argument");
  });
});

// =============================================================================
// Report structure
// =============================================================================

describe("result reporting", () => {
  test("reports transformed and skipped files separately", async () => {
    writeTarget(
      "commands/simple.ts",
      `import { Command } from "commander";

export function createSimple(): Command {
  return new Command("simple")
    .option("--name <name>", "Name")
    .action(() => {});
}
`
    );

    writeTarget(
      "commands/complex.ts",
      `import { Command } from "commander";

export function createComplex(): Command {
  const cmd = new Command("complex");
  cmd.command("sub").action(() => {});
  cmd.command("sub2").action(() => {});
  return cmd;
}
`
    );

    writeTarget(
      "commands/utils.ts",
      `export function helper() { return true; }
`
    );

    const result = await runCodemod(CODEMOD_PATH, tempDir, false);
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.changedFiles).toContain("src/commands/simple.ts");
      expect(result.value.skippedFiles).toContain("src/commands/complex.ts");
      expect(result.value.changedFiles).not.toContain("src/commands/utils.ts");
    }
  });
});
