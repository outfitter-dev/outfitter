import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const COMMANDS_DIR = join(import.meta.dir, "..", "commands");
const COMMAND_FILES = [
  "doctor.ts",
  "init.ts",
  "scaffold.ts",
  "migrate-kit.ts",
  "repo.ts",
  "demo.ts",
] as const;

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
      return /\.option\([^)]*--json/.test(source);
    });

    expect(violations).toEqual([]);
  });

  test("blocks manual OUTFITTER_JSON env bridges in command wiring", () => {
    const violations = COMMAND_FILES.filter((file) => {
      if (JSON_ENV_BRIDGE_ALLOWLIST.has(file)) {
        return false;
      }

      const source = readCommandFile(file);
      return source.includes('process.env["OUTFITTER_JSON"]');
    });

    expect(violations).toEqual([]);
  });
});
