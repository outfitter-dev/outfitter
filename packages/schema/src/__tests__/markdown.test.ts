import { describe, expect, it } from "bun:test";
import type { ActionManifest } from "../manifest.js";
import { formatManifestMarkdown } from "../markdown.js";

// =============================================================================
// Test Fixtures
// =============================================================================

function createMinimalManifest(
  overrides?: Partial<ActionManifest>
): ActionManifest {
  return {
    version: "1.0.0",
    generatedAt: "2025-01-15T00:00:00.000Z",
    surfaces: ["mcp"],
    actions: [],
    errors: {
      validation: { exit: 1, http: 400 },
      not_found: { exit: 2, http: 404 },
      conflict: { exit: 3, http: 409 },
      permission: { exit: 4, http: 403 },
      timeout: { exit: 5, http: 504 },
      rate_limit: { exit: 6, http: 429 },
      network: { exit: 7, http: 502 },
      internal: { exit: 8, http: 500 },
      auth: { exit: 9, http: 401 },
      cancelled: { exit: 130, http: 499 },
    },
    outputModes: ["human", "json"],
    ...overrides,
  };
}

function createMcpManifest(): ActionManifest {
  return createMinimalManifest({
    actions: [
      {
        id: "doctor",
        description: "Run environment diagnostics",
        surfaces: ["cli", "mcp"],
        input: {
          type: "object",
          properties: {
            verbose: {
              type: "boolean",
              description: "Show detailed output",
            },
            checks: {
              type: "array",
              items: { type: "string" },
              description: "Specific checks to run",
            },
          },
        },
        mcp: {
          tool: "doctor",
          description: "Run environment diagnostics",
          deferLoading: true,
        },
      },
      {
        id: "status",
        description: "Show project status",
        surfaces: ["mcp"],
        input: {
          type: "object",
          properties: {
            format: {
              type: "string",
              enum: ["brief", "detailed", "json"],
              description: "Output format",
            },
          },
          required: ["format"],
        },
        mcp: {
          tool: "status",
          description: "Show project status",
        },
      },
    ],
  });
}

function createCliManifest(): ActionManifest {
  return createMinimalManifest({
    surfaces: ["cli"],
    actions: [
      {
        id: "doctor",
        description: "Validate environment and dependencies",
        surfaces: ["cli", "mcp"],
        input: {
          type: "object",
          properties: {
            verbose: { type: "boolean" },
          },
        },
        cli: {
          command: "doctor",
          description: "Validate environment and dependencies",
          options: [
            {
              flags: "-v, --verbose",
              description: "Show detailed output",
              defaultValue: false,
            },
          ],
        },
        mcp: {
          tool: "doctor",
          description: "Run environment diagnostics",
          deferLoading: true,
        },
      },
      {
        id: "init",
        description: "Create a new project",
        surfaces: ["cli"],
        input: {
          type: "object",
          properties: {
            directory: { type: "string" },
            name: { type: "string" },
            force: { type: "boolean" },
          },
        },
        cli: {
          group: "init",
          command: "[directory]",
          description: "Create a new Outfitter project",
          aliases: ["i"],
          options: [
            {
              flags: "-n, --name <name>",
              description: "Package name",
            },
            {
              flags: "-f, --force",
              description: "Overwrite existing files",
              defaultValue: false,
            },
          ],
        },
      },
      {
        id: "check",
        description: "Compare local config against registry",
        surfaces: ["cli"],
        input: { type: "object", properties: {} },
        cli: {
          command: "check",
          description: "Compare local config blocks against registry",
        },
      },
    ],
  });
}

// =============================================================================
// formatManifestMarkdown — MCP surface
// =============================================================================

describe("formatManifestMarkdown", () => {
  it("renders tool name from mcp.tool", () => {
    const manifest = createMcpManifest();
    const output = formatManifestMarkdown(manifest);

    expect(output).toContain("## doctor");
    expect(output).toContain("## status");
  });

  it("falls back to action id when mcp.tool is absent", () => {
    const manifest = createMinimalManifest({
      actions: [
        {
          id: "my-action",
          description: "A test action",
          surfaces: ["mcp"],
          input: { type: "object", properties: {} },
          mcp: {
            description: "A test action",
          },
        },
      ],
    });
    const output = formatManifestMarkdown(manifest);

    expect(output).toContain("## my-action");
  });

  it("renders mcp.description over action.description", () => {
    const manifest = createMinimalManifest({
      actions: [
        {
          id: "tool",
          description: "Generic description",
          surfaces: ["mcp"],
          input: { type: "object", properties: {} },
          mcp: {
            tool: "tool",
            description: "MCP-specific description",
          },
        },
      ],
    });
    const output = formatManifestMarkdown(manifest);

    expect(output).toContain("MCP-specific description");
  });

  it("falls back to action.description when mcp.description absent", () => {
    const manifest = createMinimalManifest({
      actions: [
        {
          id: "tool",
          description: "Fallback description",
          surfaces: ["mcp"],
          input: { type: "object", properties: {} },
          mcp: {
            tool: "tool",
          },
        },
      ],
    });
    const output = formatManifestMarkdown(manifest);

    expect(output).toContain("Fallback description");
  });

  it("renders input schema properties as table", () => {
    const manifest = createMcpManifest();
    const output = formatManifestMarkdown(manifest);

    expect(output).toContain("| Property | Type | Required | Description |");
    expect(output).toContain("`verbose`");
    expect(output).toContain("boolean");
    expect(output).toContain("No");
    expect(output).toContain("Show detailed output");
  });

  it("renders required fields correctly", () => {
    const manifest = createMcpManifest();
    const output = formatManifestMarkdown(manifest);

    // format is required in the status action
    expect(output).toMatch(/`format`.*Yes/);
  });

  it("renders _No parameters_ for empty schema", () => {
    const manifest = createMinimalManifest({
      actions: [
        {
          id: "ping",
          description: "Ping the server",
          surfaces: ["mcp"],
          input: { type: "object", properties: {} },
          mcp: {
            tool: "ping",
            description: "Ping the server",
          },
        },
      ],
    });
    const output = formatManifestMarkdown(manifest);

    expect(output).toContain("_No parameters._");
  });

  it("handles array types", () => {
    const manifest = createMcpManifest();
    const output = formatManifestMarkdown(manifest);

    // checks is array of string
    expect(output).toContain("array of string");
  });

  it("handles enum types", () => {
    const manifest = createMcpManifest();
    const output = formatManifestMarkdown(manifest);

    // format has enum ["brief", "detailed", "json"]
    expect(output).toMatch(/`"brief"`.*`"detailed"`.*`"json"`/);
  });

  it("handles default values", () => {
    const manifest = createMinimalManifest({
      actions: [
        {
          id: "tool",
          surfaces: ["mcp"],
          input: {
            type: "object",
            properties: {
              verbose: {
                type: "boolean",
                default: false,
                description: "Verbose output",
              },
            },
          },
          mcp: { tool: "tool" },
        },
      ],
    });
    const output = formatManifestMarkdown(manifest);

    expect(output).toContain("(default: `false`)");
  });

  it("shows deferred loading annotation when deferLoading: true", () => {
    const manifest = createMcpManifest();
    const output = formatManifestMarkdown(manifest);

    // doctor has deferLoading: true
    expect(output).toContain("Deferred loading");
  });

  it("does not show deferred loading when deferLoading is absent", () => {
    const manifest = createMinimalManifest({
      actions: [
        {
          id: "tool",
          surfaces: ["mcp"],
          input: { type: "object", properties: {} },
          mcp: { tool: "tool", description: "A tool" },
        },
      ],
    });
    const output = formatManifestMarkdown(manifest);

    expect(output).not.toContain("Deferred loading");
  });

  it("generates TOC for 2+ tools", () => {
    const manifest = createMcpManifest();
    const output = formatManifestMarkdown(manifest);

    expect(output).toContain("## Table of Contents");
    expect(output).toContain("- [doctor](#doctor)");
    expect(output).toContain("- [status](#status)");
  });

  it("skips TOC for single tool", () => {
    const manifest = createMinimalManifest({
      actions: [
        {
          id: "tool",
          surfaces: ["mcp"],
          input: { type: "object", properties: {} },
          mcp: { tool: "tool", description: "A tool" },
        },
      ],
    });
    const output = formatManifestMarkdown(manifest);

    expect(output).not.toContain("## Table of Contents");
  });

  it("sorts tools alphabetically", () => {
    const manifest = createMinimalManifest({
      actions: [
        {
          id: "zebra",
          surfaces: ["mcp"],
          input: { type: "object", properties: {} },
          mcp: { tool: "zebra", description: "Z tool" },
        },
        {
          id: "alpha",
          surfaces: ["mcp"],
          input: { type: "object", properties: {} },
          mcp: { tool: "alpha", description: "A tool" },
        },
      ],
    });
    const output = formatManifestMarkdown(manifest);

    const alphaIdx = output.indexOf("## alpha");
    const zebraIdx = output.indexOf("## zebra");
    expect(alphaIdx).toBeLessThan(zebraIdx);
  });

  it("escapes markdown special chars in table cells", () => {
    const manifest = createMinimalManifest({
      actions: [
        {
          id: "tool",
          surfaces: ["mcp"],
          input: {
            type: "object",
            properties: {
              pattern: {
                type: "string",
                description: "Match a|b|c patterns",
              },
            },
          },
          mcp: { tool: "tool", description: "A tool" },
        },
      ],
    });
    const output = formatManifestMarkdown(manifest);

    // Pipes inside table cells must be escaped
    expect(output).toContain("a\\|b\\|c");
  });

  it("handles manifest with no actions gracefully", () => {
    const manifest = createMinimalManifest({ actions: [] });
    const output = formatManifestMarkdown(manifest);

    expect(output).toContain("MCP Tools Reference");
    expect(output).toContain("_No tools registered._");
  });

  it("uses custom title", () => {
    const manifest = createMcpManifest();
    const output = formatManifestMarkdown(manifest, {
      title: "Custom Title",
    });

    expect(output).toContain("# Custom Title");
    expect(output).not.toContain("# MCP Tools Reference");
  });

  it("includes version in header", () => {
    const manifest = createMcpManifest();
    const output = formatManifestMarkdown(manifest);

    expect(output).toContain("v1.0.0");
  });

  it("includes timestamp by default", () => {
    const manifest = createMcpManifest();
    const output = formatManifestMarkdown(manifest);

    expect(output).toContain("2025-01-15");
  });

  it("omits timestamp when timestamp: false", () => {
    const manifest = createMcpManifest();
    const output = formatManifestMarkdown(manifest, { timestamp: false });

    expect(output).not.toContain("2025-01-15");
  });

  it("respects toc: false", () => {
    const manifest = createMcpManifest();
    const output = formatManifestMarkdown(manifest, { toc: false });

    expect(output).not.toContain("## Table of Contents");
  });

  it("handles properties without description", () => {
    const manifest = createMinimalManifest({
      actions: [
        {
          id: "tool",
          surfaces: ["mcp"],
          input: {
            type: "object",
            properties: {
              name: { type: "string" },
            },
            required: ["name"],
          },
          mcp: { tool: "tool", description: "A tool" },
        },
      ],
    });
    const output = formatManifestMarkdown(manifest);

    expect(output).toContain("`name`");
    expect(output).toContain("string");
    expect(output).toContain("Yes");
  });

  it("handles missing input properties (no properties key)", () => {
    const manifest = createMinimalManifest({
      actions: [
        {
          id: "tool",
          surfaces: ["mcp"],
          input: { type: "object" },
          mcp: { tool: "tool", description: "A tool" },
        },
      ],
    });
    const output = formatManifestMarkdown(manifest);

    expect(output).toContain("_No parameters._");
  });

  it("handles oneOf types (discriminated unions)", () => {
    const manifest = createMinimalManifest({
      actions: [
        {
          id: "tool",
          surfaces: ["mcp"],
          input: {
            type: "object",
            properties: {
              value: {
                oneOf: [{ type: "string" }, { type: "number" }],
                description: "A union type",
              },
            },
          },
          mcp: { tool: "tool", description: "A tool" },
        },
      ],
    });
    const output = formatManifestMarkdown(manifest);

    expect(output).toContain("string");
    expect(output).toContain("number");
    expect(output).not.toContain("unknown");
  });

  it("handles anyOf types (nullable/union)", () => {
    const manifest = createMinimalManifest({
      actions: [
        {
          id: "tool",
          surfaces: ["mcp"],
          input: {
            type: "object",
            properties: {
              value: {
                anyOf: [{ type: "string" }, { type: "null" }],
                description: "A nullable string",
              },
            },
          },
          mcp: { tool: "tool", description: "A tool" },
        },
      ],
    });
    const output = formatManifestMarkdown(manifest);

    expect(output).toContain("string");
    expect(output).toContain("null");
    expect(output).not.toContain("unknown");
  });
});

// =============================================================================
// formatManifestMarkdown — CLI surface
// =============================================================================

describe("formatManifestMarkdown (CLI surface)", () => {
  it("uses cli.command as heading (with group prefix)", () => {
    const manifest = createCliManifest();
    const output = formatManifestMarkdown(manifest, { surface: "cli" });

    expect(output).toContain("## init [directory]");
  });

  it("uses cli.command as heading (no group)", () => {
    const manifest = createCliManifest();
    const output = formatManifestMarkdown(manifest, { surface: "cli" });

    expect(output).toContain("## check");
    expect(output).toContain("## doctor");
  });

  it("renders cli.description over action.description", () => {
    const manifest = createCliManifest();
    const output = formatManifestMarkdown(manifest, { surface: "cli" });

    // doctor has different cli vs mcp descriptions
    expect(output).toContain("Validate environment and dependencies");
    expect(output).not.toContain("Run environment diagnostics");
  });

  it("renders CLI options table with flag syntax", () => {
    const manifest = createCliManifest();
    const output = formatManifestMarkdown(manifest, { surface: "cli" });

    expect(output).toContain("| Flag | Description | Default |");
    expect(output).toContain("`-v, --verbose`");
    expect(output).toContain("Show detailed output");
  });

  it("renders default values in CLI options", () => {
    const manifest = createCliManifest();
    const output = formatManifestMarkdown(manifest, { surface: "cli" });

    expect(output).toContain("`false`");
  });

  it("shows dash for options without defaults", () => {
    const manifest = createCliManifest();
    const output = formatManifestMarkdown(manifest, { surface: "cli" });

    // --name has no default
    expect(output).toMatch(/`-n, --name <name>`.*\u2014/);
  });

  it("shows aliases when present", () => {
    const manifest = createCliManifest();
    const output = formatManifestMarkdown(manifest, { surface: "cli" });

    expect(output).toContain("Aliases:");
    expect(output).toContain("`i`");
  });

  it("does not show aliases when absent", () => {
    const manifest = createCliManifest();
    const output = formatManifestMarkdown(manifest, { surface: "cli" });

    // Find the doctor section and check it doesn't have aliases
    const doctorSection = output.split("## doctor")[1]?.split("\n## ")[0] ?? "";
    expect(doctorSection).not.toContain("Aliases:");
  });

  it("does not show deferred loading for CLI surface", () => {
    const manifest = createCliManifest();
    const output = formatManifestMarkdown(manifest, { surface: "cli" });

    // doctor has deferLoading but we're in CLI mode
    expect(output).not.toContain("Deferred loading");
  });

  it("renders _No options_ for commands without options", () => {
    const manifest = createCliManifest();
    const output = formatManifestMarkdown(manifest, { surface: "cli" });

    // check has no options — split on h2 boundary (newline + ##)
    const checkSection = output.split("## check")[1]?.split("\n## ")[0] ?? "";
    expect(checkSection).toContain("_No options._");
  });

  it("sorts commands alphabetically by display name", () => {
    const manifest = createCliManifest();
    const output = formatManifestMarkdown(manifest, { surface: "cli" });

    const checkIdx = output.indexOf("## check");
    const doctorIdx = output.indexOf("## doctor");
    const initIdx = output.indexOf("## init");
    expect(checkIdx).toBeLessThan(doctorIdx);
    expect(doctorIdx).toBeLessThan(initIdx);
  });

  it("generates TOC with CLI command names", () => {
    const manifest = createCliManifest();
    const output = formatManifestMarkdown(manifest, { surface: "cli" });

    expect(output).toContain("## Table of Contents");
    expect(output).toContain("- [check](#check)");
    expect(output).toContain("- [doctor](#doctor)");
    expect(output).toContain("- [init [directory]](#init-directory)");
  });

  it("defaults title based on surface", () => {
    const manifest = createCliManifest();
    const output = formatManifestMarkdown(manifest, { surface: "cli" });

    expect(output).toContain("# CLI Reference");
  });

  it("MCP surface still works as default", () => {
    const manifest = createMcpManifest();
    const output = formatManifestMarkdown(manifest);

    // Default behavior unchanged
    expect(output).toContain("# MCP Tools Reference");
    expect(output).toContain("## doctor");
    expect(output).toContain("| Property | Type | Required | Description |");
  });

  it("filters actions by selected surface", () => {
    const manifest = createMinimalManifest({
      surfaces: ["cli", "mcp"],
      actions: [
        {
          id: "both",
          description: "Available on both surfaces",
          surfaces: ["cli", "mcp"],
          input: { type: "object", properties: {} },
          cli: { command: "both", description: "Both" },
          mcp: { tool: "both", description: "Both" },
        },
        {
          id: "cli-only",
          description: "Only on CLI",
          surfaces: ["cli"],
          input: { type: "object", properties: {} },
          cli: { command: "cli-only", description: "CLI only" },
        },
        {
          id: "mcp-only",
          description: "Only on MCP",
          surfaces: ["mcp"],
          input: { type: "object", properties: {} },
          mcp: { tool: "mcp-only", description: "MCP only" },
        },
      ],
    });

    const cliOutput = formatManifestMarkdown(manifest, { surface: "cli" });
    expect(cliOutput).toContain("## both");
    expect(cliOutput).toContain("## cli-only");
    expect(cliOutput).not.toContain("mcp-only");

    const mcpOutput = formatManifestMarkdown(manifest, { surface: "mcp" });
    expect(mcpOutput).toContain("## both");
    expect(mcpOutput).toContain("## mcp-only");
    expect(mcpOutput).not.toContain("cli-only");
  });
});
