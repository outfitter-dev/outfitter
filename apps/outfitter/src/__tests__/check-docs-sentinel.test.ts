import { describe, expect, test } from "bun:test";

import { checkDocsReadmeSentinelContent } from "../commands/check-docs-sentinel.js";

function wrapSentinel(content: string): string {
  return [
    "# Docs",
    "",
    "<!-- BEGIN:GENERATED:PACKAGE_LIST -->",
    "",
    content,
    "",
    "<!-- END:GENERATED:PACKAGE_LIST -->",
    "",
  ].join("\n");
}

function wrapMultipleSentinels(contents: readonly string[]): string {
  const blocks = contents.flatMap((content) => [
    "<!-- BEGIN:GENERATED:PACKAGE_LIST -->",
    "",
    content,
    "",
    "<!-- END:GENERATED:PACKAGE_LIST -->",
    "",
  ]);

  return ["# Docs", "", ...blocks].join("\n");
}

describe("checkDocsReadmeSentinelContent", () => {
  test("reports missing markers", () => {
    const readme = "# Docs\n\nNo sentinel here.\n";
    const result = checkDocsReadmeSentinelContent(readme, "- pkg");

    expect(result.reason).toBe("missing-markers");
  });

  test("reports stale sentinel content", () => {
    const readme = wrapSentinel("- old");
    const result = checkDocsReadmeSentinelContent(readme, "- new");

    expect(result.reason).toBe("out-of-date");
    expect(result.updatedContent).toContain("- new");
  });

  test("reports up-to-date sentinel content", () => {
    const readme = wrapSentinel("- same");
    const result = checkDocsReadmeSentinelContent(readme, "- same");

    expect(result.reason).toBe("up-to-date");
  });

  test("reports stale when any matching sentinel block is out of date", () => {
    const readme = wrapMultipleSentinels(["- same", "- stale"]);
    const result = checkDocsReadmeSentinelContent(readme, "- same");

    expect(result.reason).toBe("out-of-date");
  });
});
