import { describe, expect, test } from "bun:test";
import { Command } from "commander";
import { doctorCommand } from "../commands/doctor.js";
import { initCommand } from "../commands/init.js";
import { scaffoldCommand } from "../commands/scaffold.js";

function hasJsonOption(command: Command | undefined): boolean {
  if (!command) {
    return false;
  }

  return command.options.some((option) => option.long === "--json");
}

describe("legacy command exports", () => {
  test("registers legacy commands without per-command --json flags", () => {
    const program = new Command();

    doctorCommand(program);
    initCommand(program);
    scaffoldCommand(program);

    const doctor = program.commands.find(
      (command) => command.name() === "doctor"
    );
    const init = program.commands.find((command) => command.name() === "init");
    const scaffold = program.commands.find(
      (command) => command.name() === "scaffold"
    );

    expect(hasJsonOption(doctor)).toBe(false);
    expect(hasJsonOption(init)).toBe(false);
    expect(hasJsonOption(scaffold)).toBe(false);
  });
});
