import { describe, expect, test } from "bun:test";

function findTopLevelNodeImports(source: string): string[] {
  return (
    source.match(/^\s*import\s+[^;]+from\s+["']node:[^"']+["']\s*;?/gm) ?? []
  );
}

describe("bundler safety", () => {
  test("logging entry avoids top-level node:* imports", async () => {
    const source = await Bun.file(
      new URL("../index.ts", import.meta.url)
    ).text();
    expect(
      findTopLevelNodeImports(source),
      "logging/index.ts should not include node:* imports"
    ).toHaveLength(0);
  });
});
