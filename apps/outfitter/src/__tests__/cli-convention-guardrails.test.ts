import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const COMMANDS_DIR = join(import.meta.dir, "..", "commands");

/** Non-command helper modules excluded from guardrail scanning. */
const NON_COMMAND_MODULES = new Set([
  "shared-deps.ts",
  "docs-module-loader.ts",
  "upgrade-codemods.ts",
  "upgrade-planner.ts",
  "upgrade-workspace.ts",
]);

const COMMAND_FILES = readdirSync(COMMANDS_DIR).filter(
  (f) => f.endsWith(".ts") && !NON_COMMAND_MODULES.has(f)
);

const JSON_OPTION_ALLOWLIST = new Set<string>([
  // `repo check` forwards `--json` to @outfitter/tooling subcommands intentionally.
  "repo.ts",
]);

const JSON_ENV_BRIDGE_ALLOWLIST = new Set<string>([]);

function readCommandFile(file: string): string {
  return readFileSync(join(COMMANDS_DIR, file), "utf8");
}

describe("CLI convention guardrails", () => {
  test("blocks ad-hoc per-command --json options outside allowlisted adapters", () => {
    const violations = COMMAND_FILES.filter((file) => {
      if (JSON_OPTION_ALLOWLIST.has(file)) {
        return false;
      }

      const source = readCommandFile(file);
      // Covers .option(), .requiredOption(), and addOption(new Option("--json"))
      return /(?:\.(?:required)?[Oo]ption\([^)]*--json[\s",)]|new\s+Option\([^)]*--json[\s",)])/s.test(
        source
      );
    });

    expect(violations).toEqual([]);
  });

  test("blocks manual OUTFITTER_JSON env bridges in command wiring", () => {
    const violations = COMMAND_FILES.filter((file) => {
      if (JSON_ENV_BRIDGE_ALLOWLIST.has(file)) {
        return false;
      }

      const source = readCommandFile(file);
      return /process\.env(?:\[["']OUTFITTER_JSON["']\]|\.OUTFITTER_JSON\b)/.test(
        source
      );
    });

    expect(violations).toEqual([]);
  });
});
