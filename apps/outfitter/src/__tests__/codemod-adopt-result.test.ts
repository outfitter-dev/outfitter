/**
 * Tests for the Result type adoption codemod.
 *
 * Transforms:
 * - `throw new Error(msg)` → `return Result.err(InternalError.create(msg))`
 * - `throw new XError(...)` → `return Result.err(new XError(...))`  (known Outfitter errors)
 * - `return value` → `return Result.ok(value)` (in functions that also have Result.err)
 *
 * @packageDocumentation
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCodemod } from "../commands/upgrade-codemods.js";

// =============================================================================
// Test Utilities
// =============================================================================

function createTempDir(): string {
  const tempDir = join(
    tmpdir(),
    `outfitter-result-codemod-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  mkdirSync(tempDir, { recursive: true });
  return tempDir;
}

function cleanupTempDir(dir: string): void {
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
}

let tempDir: string;
let targetDir: string;

const CODEMOD_PATH = join(
  import.meta.dir,
  "../../../../plugins/outfitter/shared/codemods/contracts/adopt-result-types.ts"
);

function writeTarget(filename: string, content: string): void {
  writeFileSync(join(targetDir, filename), content);
}

function readTarget(filename: string): string {
  return readFileSync(join(targetDir, filename), "utf-8");
}

beforeEach(() => {
  tempDir = createTempDir();
  targetDir = join(tempDir, "src");
  mkdirSync(targetDir, { recursive: true });
});

afterEach(() => {
  cleanupTempDir(tempDir);
});

// =============================================================================
// Transform: throw new Error → Result.err(InternalError.create(...))
// =============================================================================

describe("throw new Error → Result.err(InternalError.create(...))", () => {
  test("transforms throw new Error with string literal", async () => {
    writeTarget(
      "handler.ts",
      `export async function getUser(id: string) {
  const user = await db.find(id);
  if (!user) {
    throw new Error("User not found");
  }
  return user;
}
`
    );

    const result = await runCodemod(CODEMOD_PATH, tempDir, false);
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.changedFiles).toContain("src/handler.ts");
    }

    const updated = readTarget("handler.ts");
    expect(updated).toContain(
      'return Result.err(InternalError.create("User not found"))'
    );
    expect(updated).not.toContain("throw new Error");
    expect(updated).toContain("return Result.ok(user)");
    // Should add imports
    expect(updated).toContain("Result");
    expect(updated).toContain("InternalError");
  });

  test("transforms throw new Error with template literal", async () => {
    writeTarget(
      "handler.ts",
      `export function validate(input: string) {
  if (!input) {
    throw new Error(\`Invalid input: \${input}\`);
  }
  return input.trim();
}
`
    );

    const result = await runCodemod(CODEMOD_PATH, tempDir, false);
    expect(result.isOk()).toBe(true);

    const updated = readTarget("handler.ts");
    expect(updated).toContain("return Result.err(InternalError.create(");
    expect(updated).not.toContain("throw new Error");
  });

  test("transforms throw new Error with variable argument", async () => {
    writeTarget(
      "handler.ts",
      `export function process(data: unknown) {
  const msg = "Processing failed";
  if (!data) {
    throw new Error(msg);
  }
  return data;
}
`
    );

    const result = await runCodemod(CODEMOD_PATH, tempDir, false);
    expect(result.isOk()).toBe(true);

    const updated = readTarget("handler.ts");
    expect(updated).toContain("return Result.err(InternalError.create(msg))");
    expect(updated).not.toContain("throw new Error");
  });
});

// =============================================================================
// Transform: throw new XError → Result.err(new XError(...))
// =============================================================================

describe("throw known Outfitter errors → Result.err(...)", () => {
  test("transforms throw new ValidationError", async () => {
    writeTarget(
      "handler.ts",
      `import { ValidationError } from "@outfitter/contracts";

export function validate(input: string) {
  if (!input) {
    throw new ValidationError({ message: "Input required" });
  }
  return input;
}
`
    );

    const result = await runCodemod(CODEMOD_PATH, tempDir, false);
    expect(result.isOk()).toBe(true);

    const updated = readTarget("handler.ts");
    expect(updated).toContain(
      'return Result.err(new ValidationError({ message: "Input required" }))'
    );
    expect(updated).not.toContain("throw new ValidationError");
  });

  test("transforms throw new NotFoundError", async () => {
    writeTarget(
      "handler.ts",
      `import { NotFoundError } from "@outfitter/contracts";

export function find(id: string) {
  const item = store.get(id);
  if (!item) {
    throw new NotFoundError({ message: "Item not found" });
  }
  return item;
}
`
    );

    const result = await runCodemod(CODEMOD_PATH, tempDir, false);
    expect(result.isOk()).toBe(true);

    const updated = readTarget("handler.ts");
    expect(updated).toContain("return Result.err(new NotFoundError(");
    expect(updated).not.toContain("throw new NotFoundError");
    expect(updated).toContain("return Result.ok(item)");
  });

  test("transforms multiple known error types in one file", async () => {
    writeTarget(
      "handler.ts",
      `import { ValidationError, NotFoundError } from "@outfitter/contracts";

export function update(id: string, data: unknown) {
  if (!data) {
    throw new ValidationError({ message: "Data required" });
  }
  const item = store.get(id);
  if (!item) {
    throw new NotFoundError({ message: "Not found" });
  }
  return { ...item, ...data };
}
`
    );

    const result = await runCodemod(CODEMOD_PATH, tempDir, false);
    expect(result.isOk()).toBe(true);

    const updated = readTarget("handler.ts");
    expect(updated).toContain("return Result.err(new ValidationError(");
    expect(updated).toContain("return Result.err(new NotFoundError(");
    expect(updated).not.toContain("throw new ValidationError");
    expect(updated).not.toContain("throw new NotFoundError");
  });
});

// =============================================================================
// Transform: return value → return Result.ok(value)
// =============================================================================

describe("return value → return Result.ok(value)", () => {
  test("wraps return values when file has Result.err", async () => {
    writeTarget(
      "handler.ts",
      `export function getUser(id: string) {
  if (!id) {
    throw new Error("ID required");
  }
  const user = { id, name: "Test" };
  return user;
}
`
    );

    const result = await runCodemod(CODEMOD_PATH, tempDir, false);
    expect(result.isOk()).toBe(true);

    const updated = readTarget("handler.ts");
    expect(updated).toContain("return Result.ok(user)");
  });

  test("does not wrap Result.ok or Result.err returns", async () => {
    writeTarget(
      "handler.ts",
      `import { Result, InternalError } from "@outfitter/contracts";

export function getUser(id: string) {
  if (!id) {
    return Result.err(InternalError.create("ID required"));
  }
  return Result.ok({ id, name: "Test" });
}
`
    );

    const result = await runCodemod(CODEMOD_PATH, tempDir, false);
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      // File should not be changed — already using Result types
      expect(result.value.changedFiles).not.toContain("src/handler.ts");
    }
  });

  test("does not wrap bare return statements", async () => {
    writeTarget(
      "handler.ts",
      `export function doWork() {
  if (done) {
    throw new Error("Already done");
  }
  doSomething();
  return;
}
`
    );

    const result = await runCodemod(CODEMOD_PATH, tempDir, false);
    expect(result.isOk()).toBe(true);

    const updated = readTarget("handler.ts");
    // The bare "return;" should not be wrapped
    expect(updated).toContain("return;");
    expect(updated).not.toContain("return Result.ok(;)");
  });

  test("does not wrap returns in nested callback functions", async () => {
    writeTarget(
      "handler.ts",
      `export function collect(ids: string[]) {
  if (ids.length === 0) {
    throw new Error("No ids");
  }

  const mapped = ids.map((id) => {
    return id.trim();
  });

  return mapped;
}
`
    );

    const result = await runCodemod(CODEMOD_PATH, tempDir, false);
    expect(result.isOk()).toBe(true);

    const updated = readTarget("handler.ts");
    expect(updated).toContain("return Result.ok(mapped);");
    expect(updated).toContain("return id.trim();");
    expect(updated).not.toContain("return Result.ok(id.trim())");
  });

  test("wraps returns in class methods and accessors", async () => {
    writeTarget(
      "handler.ts",
      `export class UserService {
  parse(input: string) {
    if (!input) {
      throw new Error("Input required");
    }
    return input.trim();
  }

  get value() {
    if (!this._value) {
      throw new Error("Missing value");
    }
    return this._value;
  }

  private _value = "ok";
}
`
    );

    const result = await runCodemod(CODEMOD_PATH, tempDir, false);
    expect(result.isOk()).toBe(true);

    const updated = readTarget("handler.ts");
    expect(updated).toContain("return Result.ok(input.trim());");
    expect(updated).toContain("return Result.ok(this._value);");
  });

  test("wraps multiline return expressions", async () => {
    writeTarget(
      "handler.ts",
      `export function buildMessage(id: string) {
  if (!id) {
    throw new Error("ID required");
  }
  return (
    "id:" +
    id
  );
}
`
    );

    const result = await runCodemod(CODEMOD_PATH, tempDir, false);
    expect(result.isOk()).toBe(true);

    const updated = readTarget("handler.ts");
    expect(updated).toContain("return Result.ok(");
    expect(updated).toContain('"id:" +');
    expect(updated).not.toContain("  return (\n");
  });
});

// =============================================================================
// Import Management
// =============================================================================

describe("import management", () => {
  test("adds Result and InternalError imports when not present", async () => {
    writeTarget(
      "handler.ts",
      `export function fail() {
  throw new Error("oops");
}
`
    );

    const result = await runCodemod(CODEMOD_PATH, tempDir, false);
    expect(result.isOk()).toBe(true);

    const updated = readTarget("handler.ts");
    expect(updated).toContain(
      'import { InternalError, Result } from "@outfitter/contracts"'
    );
  });

  test("adds Result to existing @outfitter/contracts import", async () => {
    writeTarget(
      "handler.ts",
      `import { ValidationError } from "@outfitter/contracts";

export function fail(input: string) {
  if (!input) {
    throw new ValidationError({ message: "bad" });
  }
  return input;
}
`
    );

    const result = await runCodemod(CODEMOD_PATH, tempDir, false);
    expect(result.isOk()).toBe(true);

    const updated = readTarget("handler.ts");
    // Result should be added to existing import
    expect(updated).toContain("Result");
    expect(updated).toContain("ValidationError");
    // Should NOT have duplicate import lines
    const importLines = updated
      .split("\n")
      .filter((l) => l.includes("@outfitter/contracts"));
    expect(importLines.length).toBeLessThanOrEqual(1);
  });

  test("adds value Result import when only type Result import exists", async () => {
    writeTarget(
      "handler.ts",
      `import type { Result } from "@outfitter/contracts";
import { ValidationError } from "@outfitter/contracts";

export function fail(input: string) {
  if (!input) {
    throw new ValidationError({ message: "bad" });
  }
  return input;
}
`
    );

    const result = await runCodemod(CODEMOD_PATH, tempDir, false);
    expect(result.isOk()).toBe(true);

    const updated = readTarget("handler.ts");
    expect(updated).toContain(
      'import { Result, ValidationError } from "@outfitter/contracts";'
    );
    expect(updated).toContain(
      'import type { Result } from "@outfitter/contracts";'
    );
    expect(updated).toContain("return Result.ok(input);");
  });

  test("adds Result to multiline @outfitter/contracts imports", async () => {
    writeTarget(
      "handler.ts",
      `import {
  ValidationError,
} from "@outfitter/contracts";

export function fail(input: string) {
  if (!input) {
    throw new ValidationError({ message: "bad" });
  }
  return input;
}
`
    );

    const result = await runCodemod(CODEMOD_PATH, tempDir, false);
    expect(result.isOk()).toBe(true);

    const updated = readTarget("handler.ts");
    expect(updated).toContain("Result");
    expect(updated).toContain("ValidationError");
    const importLines = updated
      .split("\n")
      .filter((line) => line.includes("@outfitter/contracts"));
    expect(importLines).toHaveLength(1);
  });
});

// =============================================================================
// Edge Cases
// =============================================================================

describe("edge cases", () => {
  test("skips files without throw statements", async () => {
    writeTarget(
      "util.ts",
      `export function add(a: number, b: number) {
  return a + b;
}
`
    );

    const result = await runCodemod(CODEMOD_PATH, tempDir, false);
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.changedFiles).not.toContain("src/util.ts");
    }
  });

  test("dry run does not modify files", async () => {
    const original = `export function fail() {
  throw new Error("oops");
}
`;
    writeTarget("handler.ts", original);

    const result = await runCodemod(CODEMOD_PATH, tempDir, true);
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.changedFiles).toContain("src/handler.ts");
    }

    // File should be unchanged
    expect(readTarget("handler.ts")).toBe(original);
  });

  test("preserves indentation", async () => {
    writeTarget(
      "handler.ts",
      `export function getUser(id: string) {
  if (!id) {
    throw new Error("ID required");
  }
  return { id };
}
`
    );

    const result = await runCodemod(CODEMOD_PATH, tempDir, false);
    expect(result.isOk()).toBe(true);

    const updated = readTarget("handler.ts");
    // The return Result.err should have same indentation as the throw
    expect(updated).toContain(
      '    return Result.err(InternalError.create("ID required"))'
    );
  });

  test("handles multiline throw expressions", async () => {
    writeTarget(
      "handler.ts",
      `export function check() {
  throw new Error(
    "Something went wrong"
  );
}
`
    );

    const result = await runCodemod(CODEMOD_PATH, tempDir, false);
    expect(result.isOk()).toBe(true);

    const updated = readTarget("handler.ts");
    expect(updated).not.toContain("throw new Error");
    expect(updated).toContain("Result.err(InternalError.create(");
    expect(updated).toContain(
      'import { InternalError, Result } from "@outfitter/contracts";'
    );
  });
});
