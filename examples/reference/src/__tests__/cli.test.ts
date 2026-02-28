/**
 * Tests for the CLI adapter.
 *
 * Verifies: builder pattern, command registration, .destructive(),
 * readOnly/idempotent metadata, .relatedTo() declarations, flag presets.
 */

import { describe, expect, test, beforeEach } from "bun:test";

import type { Command } from "commander";

import { buildCLI } from "../cli.js";
import { seedStore } from "../handlers.js";

// =============================================================================
// Helpers
// =============================================================================

/**
 * Get a registered command from the CLI by name.
 */
function findCommand(program: Command, name: string): Command | undefined {
  return program.commands.find((cmd) => cmd.name() === name);
}

interface CommandWithMeta extends Command {
  __metadata?: { readOnly?: boolean; idempotent?: boolean };
  __relatedTo?: Array<{ target: string; description?: string }>;
}

// =============================================================================
// CLI Structure
// =============================================================================

describe("CLI structure", () => {
  beforeEach(() => seedStore());

  test("builds CLI with all expected commands", () => {
    const cli = buildCLI();
    const program = cli.program;
    const commandNames = program.commands.map((cmd) => cmd.name());
    expect(commandNames).toContain("list");
    expect(commandNames).toContain("create");
    expect(commandNames).toContain("update");
    expect(commandNames).toContain("delete");
    expect(commandNames).toContain("analyze");
  });

  test("list command has expected flags from presets", () => {
    const cli = buildCLI();
    const listCmd = findCommand(cli.program, "list");
    expect(listCmd).toBeDefined();
    const optionFlags = listCmd!.options.map((o) => o.long);
    // outputModePreset adds --output
    expect(optionFlags).toContain("--output");
    // streamPreset adds --stream
    expect(optionFlags).toContain("--stream");
  });

  test("list command has schema-derived flags from .input()", () => {
    const cli = buildCLI();
    const listCmd = findCommand(cli.program, "list");
    expect(listCmd).toBeDefined();
    const optionFlags = listCmd!.options.map((o) => o.long);
    // ListTasksInput fields should be auto-derived
    expect(optionFlags).toContain("--status");
    expect(optionFlags).toContain("--assignee");
    expect(optionFlags).toContain("--limit");
    expect(optionFlags).toContain("--offset");
  });
});

// =============================================================================
// Safety Primitives (v0.6)
// =============================================================================

describe("safety primitives", () => {
  test("delete command has --dry-run from .destructive(true)", () => {
    const cli = buildCLI();
    const deleteCmd = findCommand(cli.program, "delete");
    expect(deleteCmd).toBeDefined();
    const optionFlags = deleteCmd!.options.map((o) => o.long);
    expect(optionFlags).toContain("--dry-run");
  });

  test("list command has readOnly and idempotent metadata", () => {
    const cli = buildCLI();
    const listCmd = findCommand(cli.program, "list") as CommandWithMeta;
    expect(listCmd).toBeDefined();
    expect(listCmd.__metadata?.readOnly).toBe(true);
    expect(listCmd.__metadata?.idempotent).toBe(true);
  });

  test("update command has idempotent metadata", () => {
    const cli = buildCLI();
    const updateCmd = findCommand(cli.program, "update") as CommandWithMeta;
    expect(updateCmd).toBeDefined();
    expect(updateCmd.__metadata?.idempotent).toBe(true);
  });

  test("analyze command has readOnly metadata", () => {
    const cli = buildCLI();
    const analyzeCmd = findCommand(cli.program, "analyze") as CommandWithMeta;
    expect(analyzeCmd).toBeDefined();
    expect(analyzeCmd.__metadata?.readOnly).toBe(true);
  });
});

// =============================================================================
// Action Graph (.relatedTo) (v0.6)
// =============================================================================

describe("action graph (.relatedTo)", () => {
  test("list command declares relationships to create and analyze", () => {
    const cli = buildCLI();
    const listCmd = findCommand(cli.program, "list") as CommandWithMeta;
    expect(listCmd).toBeDefined();
    expect(listCmd.__relatedTo).toBeDefined();
    expect(listCmd.__relatedTo!.length).toBe(2);

    const targets = listCmd.__relatedTo!.map((r) => r.target);
    expect(targets).toContain("create");
    expect(targets).toContain("analyze");
  });

  test("create command declares relationships to list and update", () => {
    const cli = buildCLI();
    const createCmd = findCommand(cli.program, "create") as CommandWithMeta;
    expect(createCmd).toBeDefined();
    expect(createCmd.__relatedTo).toBeDefined();

    const targets = createCmd.__relatedTo!.map((r) => r.target);
    expect(targets).toContain("list");
    expect(targets).toContain("update");
  });

  test("delete command declares relationship to list", () => {
    const cli = buildCLI();
    const deleteCmd = findCommand(cli.program, "delete") as CommandWithMeta;
    expect(deleteCmd).toBeDefined();
    expect(deleteCmd.__relatedTo).toBeDefined();

    const targets = deleteCmd.__relatedTo!.map((r) => r.target);
    expect(targets).toContain("list");
  });

  test("relationships include descriptions", () => {
    const cli = buildCLI();
    const listCmd = findCommand(cli.program, "list") as CommandWithMeta;
    const createRel = listCmd.__relatedTo!.find((r) => r.target === "create");
    expect(createRel?.description).toBe("Create a new task");
  });
});
