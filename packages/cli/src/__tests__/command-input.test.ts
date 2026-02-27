/**
 * Tests for CommandBuilder.input() — Zod-to-Commander auto-derive.
 *
 * @packageDocumentation
 */

import { describe, expect, it } from "bun:test";

import { z } from "zod";

import { command, createCLI } from "../command.js";
import { outputModePreset } from "../query.js";

// =============================================================================
// Schema derivation — basic types
// =============================================================================

describe("CommandBuilder.input()", () => {
  describe("auto-derives Commander flags from Zod schema", () => {
    it("derives a string option from z.string()", async () => {
      const cli = createCLI({ name: "test", version: "0.0.1" });
      let received: unknown;

      cli.register(
        command("run")
          .description("Run")
          .input(z.object({ name: z.string().describe("User name") }))
          .action(async ({ input }) => {
            received = input;
          })
      );

      await cli.parse(["node", "test", "run", "--name", "Alice"]);
      expect(received).toEqual({ name: "Alice" });
    });

    it("derives a number option with coercion from z.number()", async () => {
      const cli = createCLI({ name: "test", version: "0.0.1" });
      let received: unknown;

      cli.register(
        command("run")
          .description("Run")
          .input(z.object({ count: z.number().describe("Item count") }))
          .action(async ({ input }) => {
            received = input;
          })
      );

      await cli.parse(["node", "test", "run", "--count", "42"]);
      expect(received).toEqual({ count: 42 });
    });

    it("derives a boolean flag from z.boolean()", async () => {
      const cli = createCLI({ name: "test", version: "0.0.1" });
      let received: unknown;

      cli.register(
        command("run")
          .description("Run")
          .input(z.object({ verbose: z.boolean().describe("Verbose output") }))
          .action(async ({ input }) => {
            received = input;
          })
      );

      await cli.parse(["node", "test", "run", "--verbose"]);
      expect(received).toEqual({ verbose: true });
    });

    it("derives a choices option from z.enum()", async () => {
      const cli = createCLI({ name: "test", version: "0.0.1" });
      let received: unknown;

      cli.register(
        command("run")
          .description("Run")
          .input(
            z.object({
              format: z.enum(["json", "text"]).describe("Output format"),
            })
          )
          .action(async ({ input }) => {
            received = input;
          })
      );

      await cli.parse(["node", "test", "run", "--format", "json"]);
      expect(received).toEqual({ format: "json" });
    });
  });

  // ===========================================================================
  // Description and defaults
  // ===========================================================================

  describe("description and defaults", () => {
    it("uses .describe() text as option description", () => {
      const cmd = command("run")
        .input(z.object({ name: z.string().describe("The user's full name") }))
        .build();

      const opt = cmd.options.find(
        (o: { long?: string }) => o.long === "--name"
      );
      expect(opt).toBeDefined();
      expect(opt?.description).toBe("The user's full name");
    });

    it("uses .default() value as option default", async () => {
      const cli = createCLI({ name: "test", version: "0.0.1" });
      let received: unknown;

      cli.register(
        command("run")
          .description("Run")
          .input(
            z.object({
              limit: z.number().default(20).describe("Result limit"),
            })
          )
          .action(async ({ input }) => {
            received = input;
          })
      );

      // Don't pass --limit — should use default
      await cli.parse(["node", "test", "run"]);
      expect(received).toEqual({ limit: 20 });
    });

    it("uses string .default() as option default", async () => {
      const cli = createCLI({ name: "test", version: "0.0.1" });
      let received: unknown;

      cli.register(
        command("run")
          .description("Run")
          .input(
            z.object({
              output: z.string().default("stdout").describe("Output target"),
            })
          )
          .action(async ({ input }) => {
            received = input;
          })
      );

      await cli.parse(["node", "test", "run"]);
      expect(received).toEqual({ output: "stdout" });
    });
  });

  // ===========================================================================
  // Optional fields
  // ===========================================================================

  describe("optional fields", () => {
    it("handles optional string fields", async () => {
      const cli = createCLI({ name: "test", version: "0.0.1" });
      let received: unknown;

      cli.register(
        command("run")
          .description("Run")
          .input(
            z.object({
              tag: z.string().optional().describe("Tag name"),
            })
          )
          .action(async ({ input }) => {
            received = input;
          })
      );

      // Don't pass --tag
      await cli.parse(["node", "test", "run"]);
      expect(received).toEqual({});
    });

    it("passes optional field when provided", async () => {
      const cli = createCLI({ name: "test", version: "0.0.1" });
      let received: unknown;

      cli.register(
        command("run")
          .description("Run")
          .input(
            z.object({
              tag: z.string().optional().describe("Tag name"),
            })
          )
          .action(async ({ input }) => {
            received = input;
          })
      );

      await cli.parse(["node", "test", "run", "--tag", "v1"]);
      expect(received).toEqual({ tag: "v1" });
    });
  });

  // ===========================================================================
  // Boolean defaults
  // ===========================================================================

  describe("boolean defaults", () => {
    it("defaults boolean to false when not passed", async () => {
      const cli = createCLI({ name: "test", version: "0.0.1" });
      let received: unknown;

      cli.register(
        command("run")
          .description("Run")
          .input(
            z.object({
              verbose: z.boolean().default(false).describe("Verbose"),
            })
          )
          .action(async ({ input }) => {
            received = input;
          })
      );

      await cli.parse(["node", "test", "run"]);
      expect(received).toEqual({ verbose: false });
    });
  });

  // ===========================================================================
  // Kebab-case conversion
  // ===========================================================================

  describe("camelCase to kebab-case", () => {
    it("converts camelCase field names to kebab-case flags", async () => {
      const cli = createCLI({ name: "test", version: "0.0.1" });
      let received: unknown;

      cli.register(
        command("run")
          .description("Run")
          .input(
            z.object({
              outputDir: z.string().describe("Output directory"),
            })
          )
          .action(async ({ input }) => {
            received = input;
          })
      );

      await cli.parse(["node", "test", "run", "--output-dir", "/tmp"]);
      expect(received).toEqual({ outputDir: "/tmp" });
    });

    it("registers kebab-case long flag on Commander", () => {
      const cmd = command("run")
        .input(
          z.object({
            outputDir: z.string().describe("Output directory"),
          })
        )
        .build();

      const opt = cmd.options.find(
        (o: { long?: string }) => o.long === "--output-dir"
      );
      expect(opt).toBeDefined();
    });
  });

  // ===========================================================================
  // Composition with explicit options
  // ===========================================================================

  describe("explicit declarations compose with .input()", () => {
    it("explicit .option() overrides auto-derived flag for same name", async () => {
      const cli = createCLI({ name: "test", version: "0.0.1" });
      let received: unknown;

      cli.register(
        command("run")
          .description("Run")
          .input(
            z.object({
              format: z.string().describe("Format"),
            })
          )
          // Explicit override with short alias
          .option("-f, --format <fmt>", "Output format (overridden)")
          .action(async ({ input }) => {
            received = input;
          })
      );

      await cli.parse(["node", "test", "run", "-f", "yaml"]);
      expect(received).toEqual({ format: "yaml" });
    });

    it("explicit .option() supplements auto-derived flags", async () => {
      const cli = createCLI({ name: "test", version: "0.0.1" });
      let receivedInput: unknown;
      let receivedFlags: unknown;

      cli.register(
        command("run")
          .description("Run")
          .input(
            z.object({
              name: z.string().describe("Name"),
            })
          )
          .option("--extra", "Extra flag not in schema")
          .action(async ({ input, flags }) => {
            receivedInput = input;
            receivedFlags = flags;
          })
      );

      await cli.parse(["node", "test", "run", "--name", "Alice", "--extra"]);
      expect(receivedInput).toEqual({ name: "Alice" });
      expect(receivedFlags).toHaveProperty("extra", true);
    });

    it("explicit .argument() works alongside .input()", async () => {
      const cli = createCLI({ name: "test", version: "0.0.1" });
      let receivedInput: unknown;
      let receivedArgs: unknown;

      cli.register(
        command("run <target>")
          .description("Run")
          .input(
            z.object({
              verbose: z.boolean().default(false).describe("Verbose"),
            })
          )
          .action(async ({ input, args }) => {
            receivedInput = input;
            receivedArgs = args;
          })
      );

      await cli.parse(["node", "test", "run", "myfile", "--verbose"]);
      expect(receivedInput).toEqual({ verbose: true });
      expect(receivedArgs).toEqual(["myfile"]);
    });
  });

  // ===========================================================================
  // Multi-field schema
  // ===========================================================================

  describe("multi-field schemas", () => {
    it("handles a schema with multiple field types", async () => {
      const cli = createCLI({ name: "test", version: "0.0.1" });
      let received: unknown;

      cli.register(
        command("search")
          .description("Search")
          .input(
            z.object({
              query: z.string().describe("Search query"),
              limit: z.number().default(10).describe("Max results"),
              verbose: z.boolean().default(false).describe("Verbose output"),
              format: z
                .enum(["json", "text"])
                .default("text")
                .describe("Output format"),
            })
          )
          .action(async ({ input }) => {
            received = input;
          })
      );

      await cli.parse([
        "node",
        "test",
        "search",
        "--query",
        "hello",
        "--limit",
        "5",
        "--verbose",
        "--format",
        "json",
      ]);
      expect(received).toEqual({
        query: "hello",
        limit: 5,
        verbose: true,
        format: "json",
      });
    });

    it("applies defaults for omitted fields", async () => {
      const cli = createCLI({ name: "test", version: "0.0.1" });
      let received: unknown;

      cli.register(
        command("search")
          .description("Search")
          .input(
            z.object({
              query: z.string().describe("Search query"),
              limit: z.number().default(10).describe("Max results"),
              verbose: z.boolean().default(false).describe("Verbose output"),
              format: z
                .enum(["json", "text"])
                .default("text")
                .describe("Output format"),
            })
          )
          .action(async ({ input }) => {
            received = input;
          })
      );

      await cli.parse(["node", "test", "search", "--query", "hello"]);
      expect(received).toEqual({
        query: "hello",
        limit: 10,
        verbose: false,
        format: "text",
      });
    });
  });

  // ===========================================================================
  // Validated input via schema
  // ===========================================================================

  describe("schema validation", () => {
    it("validates input through Zod schema", async () => {
      const cli = createCLI({ name: "test", version: "0.0.1" });
      let received: unknown;

      cli.register(
        command("run")
          .description("Run")
          .input(
            z.object({
              count: z.number().default(1).describe("Count"),
            })
          )
          .action(async ({ input }) => {
            received = input;
          })
      );

      await cli.parse(["node", "test", "run", "--count", "7"]);
      // Number coercion: "7" string parsed by Commander argParser → 7 number → passes z.number()
      expect(received).toEqual({ count: 7 });
    });
  });

  // ===========================================================================
  // Chaining
  // ===========================================================================

  describe("chaining", () => {
    it("returns this for fluent chaining", () => {
      const builder = command("run")
        .description("Run")
        .input(z.object({ name: z.string() }))
        .option("--extra", "Extra")
        .action(async () => {});

      // If we get here without error, chaining works
      const cmd = builder.build();
      expect(cmd.name()).toBe("run");
    });
  });

  // ===========================================================================
  // Flags and args still accessible when .input() is used
  // ===========================================================================

  describe("action context", () => {
    it("provides flags, args, and command alongside input", async () => {
      const cli = createCLI({ name: "test", version: "0.0.1" });
      let receivedKeys: string[] = [];

      cli.register(
        command("run")
          .description("Run")
          .input(z.object({ name: z.string().describe("Name") }))
          .action(async (ctx) => {
            receivedKeys = Object.keys(ctx);
          })
      );

      await cli.parse(["node", "test", "run", "--name", "Alice"]);
      expect(receivedKeys).toContain("args");
      expect(receivedKeys).toContain("flags");
      expect(receivedKeys).toContain("command");
      expect(receivedKeys).toContain("input");
    });
  });

  // ===========================================================================
  // Preset composition with .input()
  // ===========================================================================

  describe("preset composition", () => {
    it("preset options compose alongside .input() derived flags", async () => {
      const cli = createCLI({ name: "test", version: "0.0.1" });
      let receivedInput: unknown;
      let receivedFlags: unknown;

      const verbosePreset = {
        id: "verbose",
        options: [
          { flags: "--verbose", description: "Verbose output" },
        ] as const,
        resolve: (flags: Record<string, unknown>) => ({
          verbose: Boolean(flags["verbose"]),
        }),
      };

      cli.register(
        command("run")
          .description("Run")
          .input(z.object({ name: z.string().describe("Name") }))
          .preset(verbosePreset)
          .action(async ({ input, flags }) => {
            receivedInput = input;
            receivedFlags = flags;
          })
      );

      await cli.parse(["node", "test", "run", "--name", "Alice", "--verbose"]);
      expect(receivedInput).toEqual({ name: "Alice" });
      expect(receivedFlags).toHaveProperty("verbose", true);
    });
  });
});
