import { describe, expect, test } from "bun:test";

import {
  type RelativePathFinding,
  scanRelativePaths,
} from "../lint-relative-paths";

function findings(
  content: string,
  filePath = "test.md"
): RelativePathFinding[] {
  return scanRelativePaths(filePath, content).findings;
}

describe("lint-relative-paths", () => {
  describe("markdown link targets", () => {
    test("detects ../ in markdown link targets", () => {
      const result = findings("[SKILL.md](../tdd-fieldguide/SKILL.md)");
      expect(result).toHaveLength(1);
      expect(result[0]!.type).toBe("markdown-link");
      expect(result[0]!.path).toBe("../tdd-fieldguide/SKILL.md");
    });

    test("detects multiple relative links", () => {
      const content = [
        "[foo](../foo/SKILL.md)",
        "Some text",
        "[bar](../bar/SKILL.md)",
      ].join("\n");
      expect(findings(content)).toHaveLength(2);
    });

    test("ignores links without ../", () => {
      const content = "[valid](./local.md)\n[also](other.md)";
      expect(findings(content)).toHaveLength(0);
    });

    test("detects deep relative paths", () => {
      const result = findings(
        "[audit](../../claude-plugins/references/audit.md)"
      );
      expect(result).toHaveLength(1);
      expect(result[0]!.path).toBe("../../claude-plugins/references/audit.md");
    });
  });

  describe("code block skipping", () => {
    test("ignores relative paths inside code blocks", () => {
      const content = [
        "```typescript",
        'import { db } from "../src/db";',
        "```",
      ].join("\n");
      expect(findings(content)).toHaveLength(0);
    });

    test("ignores relative paths inside four-backtick blocks", () => {
      const content = ["````markdown", "[link](../other/file.md)", "````"].join(
        "\n"
      );
      expect(findings(content)).toHaveLength(0);
    });

    test("detects paths after code block closes", () => {
      const content = [
        "```typescript",
        'import { db } from "../src/db";',
        "```",
        "[link](../other/file.md)",
      ].join("\n");
      expect(findings(content)).toHaveLength(1);
    });
  });

  describe("frontmatter handling", () => {
    test("ignores YAML frontmatter", () => {
      const content = "---\nrelated: ../other/SKILL.md\n---\n[link](../foo.md)";
      const result = findings(content);
      expect(result).toHaveLength(1);
      expect(result[0]!.line).toBe(4);
    });
  });

  describe("html comments", () => {
    test("ignores paths inside HTML comments", () => {
      const content = "<!-- See ../other/file.md -->\n[link](../real/file.md)";
      const result = findings(content);
      expect(result).toHaveLength(1);
      expect(result[0]!.line).toBe(2);
    });

    test("still scans paths on lines with inline comments", () => {
      const content = "[guide](../skills/foo/SKILL.md) <!-- note -->";
      const result = findings(content);
      expect(result).toHaveLength(1);
      expect(result[0]!.path).toBe("../skills/foo/SKILL.md");
    });

    test("ignores paths that are only inside inline comments", () => {
      const content = "Some text <!-- ../hidden/path.md --> here";
      expect(findings(content)).toHaveLength(0);
    });
  });

  describe("inline code and bare paths", () => {
    test("detects bare ../path references in prose", () => {
      const content = "See ../SECURITY.md for details.";
      const result = findings(content);
      expect(result).toHaveLength(1);
      expect(result[0]!.type).toBe("bare-path");
    });

    test("ignores ../ inside inline code", () => {
      const content = "Use `../relative/path` for the import.";
      expect(findings(content)).toHaveLength(0);
    });

    // eslint-disable-next-line no-template-curly-in-string -- testing literal ${CLAUDE_PLUGIN_ROOT}
    test("ignores ../ inside ${CLAUDE_PLUGIN_ROOT} references", () => {
      // eslint-disable-next-line no-template-curly-in-string -- testing literal ${CLAUDE_PLUGIN_ROOT}
      const content = "[guide](${CLAUDE_PLUGIN_ROOT}/shared/guides/arch.md)";
      expect(findings(content)).toHaveLength(0);
    });
  });
});
