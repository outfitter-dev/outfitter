import { describe, expect, test } from "bun:test";

function findTopLevelNodeImports(source: string): string[] {
  return (
    source.match(/^\s*import\s+[^;]+from\s+["']node:[^"']+["']\s*;?/gm) ?? []
  );
}

describe("bundler safety", () => {
  test("testing utilities avoid top-level node:* imports", async () => {
    const fixturesSource = await Bun.file(
      new URL("../fixtures.ts", import.meta.url)
    ).text();
    const harnessSource = await Bun.file(
      new URL("../cli-harness.ts", import.meta.url)
    ).text();

    expect(
      findTopLevelNodeImports(fixturesSource),
      "testing/fixtures.ts should not include node:* imports"
    ).toHaveLength(0);
    expect(
      findTopLevelNodeImports(harnessSource),
      "testing/cli-harness.ts should not include node:* imports"
    ).toHaveLength(0);
  });
});
