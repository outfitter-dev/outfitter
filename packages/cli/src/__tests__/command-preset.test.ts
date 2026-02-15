import { describe, expect, it } from "bun:test";
import { command } from "../command.js";
import { dryRunPreset, forcePreset, verbosePreset } from "../flags.js";

describe("CommandBuilder.preset()", () => {
  it("adds preset options to the command", () => {
    const cmd = command("test").preset(verbosePreset()).build();

    // Commander stores options internally
    const options = cmd.options;
    expect(options.some((o: { long?: string }) => o.long === "--verbose")).toBe(
      true
    );
  });

  it("chains with other builder methods", () => {
    const cmd = command("test")
      .description("Test command")
      .preset(verbosePreset())
      .option("--custom", "Custom flag")
      .preset(forcePreset())
      .build();

    const options = cmd.options;
    expect(options.some((o: { long?: string }) => o.long === "--verbose")).toBe(
      true
    );
    expect(options.some((o: { long?: string }) => o.long === "--force")).toBe(
      true
    );
    expect(options.some((o: { long?: string }) => o.long === "--custom")).toBe(
      true
    );
  });

  it("applies multiple presets", () => {
    const cmd = command("test")
      .preset(verbosePreset())
      .preset(dryRunPreset())
      .preset(forcePreset())
      .build();

    const options = cmd.options;
    expect(options.some((o: { long?: string }) => o.long === "--verbose")).toBe(
      true
    );
    expect(options.some((o: { long?: string }) => o.long === "--dry-run")).toBe(
      true
    );
    expect(options.some((o: { long?: string }) => o.long === "--force")).toBe(
      true
    );
  });

  it("handles required options from presets", () => {
    const requiredPreset = {
      id: "required-test",
      options: [
        {
          flags: "--api-key <key>",
          description: "API key",
          required: true as const,
        },
      ],
      resolve: (flags: Record<string, unknown>) => ({
        apiKey: String(flags["apiKey"] ?? ""),
      }),
    };

    const cmd = command("test").preset(requiredPreset).build();

    const options = cmd.options;
    expect(
      options.some(
        (o: { long?: string; mandatory?: boolean }) =>
          o.long === "--api-key" && o.mandatory === true
      )
    ).toBe(true);
  });
});
