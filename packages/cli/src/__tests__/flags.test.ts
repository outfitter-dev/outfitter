import { describe, expect, it } from "bun:test";
import {
  composePresets,
  createPreset,
  cwdPreset,
  dryRunPreset,
  forcePreset,
  verbosePreset,
} from "../flags.js";

describe("createPreset", () => {
  it("creates a preset with id, options, and resolve", () => {
    const preset = createPreset({
      id: "test",
      options: [{ flags: "--foo", description: "Foo flag" }],
      resolve: (flags) => ({ foo: Boolean(flags["foo"]) }),
    });

    expect(preset.id).toBe("test");
    expect(preset.options).toHaveLength(1);
    expect(preset.options[0]?.flags).toBe("--foo");
    expect(preset.resolve({ foo: true })).toEqual({ foo: true });
    expect(preset.resolve({})).toEqual({ foo: false });
  });

  it("returns a fresh object each call (no shared state)", () => {
    const a = createPreset({
      id: "a",
      options: [],
      resolve: () => ({}),
    });
    const b = createPreset({
      id: "a",
      options: [],
      resolve: () => ({}),
    });
    expect(a).not.toBe(b);
  });
});

describe("built-in presets", () => {
  describe("verbosePreset", () => {
    it("resolves verbose flag as boolean", () => {
      const preset = verbosePreset();
      expect(preset.id).toBe("verbose");
      expect(preset.resolve({ verbose: true })).toEqual({ verbose: true });
      expect(preset.resolve({ verbose: false })).toEqual({ verbose: false });
      expect(preset.resolve({})).toEqual({ verbose: false });
    });

    it("coerces truthy values to boolean", () => {
      const preset = verbosePreset();
      expect(preset.resolve({ verbose: 1 })).toEqual({ verbose: true });
      expect(preset.resolve({ verbose: "yes" })).toEqual({ verbose: true });
    });

    it("defines -v, --verbose option", () => {
      const preset = verbosePreset();
      expect(preset.options).toHaveLength(1);
      expect(preset.options[0]?.flags).toBe("-v, --verbose");
    });

    it("returns fresh instance per call", () => {
      expect(verbosePreset()).not.toBe(verbosePreset());
    });
  });

  describe("cwdPreset", () => {
    it("resolves cwd from flags", () => {
      const preset = cwdPreset();
      expect(preset.id).toBe("cwd");
      expect(preset.resolve({ cwd: "/tmp/test" })).toEqual({
        cwd: "/tmp/test",
      });
    });

    it("defaults to process.cwd() when not provided", () => {
      const preset = cwdPreset();
      const result = preset.resolve({});
      expect(result.cwd).toBe(process.cwd());
    });

    it("defaults to process.cwd() for non-string values", () => {
      const preset = cwdPreset();
      expect(preset.resolve({ cwd: true })).toEqual({ cwd: process.cwd() });
      expect(preset.resolve({ cwd: 42 })).toEqual({ cwd: process.cwd() });
    });

    it("defines --cwd <path> option", () => {
      const preset = cwdPreset();
      expect(preset.options[0]?.flags).toBe("--cwd <path>");
    });
  });

  describe("dryRunPreset", () => {
    it("resolves dryRun from camelCase flag", () => {
      const preset = dryRunPreset();
      expect(preset.id).toBe("dryRun");
      expect(preset.resolve({ dryRun: true })).toEqual({ dryRun: true });
    });

    it("resolves dryRun from kebab-case flag", () => {
      const preset = dryRunPreset();
      expect(preset.resolve({ "dry-run": true })).toEqual({ dryRun: true });
    });

    it("defaults to false when not provided", () => {
      const preset = dryRunPreset();
      expect(preset.resolve({})).toEqual({ dryRun: false });
    });

    it("prefers camelCase over kebab-case", () => {
      const preset = dryRunPreset();
      expect(preset.resolve({ dryRun: true, "dry-run": false })).toEqual({
        dryRun: true,
      });
    });

    it("defines --dry-run option", () => {
      const preset = dryRunPreset();
      expect(preset.options[0]?.flags).toBe("--dry-run");
    });
  });

  describe("forcePreset", () => {
    it("resolves force flag as boolean", () => {
      const preset = forcePreset();
      expect(preset.id).toBe("force");
      expect(preset.resolve({ force: true })).toEqual({ force: true });
      expect(preset.resolve({ force: false })).toEqual({ force: false });
      expect(preset.resolve({})).toEqual({ force: false });
    });

    it("defines -f, --force option", () => {
      const preset = forcePreset();
      expect(preset.options[0]?.flags).toBe("-f, --force");
    });
  });
});

describe("composePresets", () => {
  it("merges options from multiple presets", () => {
    const composed = composePresets(verbosePreset(), forcePreset());
    expect(composed.options).toHaveLength(2);
    expect(composed.options[0]?.flags).toBe("-v, --verbose");
    expect(composed.options[1]?.flags).toBe("-f, --force");
  });

  it("merges resolvers from multiple presets", () => {
    const composed = composePresets(verbosePreset(), forcePreset());
    const result = composed.resolve({ verbose: true, force: false });
    expect(result).toEqual({ verbose: true, force: false });
  });

  it("deduplicates by preset id (first wins)", () => {
    const v1 = createPreset({
      id: "verbose",
      options: [{ flags: "-v, --verbose", description: "First" }],
      resolve: () => ({ verbose: true }),
    });
    const v2 = createPreset({
      id: "verbose",
      options: [{ flags: "-V, --verbose", description: "Second" }],
      resolve: () => ({ verbose: false }),
    });

    const composed = composePresets(v1, v2);
    expect(composed.options).toHaveLength(1);
    expect(composed.options[0]?.description).toBe("First");
    expect(composed.resolve({})).toEqual({ verbose: true });
  });

  it("generates a composite id", () => {
    const composed = composePresets(
      verbosePreset(),
      cwdPreset(),
      forcePreset()
    );
    expect(composed.id).toBe("verbose+cwd+force");
  });

  it("builds a deduplicated composite id when duplicate preset ids are provided", () => {
    const composed = composePresets(
      verbosePreset(),
      cwdPreset(),
      verbosePreset()
    );
    expect(composed.id).toBe("verbose+cwd");
  });

  it("composes all four built-in presets", () => {
    const composed = composePresets(
      verbosePreset(),
      cwdPreset(),
      dryRunPreset(),
      forcePreset()
    );
    expect(composed.options).toHaveLength(4);
    const result = composed.resolve({
      verbose: true,
      cwd: "/tmp",
      dryRun: true,
      force: false,
    });
    expect(result).toEqual({
      verbose: true,
      cwd: "/tmp",
      dryRun: true,
      force: false,
    });
  });

  it("handles empty preset list", () => {
    const composed = composePresets();
    expect(composed.options).toHaveLength(0);
    expect(composed.resolve({})).toEqual({});
  });

  it("handles single preset", () => {
    const composed = composePresets(verbosePreset());
    expect(composed.options).toHaveLength(1);
    expect(composed.resolve({ verbose: true })).toEqual({ verbose: true });
  });

  it("does not reintroduce duplicate options when composing a composed preset", () => {
    const base = composePresets(verbosePreset(), cwdPreset());
    const nested = composePresets(base, verbosePreset());

    expect(nested.options).toHaveLength(2);
    expect(nested.options.map((option) => option.flags)).toEqual([
      "-v, --verbose",
      "--cwd <path>",
    ]);
    expect(nested.id).toBe("verbose+cwd");
  });
});
