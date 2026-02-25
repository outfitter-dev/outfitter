import { describe, expect, test } from "bun:test";

import { checkDocsReadmeSentinelContent } from "./check-docs-readme-sentinel";

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
});
