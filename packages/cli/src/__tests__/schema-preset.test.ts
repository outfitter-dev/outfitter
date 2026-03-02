/**
 * Tests for schema-driven presets — .preset() with Zod schema fragments.
 *
 * @packageDocumentation
 */

import { describe, expect, it } from "bun:test";

import { z } from "zod";

import { command, createCLI } from "../command.js";
import { createSchemaPreset } from "../flags.js";

// =============================================================================
// Schema preset creation
// =============================================================================

describe("createSchemaPreset()", () => {
  it("creates a schema preset with id, schema, and resolve", () => {
    const preset = createSchemaPreset({
      id: "output-format",
      schema: z.object({
        format: z
          .enum(["json", "text"])
          .default("text")
          .describe("Output format"),
      }),
      resolve: (flags) => ({
        format: (flags["format"] as string) ?? "text",
      }),
    });

    expect(preset.id).toBe("output-format");
    expect(preset.schema).toBeDefined();
    expect(preset.schema.shape).toBeDefined();
    expect(typeof preset.resolve).toBe("function");
  });

  it("returns a fresh object each call", () => {
    const config = {
      id: "test",
      schema: z.object({ verbose: z.boolean().default(false) }),
      resolve: (flags: Record<string, unknown>) => ({
        verbose: Boolean(flags["verbose"]),
      }),
    };

    const a = createSchemaPreset(config);
    const b = createSchemaPreset(config);
    expect(a).not.toBe(b);
  });
});

// =============================================================================
// .preset() with schema-driven presets
// =============================================================================

describe("CommandBuilder.preset() with schema-driven presets", () => {
  it("accepts a schema preset and derives Commander flags", () => {
    const preset = createSchemaPreset({
      id: "verbosity",
      schema: z.object({
        verbose: z.boolean().default(false).describe("Verbose output"),
      }),
      resolve: (flags) => ({
        verbose: Boolean(flags["verbose"]),
      }),
    });

    const cmd = command("test").preset(preset).build();

    const options = cmd.options;
    expect(options.some((o: { long?: string }) => o.long === "--verbose")).toBe(
      true
    );
  });

  it("derives Commander flags from schema fragment", async () => {
    const preset = createSchemaPreset({
      id: "format",
      schema: z.object({
        format: z
          .enum(["json", "text"])
          .default("text")
          .describe("Output format"),
      }),
      resolve: (flags) => ({
        format: (flags["format"] as string) ?? "text",
      }),
    });

    const cli = createCLI({ name: "test", version: "0.0.1" });
    let receivedFlags: Record<string, unknown> | undefined;

    cli.register(
      command("run")
        .description("Run")
        .preset(preset)
        .action(async ({ flags }) => {
          receivedFlags = flags as Record<string, unknown>;
        })
    );

    await cli.parse(["node", "test", "run", "--format", "json"]);
    expect(receivedFlags?.["format"]).toBe("json");
  });

  it("preset schema merges with .input() schema automatically", async () => {
    const preset = createSchemaPreset({
      id: "verbosity",
      schema: z.object({
        verbose: z.boolean().default(false).describe("Verbose output"),
      }),
      resolve: (flags) => ({
        verbose: Boolean(flags["verbose"]),
      }),
    });

    const cli = createCLI({ name: "test", version: "0.0.1" });
    let receivedInput: unknown;
    let receivedFlags: Record<string, unknown> | undefined;

    cli.register(
      command("run")
        .description("Run")
        .input(z.object({ name: z.string().describe("Name") }))
        .preset(preset)
        .action(async ({ input, flags }) => {
          receivedInput = input;
          receivedFlags = flags as Record<string, unknown>;
        })
    );

    await cli.parse(["node", "test", "run", "--name", "Alice", "--verbose"]);
    // With merged schema, preset resolver values are composed into input
    expect(receivedInput).toEqual({ name: "Alice", verbose: true });
    expect(receivedFlags?.["verbose"]).toBe(true);
  });

  it("multiple schema presets compose correctly", async () => {
    const verbosePreset = createSchemaPreset({
      id: "verbosity",
      schema: z.object({
        verbose: z.boolean().default(false).describe("Verbose output"),
      }),
      resolve: (flags) => ({
        verbose: Boolean(flags["verbose"]),
      }),
    });

    const formatPreset = createSchemaPreset({
      id: "format",
      schema: z.object({
        format: z
          .enum(["json", "text"])
          .default("text")
          .describe("Output format"),
      }),
      resolve: (flags) => ({
        format: (flags["format"] as string) ?? "text",
      }),
    });

    const cli = createCLI({ name: "test", version: "0.0.1" });
    let receivedFlags: Record<string, unknown> | undefined;

    cli.register(
      command("run")
        .description("Run")
        .preset(verbosePreset)
        .preset(formatPreset)
        .action(async ({ flags }) => {
          receivedFlags = flags as Record<string, unknown>;
        })
    );

    await cli.parse(["node", "test", "run", "--verbose", "--format", "json"]);
    expect(receivedFlags?.["verbose"]).toBe(true);
    expect(receivedFlags?.["format"]).toBe("json");
  });

  it("schema preset fields compose with .input() fields (merged schema)", async () => {
    const preset = createSchemaPreset({
      id: "pagination",
      schema: z.object({
        limit: z.number().default(20).describe("Max results"),
        offset: z.number().default(0).describe("Starting offset"),
      }),
      resolve: (flags) => ({
        limit: Number(flags["limit"] ?? 20),
        offset: Number(flags["offset"] ?? 0),
      }),
    });

    const cli = createCLI({ name: "test", version: "0.0.1" });
    let receivedInput: unknown;
    let receivedFlags: Record<string, unknown> | undefined;

    cli.register(
      command("search")
        .description("Search")
        .input(z.object({ query: z.string().describe("Search query") }))
        .preset(preset)
        .action(async ({ input, flags }) => {
          receivedInput = input;
          receivedFlags = flags as Record<string, unknown>;
        })
    );

    await cli.parse([
      "node",
      "test",
      "search",
      "--query",
      "hello",
      "--limit",
      "10",
      "--offset",
      "5",
    ]);
    // With merged schema, preset resolver values are composed into input
    expect(receivedInput).toEqual({ query: "hello", limit: 10, offset: 5 });
    expect(receivedFlags?.["limit"]).toBe(10);
    expect(receivedFlags?.["offset"]).toBe(5);
  });

  it("resolver receives merged flags and returns typed result", () => {
    const preset = createSchemaPreset({
      id: "output",
      schema: z.object({
        format: z.enum(["json", "text"]).default("text").describe("Format"),
        pretty: z.boolean().default(false).describe("Pretty print"),
      }),
      resolve: (flags) => ({
        format: (flags["format"] as string) ?? "text",
        pretty: Boolean(flags["pretty"]),
      }),
    });

    const result = preset.resolve({ format: "json", pretty: true });
    expect(result).toEqual({ format: "json", pretty: true });
  });
});

// =============================================================================
// Backward compatibility
// =============================================================================

describe("backward compatibility with FlagPreset", () => {
  it("existing FlagPreset-based presets still work", async () => {
    const flagPreset = {
      id: "verbose",
      options: [
        {
          flags: "-v, --verbose",
          description: "Verbose output",
          defaultValue: false,
        },
      ] as const,
      resolve: (flags: Record<string, unknown>) => ({
        verbose: Boolean(flags["verbose"]),
      }),
    };

    const cli = createCLI({ name: "test", version: "0.0.1" });
    let receivedFlags: Record<string, unknown> | undefined;

    cli.register(
      command("run")
        .description("Run")
        .preset(flagPreset)
        .action(async ({ flags }) => {
          receivedFlags = flags as Record<string, unknown>;
        })
    );

    await cli.parse(["node", "test", "run", "--verbose"]);
    expect(receivedFlags?.["verbose"]).toBe(true);
  });

  it("FlagPreset and SchemaPreset can be mixed on the same command", async () => {
    const flagPreset = {
      id: "verbose",
      options: [
        {
          flags: "-v, --verbose",
          description: "Verbose output",
          defaultValue: false,
        },
      ] as const,
      resolve: (flags: Record<string, unknown>) => ({
        verbose: Boolean(flags["verbose"]),
      }),
    };

    const schemaPreset = createSchemaPreset({
      id: "format",
      schema: z.object({
        format: z
          .enum(["json", "text"])
          .default("text")
          .describe("Output format"),
      }),
      resolve: (flags) => ({
        format: (flags["format"] as string) ?? "text",
      }),
    });

    const cli = createCLI({ name: "test", version: "0.0.1" });
    let receivedFlags: Record<string, unknown> | undefined;

    cli.register(
      command("run")
        .description("Run")
        .preset(flagPreset)
        .preset(schemaPreset)
        .action(async ({ flags }) => {
          receivedFlags = flags as Record<string, unknown>;
        })
    );

    await cli.parse(["node", "test", "run", "--verbose", "--format", "json"]);
    expect(receivedFlags?.["verbose"]).toBe(true);
    expect(receivedFlags?.["format"]).toBe("json");
  });
});

// =============================================================================
// Edge cases
// =============================================================================

describe("schema preset edge cases", () => {
  it("schema preset flags do not override explicit .option() declarations", async () => {
    const preset = createSchemaPreset({
      id: "format",
      schema: z.object({
        format: z.string().describe("Format"),
      }),
      resolve: (flags) => ({
        format: (flags["format"] as string) ?? "text",
      }),
    });

    const cli = createCLI({ name: "test", version: "0.0.1" });
    let receivedFlags: Record<string, unknown> | undefined;

    cli.register(
      command("run")
        .description("Run")
        // Explicit option with short alias
        .option("-f, --format <fmt>", "Output format (overridden)")
        .preset(preset)
        .action(async ({ flags }) => {
          receivedFlags = flags as Record<string, unknown>;
        })
    );

    await cli.parse(["node", "test", "run", "-f", "yaml"]);
    expect(receivedFlags?.["format"]).toBe("yaml");
  });

  it("schema preset flags do not override .input() schema fields", async () => {
    const preset = createSchemaPreset({
      id: "extra",
      schema: z.object({
        name: z.string().describe("Name from preset"),
      }),
      resolve: (flags) => ({
        name: (flags["name"] as string) ?? "",
      }),
    });

    const cli = createCLI({ name: "test", version: "0.0.1" });
    let receivedInput: unknown;

    cli.register(
      command("run")
        .description("Run")
        .input(z.object({ name: z.string().describe("Name from input") }))
        .preset(preset)
        .action(async ({ input }) => {
          receivedInput = input;
        })
    );

    await cli.parse(["node", "test", "run", "--name", "Alice"]);
    expect(receivedInput).toEqual({ name: "Alice" });
  });

  it("schema preset with enum field adds choices to Commander option", () => {
    const preset = createSchemaPreset({
      id: "output",
      schema: z.object({
        format: z.enum(["json", "text", "yaml"]).describe("Output format"),
      }),
      resolve: (flags) => ({
        format: (flags["format"] as string) ?? "text",
      }),
    });

    const cmd = command("test").preset(preset).build();

    const opt = cmd.options.find(
      (o: { long?: string }) => o.long === "--format"
    );
    expect(opt).toBeDefined();
    // Commander stores argChoices for enum fields
    expect((opt as { argChoices?: string[] })?.argChoices).toEqual([
      "json",
      "text",
      "yaml",
    ]);
  });

  it("schema preset with number field adds coercion", async () => {
    const preset = createSchemaPreset({
      id: "pagination",
      schema: z.object({
        limit: z.number().default(20).describe("Max results"),
      }),
      resolve: (flags) => ({
        limit: Number(flags["limit"] ?? 20),
      }),
    });

    const cli = createCLI({ name: "test", version: "0.0.1" });
    let receivedFlags: Record<string, unknown> | undefined;

    cli.register(
      command("run")
        .description("Run")
        .preset(preset)
        .action(async ({ flags }) => {
          receivedFlags = flags as Record<string, unknown>;
        })
    );

    await cli.parse(["node", "test", "run", "--limit", "50"]);
    // Number coercion from schema-derived flag
    expect(receivedFlags?.["limit"]).toBe(50);
  });
});

// =============================================================================
// Schema preset merge: resolvers executed & values composed into input
// =============================================================================

describe("schema preset merge and resolver execution", () => {
  it("schema preset fields are merged into input validation schema", async () => {
    const preset = createSchemaPreset({
      id: "verbosity",
      schema: z.object({
        verbose: z.boolean().default(false).describe("Verbose output"),
      }),
      resolve: (flags) => ({
        verbose: Boolean(flags["verbose"]),
      }),
    });

    const cli = createCLI({ name: "test", version: "0.0.1" });
    let receivedInput: Record<string, unknown> | undefined;

    cli.register(
      command("run")
        .description("Run")
        .input(z.object({ name: z.string().describe("Name") }))
        .preset(preset)
        .action(async ({ input }) => {
          receivedInput = input as Record<string, unknown>;
        })
    );

    await cli.parse(["node", "test", "run", "--name", "Alice", "--verbose"]);

    // Preset fields should be merged into the validated input via resolver
    expect(receivedInput).toBeDefined();
    expect(receivedInput?.["name"]).toBe("Alice");
    // Resolver-resolved preset value is now composed into input
    expect(receivedInput?.["verbose"]).toBe(true);
  });

  it("schema preset resolvers are executed and values composed into input", async () => {
    const preset = createSchemaPreset({
      id: "pagination",
      schema: z.object({
        limit: z.number().default(20).describe("Max results"),
      }),
      resolve: (flags) => ({
        limit: Number(flags["limit"] ?? 20),
      }),
    });

    const cli = createCLI({ name: "test", version: "0.0.1" });
    let receivedInput: Record<string, unknown> | undefined;

    cli.register(
      command("search")
        .description("Search")
        .input(z.object({ query: z.string().describe("Search query") }))
        .preset(preset)
        .action(async ({ input }) => {
          receivedInput = input as Record<string, unknown>;
        })
    );

    await cli.parse([
      "node",
      "test",
      "search",
      "--query",
      "hello",
      "--limit",
      "10",
    ]);

    // Resolver should have been executed and resolved value merged into input
    expect(receivedInput?.["query"]).toBe("hello");
    expect(receivedInput?.["limit"]).toBe(10);
  });

  it("multiple schema preset resolvers compose into input", async () => {
    const verbosePreset = createSchemaPreset({
      id: "verbosity",
      schema: z.object({
        verbose: z.boolean().default(false).describe("Verbose output"),
      }),
      resolve: (flags) => ({
        verbose: Boolean(flags["verbose"]),
      }),
    });

    const formatPreset = createSchemaPreset({
      id: "format",
      schema: z.object({
        format: z
          .enum(["json", "text"])
          .default("text")
          .describe("Output format"),
      }),
      resolve: (flags) => ({
        format: (flags["format"] as string) ?? "text",
      }),
    });

    const cli = createCLI({ name: "test", version: "0.0.1" });
    let receivedInput: Record<string, unknown> | undefined;

    cli.register(
      command("run")
        .description("Run")
        .input(z.object({ name: z.string().describe("Name") }))
        .preset(verbosePreset)
        .preset(formatPreset)
        .action(async ({ input }) => {
          receivedInput = input as Record<string, unknown>;
        })
    );

    await cli.parse([
      "node",
      "test",
      "run",
      "--name",
      "Alice",
      "--verbose",
      "--format",
      "json",
    ]);

    // All resolved values composed into input
    expect(receivedInput?.["name"]).toBe("Alice");
    expect(receivedInput?.["verbose"]).toBe(true);
    expect(receivedInput?.["format"]).toBe("json");
  });

  it("preset defaults are applied when flags are omitted", async () => {
    const preset = createSchemaPreset({
      id: "verbosity",
      schema: z.object({
        verbose: z.boolean().default(false).describe("Verbose output"),
      }),
      resolve: (flags) => ({
        verbose: Boolean(flags["verbose"]),
      }),
    });

    const cli = createCLI({ name: "test", version: "0.0.1" });
    let receivedInput: Record<string, unknown> | undefined;

    cli.register(
      command("run")
        .description("Run")
        .input(z.object({ name: z.string().describe("Name") }))
        .preset(preset)
        .action(async ({ input }) => {
          receivedInput = input as Record<string, unknown>;
        })
    );

    await cli.parse(["node", "test", "run", "--name", "Bob"]);

    // Preset default (false) should be composed into input via resolver
    expect(receivedInput?.["name"]).toBe("Bob");
    expect(receivedInput?.["verbose"]).toBe(false);
  });
});
