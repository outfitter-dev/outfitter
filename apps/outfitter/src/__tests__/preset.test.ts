import { describe, expect, test } from "bun:test";

import { sortLeadingImports } from "../engine/preset.js";

describe("sortLeadingImports", () => {
  test("preserves comments attached to later imports", () => {
    const input = [
      'import { z } from "zod";',
      "// NOTE: keep this import with the contracts dependency",
      'import { Result } from "@outfitter/contracts";',
      'import { join } from "node:path";',
      "",
      "const value = true;",
      "",
    ].join("\n");

    expect(sortLeadingImports("src/example.ts", input)).toBe(
      [
        'import { join } from "node:path";',
        "",
        "// NOTE: keep this import with the contracts dependency",
        'import { Result } from "@outfitter/contracts";',
        'import { z } from "zod";',
        "",
        "const value = true;",
        "",
      ].join("\n")
    );
  });
});
