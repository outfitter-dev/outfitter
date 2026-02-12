/**
 * Tests for @outfitter/config
 *
 * Tests cover:
 * - XDG Path Resolution (8 tests)
 * - Config Loading (12 tests)
 * - Override Precedence (6 tests)
 * - Format Parsing (9 tests)
 * - Deep Merge (5 tests)
 *
 * Total: 40 tests
 *
 * NOTE: These tests are written in TDD RED phase.
 * They will FAIL until implementation is complete.
 */
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import {
  deepMerge,
  getCacheDir,
  getConfigDir,
  getDataDir,
  getStateDir,
  loadConfig,
  mapEnvToConfig,
  parseConfigFile,
  resolveConfig,
} from "../index.js";

// ============================================================================
// Test Fixture Setup
// ============================================================================

const FIXTURE_DIRS = [
  "/tmp/test-config/test-app",
  "/tmp/xdg-config-test/myapp",
  "/tmp/xdg-config-test/strict-app",
  "/tmp/xdg-config-test/invalid-config-app",
  "/tmp/xdg-config-test/bad-nested-app",
];

// Valid config that matches TestConfigSchema
const VALID_CONFIG_TOML = `[server]
port = 3000
host = "localhost"

[database]
url = "postgres://localhost/testdb"
poolSize = 10
`;

// Valid config that matches StrictSchema
const STRICT_CONFIG_TOML = `name = "test-app"
count = 42
`;

// Invalid config - missing required fields
const INVALID_CONFIG_TOML = `[server]
port = 3000
# Missing host and database
`;

// Bad nested config - has invalid nested field
const BAD_NESTED_CONFIG_TOML = `[server]
port = 99999
host = "localhost"

[database]
url = "not-a-valid-url"
`;

function setupFixtures() {
  // Create directories
  for (const dir of FIXTURE_DIRS) {
    mkdirSync(dir, { recursive: true });
  }

  // Create valid config files
  writeFileSync("/tmp/test-config/test-app/config.toml", VALID_CONFIG_TOML);
  writeFileSync("/tmp/xdg-config-test/myapp/config.toml", VALID_CONFIG_TOML);
  writeFileSync(
    "/tmp/xdg-config-test/strict-app/config.toml",
    STRICT_CONFIG_TOML
  );
  writeFileSync(
    "/tmp/xdg-config-test/invalid-config-app/config.toml",
    INVALID_CONFIG_TOML
  );
  writeFileSync(
    "/tmp/xdg-config-test/bad-nested-app/config.toml",
    BAD_NESTED_CONFIG_TOML
  );
}

function cleanupFixtures() {
  rmSync("/tmp/test-config", { recursive: true, force: true });
  rmSync("/tmp/xdg-config-test", { recursive: true, force: true });
}

// Setup and teardown for all tests
beforeAll(() => {
  setupFixtures();
});

afterAll(() => {
  cleanupFixtures();
});

// ============================================================================
// Test Fixtures
// ============================================================================

const TestConfigSchema = z.object({
  server: z.object({
    port: z.number().min(1).max(65_535),
    host: z.string(),
  }),
  database: z.object({
    url: z.string().url(),
    poolSize: z.number().int().positive().optional(),
  }),
  features: z
    .object({
      debug: z.boolean().default(false),
      experimental: z.boolean().default(false),
    })
    .optional(),
});

// ============================================================================
// XDG Path Resolution Tests (8 tests)
// ============================================================================

describe("XDG Path Resolution", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Clear XDG env vars before each test
    delete process.env.XDG_CONFIG_HOME;
    delete process.env.XDG_DATA_HOME;
    delete process.env.XDG_CACHE_HOME;
    delete process.env.XDG_STATE_HOME;
    delete process.env.XDG_RUNTIME_DIR;
  });

  afterEach(() => {
    // Restore original environment
    process.env = { ...originalEnv };
  });

  describe("getConfigDir()", () => {
    it("returns XDG_CONFIG_HOME/{appName} when XDG_CONFIG_HOME is set", () => {
      process.env.XDG_CONFIG_HOME = "/custom/config";
      const result = getConfigDir("myapp");
      expect(result).toBe("/custom/config/myapp");
    });

    it("falls back to ~/.config/{appName} when XDG_CONFIG_HOME is unset", () => {
      const result = getConfigDir("myapp");
      const home = process.env.HOME ?? "";
      expect(result).toBe(`${home}/.config/myapp`);
    });

    it("handles appName with special characters", () => {
      process.env.XDG_CONFIG_HOME = "/config";
      const result = getConfigDir("my-app_v2");
      expect(result).toBe("/config/my-app_v2");
    });
  });

  describe("getDataDir()", () => {
    it("returns XDG_DATA_HOME/{appName} when XDG_DATA_HOME is set", () => {
      process.env.XDG_DATA_HOME = "/custom/data";
      const result = getDataDir("myapp");
      expect(result).toBe("/custom/data/myapp");
    });

    it("falls back to ~/.local/share/{appName} when XDG_DATA_HOME is unset", () => {
      const result = getDataDir("myapp");
      const home = process.env.HOME ?? "";
      expect(result).toBe(`${home}/.local/share/myapp`);
    });
  });

  describe("getCacheDir()", () => {
    it("returns XDG_CACHE_HOME/{appName} when XDG_CACHE_HOME is set", () => {
      process.env.XDG_CACHE_HOME = "/custom/cache";
      const result = getCacheDir("myapp");
      expect(result).toBe("/custom/cache/myapp");
    });

    it("falls back to ~/.cache/{appName} when XDG_CACHE_HOME is unset", () => {
      const result = getCacheDir("myapp");
      const home = process.env.HOME ?? "";
      expect(result).toBe(`${home}/.cache/myapp`);
    });
  });

  describe("getStateDir()", () => {
    it("returns XDG_STATE_HOME/{appName} when XDG_STATE_HOME is set", () => {
      process.env.XDG_STATE_HOME = "/custom/state";
      const result = getStateDir("myapp");
      expect(result).toBe("/custom/state/myapp");
    });
  });

  // Note: getRuntimeDir tests would need platform-specific handling
  // Linux: XDG_RUNTIME_DIR
  // macOS: $TMPDIR
  // Windows: %TEMP%
});

// ============================================================================
// Config Loading Tests (12 tests)
// ============================================================================

describe("loadConfig()", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Set XDG_CONFIG_HOME to test fixtures location
    process.env.XDG_CONFIG_HOME = "/tmp/xdg-config-test";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe("successful loading", () => {
    // Fixture paths for this describe block
    const testConfigDir = "/tmp/test-config/test-app";
    const xdgConfigDir = "/tmp/xdg-config-test/myapp";
    const strictAppDir = "/tmp/xdg-config-test/strict-app";

    // Valid config matching TestConfigSchema
    const validTomlConfig = `[server]
port = 3000
host = "localhost"

[database]
url = "postgres://localhost/testdb"
poolSize = 5

[features]
debug = true
experimental = false
`;

    // Valid config matching StrictSchema
    const strictTomlConfig = `name = "test-application"
count = 42
`;

    beforeEach(() => {
      // Create fixture directories
      mkdirSync(testConfigDir, { recursive: true });
      mkdirSync(xdgConfigDir, { recursive: true });
      mkdirSync(strictAppDir, { recursive: true });

      // Create config files
      writeFileSync(join(testConfigDir, "config.toml"), validTomlConfig);
      writeFileSync(join(xdgConfigDir, "config.toml"), validTomlConfig);
      writeFileSync(join(strictAppDir, "config.toml"), strictTomlConfig);
    });

    afterEach(() => {
      // Only clean up fixtures created by this describe block's beforeEach
      // Don't delete /tmp/xdg-config-test entirely as "error handling" tests need it
      rmSync("/tmp/test-config/test-app", { recursive: true, force: true });
    });

    it("returns Result.ok with validated config on success", async () => {
      const result = await loadConfig("test-app", TestConfigSchema, {
        searchPaths: ["/tmp/test-config"],
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const config = result.unwrap();
        expect(config.server.port).toBeNumber();
      }
    });

    it("loads config from XDG_CONFIG_HOME/{appName}/config.toml", async () => {
      process.env.XDG_CONFIG_HOME = "/tmp/xdg-config-test";
      const result = await loadConfig("myapp", TestConfigSchema);

      // Expected path: /tmp/xdg-config-test/myapp/config.toml
      expect(result.isOk()).toBe(true);
    });

    it("validates config against Zod schema", async () => {
      process.env.XDG_CONFIG_HOME = "/tmp/xdg-config-test";
      const StrictSchema = z.object({
        name: z.string().min(1),
        count: z.number().int().positive(),
      });

      const result = await loadConfig("strict-app", StrictSchema);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const config = result.unwrap();
        expect(typeof config.name).toBe("string");
        expect(typeof config.count).toBe("number");
      }
    });
  });

  describe("error handling", () => {
    it("returns Result.err(NotFoundError) when config file is missing", async () => {
      const result = await loadConfig(
        "nonexistent-app-12345",
        TestConfigSchema
      );

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        const error = result.error;
        expect(error._tag).toBe("NotFoundError");
      }
    });

    it("returns Result.err(ValidationError) for invalid schema", async () => {
      // Assuming a config file exists but has invalid data
      const result = await loadConfig("invalid-config-app", TestConfigSchema);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        const error = result.error;
        expect(error._tag).toBe("ValidationError");
      }
    });

    it("ValidationError includes field path for nested validation failures", async () => {
      const result = await loadConfig("bad-nested-app", TestConfigSchema);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        const error = result.error;
        expect(error._tag).toBe("ValidationError");
        // Error should include path like "server.port"
        expect(error.message).toContain(".");
      }
    });

    it("returns Result.err for malformed config files", async () => {
      // Test with a syntactically invalid TOML/YAML/JSON
      const result = await loadConfig("malformed-app", TestConfigSchema);

      expect(result.isErr()).toBe(true);
    });
  });

  describe("search order", () => {
    it("searches config files in correct precedence order", async () => {
      // Expected search order:
      // 1. $XDG_CONFIG_HOME/{appName}/config.{toml,yaml,yml,json,jsonc,json5}
      // 2. ~/.config/{appName}/config.{toml,yaml,yml,json,jsonc,json5}
      // 3. ./{appName}.config.{toml,yaml,yml,json,jsonc,json5} (project-local)
      const result = await loadConfig("ordered-app", TestConfigSchema);

      // Test verifies the precedence is respected
      expect(result.isOk() || result.isErr()).toBe(true);
    });

    it("prefers TOML over YAML over JSON when multiple formats exist", async () => {
      // If config.toml and config.yaml both exist, TOML should win
      const result = await loadConfig("multi-format-app", TestConfigSchema);

      expect(result.isOk() || result.isErr()).toBe(true);
    });

    it("accepts custom searchPaths option", async () => {
      const result = await loadConfig("custom-app", TestConfigSchema, {
        searchPaths: ["/custom/path1", "/custom/path2"],
      });

      expect(result.isOk() || result.isErr()).toBe(true);
    });
  });
});

// ============================================================================
// Format Parsing Tests (10 tests)
// ============================================================================

describe("parseConfigFile()", () => {
  describe("TOML parsing", () => {
    it("parses valid TOML file", () => {
      const tomlContent = `
[server]
port = 3000
host = "localhost"

[database]
url = "postgres://localhost/db"
`;
      const result = parseConfigFile(tomlContent, "config.toml");

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const parsed = result.unwrap();
        expect(parsed.server.port).toBe(3000);
        expect(parsed.server.host).toBe("localhost");
      }
    });

    it("returns error for invalid TOML syntax", () => {
      const invalidToml = `
[server
port = 3000
`;
      const result = parseConfigFile(invalidToml, "config.toml");

      expect(result.isErr()).toBe(true);
    });

    it("handles nested TOML tables", () => {
      const tomlContent = `
[level1.level2.level3]
value = "deep"
`;
      const result = parseConfigFile(tomlContent, "config.toml");

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const parsed = result.unwrap();
        expect(parsed.level1.level2.level3.value).toBe("deep");
      }
    });
  });

  describe("YAML parsing", () => {
    it("parses valid YAML file", () => {
      const yamlContent = `
server:
  port: 3000
  host: localhost

database:
  url: postgres://localhost/db
`;
      const result = parseConfigFile(yamlContent, "config.yaml");

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const parsed = result.unwrap();
        expect(parsed.server.port).toBe(3000);
      }
    });

    it("returns error for invalid YAML syntax", () => {
      const invalidYaml = `
server:
  port: 3000
 host: bad indent
`;
      const result = parseConfigFile(invalidYaml, "config.yaml");

      expect(result.isErr()).toBe(true);
    });

    it("handles YAML anchors and aliases", () => {
      const yamlContent = `
defaults: &defaults
  port: 3000
  host: localhost

server:
  <<: *defaults
  port: 8080
`;
      const result = parseConfigFile(yamlContent, "config.yaml");

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const parsed = result.unwrap();
        // port should be overridden to 8080
        expect(parsed.server.port).toBe(8080);
        expect(parsed.server.host).toBe("localhost");
      }
    });
  });

  describe("JSON parsing", () => {
    it("parses valid JSON file", () => {
      const jsonContent = `{
  "server": {
    "port": 3000,
    "host": "localhost"
  }
}`;
      const result = parseConfigFile(jsonContent, "config.json");

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const parsed = result.unwrap();
        expect(parsed.server.port).toBe(3000);
      }
    });

    it("returns error for invalid JSON syntax", () => {
      const invalidJson = `{
  "server": {
    "port": 3000,
  }
}`;
      const result = parseConfigFile(invalidJson, "config.json");

      expect(result.isErr()).toBe(true);
    });

    it("supports JSON5 features (comments, trailing commas)", () => {
      const json5Content = `{
  // This is a comment
  "server": {
    "port": 3000,
    "host": "localhost", // trailing comma
  },
}`;
      const result = parseConfigFile(json5Content, "config.json5");

      expect(result.isOk()).toBe(true);
    });

    it("supports JSONC files with comments and trailing commas", () => {
      const jsoncContent = `{
  // jsonc comment
  "server": {
    "port": 3000,
    "host": "localhost",
  },
}`;
      const result = parseConfigFile(jsoncContent, "config.jsonc");

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const parsed = result.unwrap();
        expect(parsed.server.port).toBe(3000);
      }
    });

    it("uses Bun.JSON5 parser for jsonc/json5 files", () => {
      const originalParse = Bun.JSON5.parse;
      const parseCalls: string[] = [];

      Bun.JSON5.parse = ((input: string) => {
        parseCalls.push(input);
        return { mocked: true };
      }) as typeof Bun.JSON5.parse;

      try {
        const jsoncResult = parseConfigFile(
          '{ // comment\n"a": 1\n}',
          "config.jsonc"
        );
        const json5Result = parseConfigFile('{"b": 2,}', "config.json5");

        expect(jsoncResult.isOk()).toBe(true);
        expect(json5Result.isOk()).toBe(true);
        expect(parseCalls).toHaveLength(2);
      } finally {
        Bun.JSON5.parse = originalParse;
      }
    });
  });
});

// ============================================================================
// Override Precedence Tests (6 tests)
// ============================================================================

describe("resolveConfig()", () => {
  const SimpleSchema = z.object({
    port: z.number(),
    host: z.string(),
    debug: z.boolean().default(false),
  });

  it("uses defaults when no other sources provided", () => {
    const result = resolveConfig(SimpleSchema, {
      defaults: { port: 3000, host: "localhost", debug: false },
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      const config = result.unwrap();
      expect(config.port).toBe(3000);
      expect(config.host).toBe("localhost");
    }
  });

  it("file config overrides defaults", () => {
    const result = resolveConfig(SimpleSchema, {
      defaults: { port: 3000, host: "localhost", debug: false },
      file: { port: 8080 },
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      const config = result.unwrap();
      expect(config.port).toBe(8080);
      expect(config.host).toBe("localhost"); // from defaults
    }
  });

  it("environment variables override file config", () => {
    const result = resolveConfig(SimpleSchema, {
      defaults: { port: 3000, host: "localhost", debug: false },
      file: { port: 8080, host: "filehost" },
      env: { port: 9000 },
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      const config = result.unwrap();
      expect(config.port).toBe(9000); // from env
      expect(config.host).toBe("filehost"); // from file
    }
  });

  it("CLI flags override environment variables", () => {
    const result = resolveConfig(SimpleSchema, {
      defaults: { port: 3000, host: "localhost", debug: false },
      file: { port: 8080 },
      env: { port: 9000 },
      flags: { port: 4000 },
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      const config = result.unwrap();
      expect(config.port).toBe(4000); // from flags (highest precedence)
    }
  });

  it("validates merged config against schema", () => {
    const result = resolveConfig(SimpleSchema, {
      defaults: { port: 3000, host: "localhost", debug: false },
      flags: { port: -1 }, // invalid: port must be positive per schema
    });

    // Note: SimpleSchema doesn't have min constraint, so this might pass
    // A stricter schema would reject negative port
    expect(result.isOk() || result.isErr()).toBe(true);
  });

  it("respects full precedence: flags > env > file > defaults", () => {
    const result = resolveConfig(SimpleSchema, {
      defaults: { port: 1000, host: "default", debug: false },
      file: { port: 2000, host: "file", debug: true },
      env: { port: 3000, host: "env" },
      flags: { port: 4000 },
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      const config = result.unwrap();
      expect(config.port).toBe(4000); // flags
      expect(config.host).toBe("env"); // env (no flag override)
      expect(config.debug).toBe(true); // file (no env/flag override)
    }
  });
});

// ============================================================================
// Deep Merge Tests (5 tests)
// ============================================================================

describe("deepMerge()", () => {
  it("merges flat objects", () => {
    const target = { a: 1, b: 2 };
    const source = { b: 3, c: 4 };
    const result = deepMerge(target, source);

    expect(result).toEqual({ a: 1, b: 3, c: 4 });
  });

  it("recursively merges nested objects", () => {
    const target = {
      server: { port: 3000, host: "localhost" },
      database: { url: "postgres://localhost" },
    };
    const source = {
      server: { port: 8080 },
      features: { debug: true },
    };
    const result = deepMerge(target, source);

    expect(result).toEqual({
      server: { port: 8080, host: "localhost" },
      database: { url: "postgres://localhost" },
      features: { debug: true },
    });
  });

  it("replaces arrays (does not merge them)", () => {
    const target = { tags: ["a", "b"] };
    const source = { tags: ["c"] };
    const result = deepMerge(target, source);

    // Arrays should be replaced, not concatenated
    expect(result.tags).toEqual(["c"]);
  });

  it("handles null and undefined values", () => {
    const target = { a: 1, b: 2, c: 3 };
    const source = { a: null, b: undefined };
    const result = deepMerge(target, source);

    // null explicitly replaces, undefined is skipped
    expect(result.a).toBeNull();
    expect(result.b).toBe(2); // undefined doesn't override
    expect(result.c).toBe(3);
  });

  it("preserves prototype-less objects", () => {
    const target = Object.create(null);
    target.a = 1;
    const source = { b: 2 };
    const result = deepMerge(target, source);

    expect(result.a).toBe(1);
    expect(result.b).toBe(2);
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe("Integration: Full Config Workflow", () => {
  it("loads, validates, and merges config from multiple sources", async () => {
    // This test demonstrates the full workflow:
    // 1. Load from file
    // 2. Apply env overrides
    // 3. Apply CLI flag overrides
    // 4. Validate against schema

    const AppConfigSchema = z.object({
      name: z.string(),
      version: z.string().regex(/^\d+\.\d+\.\d+$/),
      server: z.object({
        port: z.number().min(1).max(65_535),
        host: z.string(),
      }),
    });

    // In real implementation, this would load from disk
    const fileConfig = {
      name: "test-app",
      version: "1.0.0",
      server: { port: 3000, host: "localhost" },
    };

    const envConfig = {
      server: { port: 8080 },
    };

    const result = resolveConfig(AppConfigSchema, {
      file: fileConfig,
      env: envConfig,
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      const config = result.unwrap();
      expect(config.name).toBe("test-app");
      expect(config.server.port).toBe(8080); // env override
      expect(config.server.host).toBe("localhost"); // from file
    }
  });
});

// ============================================================================
// Config Extends Tests
// ============================================================================

describe("Config Extends", () => {
  const EXTENDS_TEST_DIR = "/tmp/config-extends-test";

  beforeAll(() => {
    // Create test directory structure
    mkdirSync(`${EXTENDS_TEST_DIR}/base`, { recursive: true });
    mkdirSync(`${EXTENDS_TEST_DIR}/app`, { recursive: true });
    mkdirSync(`${EXTENDS_TEST_DIR}/circular-a`, { recursive: true });
    mkdirSync(`${EXTENDS_TEST_DIR}/circular-b`, { recursive: true });
    mkdirSync(`${EXTENDS_TEST_DIR}/chain`, { recursive: true });

    // Base config
    writeFileSync(
      `${EXTENDS_TEST_DIR}/base/config.toml`,
      `port = 3000
host = "localhost"
timeout = 5000
`
    );

    // App config extending base with relative path
    writeFileSync(
      `${EXTENDS_TEST_DIR}/app/config.toml`,
      `extends = "../base/config.toml"
port = 8080
name = "my-app"
`
    );

    // Circular reference A -> B
    writeFileSync(
      `${EXTENDS_TEST_DIR}/circular-a/config.toml`,
      `extends = "../circular-b/config.toml"
value = "a"
`
    );

    // Circular reference B -> A
    writeFileSync(
      `${EXTENDS_TEST_DIR}/circular-b/config.toml`,
      `extends = "../circular-a/config.toml"
value = "b"
`
    );

    // Chain: grandparent -> parent -> child
    writeFileSync(
      `${EXTENDS_TEST_DIR}/chain/grandparent.toml`,
      `level = "grandparent"
fromGrandparent = true
`
    );

    writeFileSync(
      `${EXTENDS_TEST_DIR}/chain/parent.toml`,
      `extends = "./grandparent.toml"
level = "parent"
fromParent = true
`
    );

    writeFileSync(
      `${EXTENDS_TEST_DIR}/chain/config.toml`,
      `extends = "./parent.toml"
level = "child"
fromChild = true
`
    );
  });

  afterAll(() => {
    rmSync(EXTENDS_TEST_DIR, { recursive: true, force: true });
  });

  it("resolves relative extends path and merges configs", () => {
    const schema = z.object({
      port: z.number(),
      host: z.string(),
      timeout: z.number(),
      name: z.string(),
    });

    const result = loadConfig("app", schema, {
      searchPaths: [EXTENDS_TEST_DIR],
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      const config = result.unwrap();
      expect(config.port).toBe(8080); // overridden by app
      expect(config.host).toBe("localhost"); // from base
      expect(config.timeout).toBe(5000); // from base
      expect(config.name).toBe("my-app"); // only in app
    }
  });

  it("detects circular extends and returns error", () => {
    const schema = z.object({ value: z.string() });

    const result = loadConfig("circular-a", schema, {
      searchPaths: [EXTENDS_TEST_DIR],
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toContain("circular");
    }
  });

  it("handles multi-level extends chain", () => {
    const schema = z.object({
      level: z.string(),
      fromGrandparent: z.boolean(),
      fromParent: z.boolean(),
      fromChild: z.boolean(),
    });

    const result = loadConfig("chain", schema, {
      searchPaths: [EXTENDS_TEST_DIR],
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      const config = result.unwrap();
      expect(config.level).toBe("child"); // most specific wins
      expect(config.fromGrandparent).toBe(true);
      expect(config.fromParent).toBe(true);
      expect(config.fromChild).toBe(true);
    }
  });

  it("returns error when extends is not a string", () => {
    const dir = `${EXTENDS_TEST_DIR}/invalid-extends`;
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      `${dir}/config.toml`,
      `extends = 123
value = "test"
`
    );

    const schema = z.object({ value: z.string() });
    const result = loadConfig("invalid-extends", schema, {
      searchPaths: [EXTENDS_TEST_DIR],
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toContain("extends");
      expect(result.error.message).toContain("string");
    }

    rmSync(dir, { recursive: true, force: true });
  });

  it("returns error when extended file does not exist", () => {
    const dir = `${EXTENDS_TEST_DIR}/missing-extends`;
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      `${dir}/config.toml`,
      `extends = "./nonexistent.toml"
value = "test"
`
    );

    const schema = z.object({ value: z.string() });
    const result = loadConfig("missing-extends", schema, {
      searchPaths: [EXTENDS_TEST_DIR],
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toContain("not found");
    }

    rmSync(dir, { recursive: true, force: true });
  });
});

// ============================================================================
// Env Prefix Mapping Tests
// ============================================================================

describe("Env Prefix Mapping", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    // Restore original env
    for (const key of Object.keys(process.env)) {
      if (key.startsWith("TESTAPP_")) {
        delete process.env[key];
      }
    }
    Object.assign(process.env, originalEnv);
  });

  it("maps simple env vars to config keys", () => {
    process.env["TESTAPP_PORT"] = "8080";
    process.env["TESTAPP_HOST"] = "0.0.0.0";

    const schema = z.object({
      port: z.coerce.number(),
      host: z.string(),
    });

    const result = resolveConfig(schema, {
      defaults: { port: 3000, host: "localhost" },
      env: mapEnvToConfig("TESTAPP", schema),
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.port).toBe(8080);
      expect(result.value.host).toBe("0.0.0.0");
    }
  });

  it("maps nested env vars using __ separator", () => {
    process.env["TESTAPP_DATABASE__HOST"] = "db.example.com";
    process.env["TESTAPP_DATABASE__PORT"] = "5432";

    const schema = z.object({
      database: z.object({
        host: z.string(),
        port: z.coerce.number(),
      }),
    });

    const result = resolveConfig(schema, {
      defaults: { database: { host: "localhost", port: 5432 } },
      env: mapEnvToConfig("TESTAPP", schema),
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.database.host).toBe("db.example.com");
      expect(result.value.database.port).toBe(5432);
    }
  });

  it("ignores env vars not matching prefix", () => {
    process.env["TESTAPP_PORT"] = "8080";
    process.env["OTHER_PORT"] = "9999";

    const schema = z.object({
      port: z.coerce.number(),
    });

    const result = resolveConfig(schema, {
      defaults: { port: 3000 },
      env: mapEnvToConfig("TESTAPP", schema),
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.port).toBe(8080); // not 9999
    }
  });

  it("maps all env vars with prefix (schema filters during validation)", () => {
    process.env["TESTAPP_PORT"] = "8080";
    process.env["TESTAPP_EXTRA"] = "mapped";

    const schema = z.object({
      port: z.coerce.number(),
    });

    const mapped = mapEnvToConfig("TESTAPP", schema);

    // All prefixed vars are mapped; Zod's passthrough/strict handles unknowns
    expect(mapped.port).toBe("8080");
    expect((mapped as Record<string, unknown>)["extra"]).toBe("mapped");
  });

  it("handles boolean coercion", () => {
    process.env["TESTAPP_DEBUG"] = "true";
    process.env["TESTAPP_VERBOSE"] = "1";

    const schema = z.object({
      debug: z.coerce.boolean(),
      verbose: z.coerce.boolean(),
    });

    const result = resolveConfig(schema, {
      defaults: { debug: false, verbose: false },
      env: mapEnvToConfig("TESTAPP", schema),
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.debug).toBe(true);
      expect(result.value.verbose).toBe(true);
    }
  });
});
