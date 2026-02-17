import { describe, expect, test } from "bun:test";
import { type FenceFinding, scanFences } from "../lint-fences";

function findings(content: string): FenceFinding[] {
  return scanFences("test.md", content).findings;
}

describe("lint-fences", () => {
  describe("bare fences", () => {
    test("detects opening fence without language", () => {
      const result = findings("```\nsome code\n```");
      expect(result).toHaveLength(1);
      expect(result[0]!.type).toBe("bare-fence");
      expect(result[0]!.line).toBe(1);
    });

    test("ignores closing fences", () => {
      const result = findings("```typescript\nconst x = 1;\n```");
      expect(result).toHaveLength(0);
    });

    test("detects multiple bare fences", () => {
      const result = findings("```\nfoo\n```\n\n```\nbar\n```");
      expect(result).toHaveLength(2);
    });

    test("suggests language from content heuristics", () => {
      const tsResult = findings("```\nconst x: string = 'hello';\n```");
      expect(tsResult[0]!.suggestion).toBe("typescript");

      const pyResult = findings("```\nimport os\ndef main():\n    pass\n```");
      expect(pyResult[0]!.suggestion).toBe("python");

      const bashResult = findings("```\n#!/bin/bash\necho hello\n```");
      expect(bashResult[0]!.suggestion).toBe("bash");

      const jsonResult = findings('```\n{"key": "value"}\n```');
      expect(jsonResult[0]!.suggestion).toBe("json");

      const yamlResult = findings("```\nname: test\nversion: 1.0\n```");
      expect(yamlResult[0]!.suggestion).toBe("yaml");
    });

    test("suggests text for unknown content", () => {
      const result = findings("```\nSome plain text description\n```");
      expect(result[0]!.suggestion).toBe("text");
    });
  });

  describe("broken nesting", () => {
    test("detects inner fence with same backtick count", () => {
      const content = [
        "````markdown",
        "Here is an example:",
        "```typescript",
        "const x = 1;",
        "```",
        "````",
      ].join("\n");
      // This is actually valid — outer uses 4 backticks, inner uses 3
      expect(findings(content)).toHaveLength(0);
    });

    test("detects true nesting violation", () => {
      const content = [
        "```markdown",
        "Here is an example:",
        "```typescript",
        "const x = 1;",
        "```",
        "```",
      ].join("\n");
      // Outer uses 3 backticks, inner tries to use 3 — the inner ``` closes the outer
      const result = findings(content);
      const nestingIssues = result.filter((f) => f.type === "nesting");
      expect(nestingIssues.length).toBeGreaterThan(0);
    });
  });

  describe("frontmatter handling", () => {
    test("ignores YAML frontmatter", () => {
      const content = "---\ntitle: test\n---\n```typescript\ncode\n```";
      expect(findings(content)).toHaveLength(0);
    });
  });

  describe("html comments", () => {
    test("ignores fences inside HTML comments", () => {
      const content =
        "<!-- ```\nthis is commented\n``` -->\n```typescript\ncode\n```";
      expect(findings(content)).toHaveLength(0);
    });
  });

  describe("four-backtick fences", () => {
    test("handles four-backtick outer fences correctly", () => {
      const content = "````json\n{}\n````";
      expect(findings(content)).toHaveLength(0);
    });

    test("detects bare four-backtick fences", () => {
      const content = "````\nsome content\n````";
      const result = findings(content);
      expect(result).toHaveLength(1);
      expect(result[0]!.type).toBe("bare-fence");
    });
  });

  describe("tilde fences", () => {
    test("handles tilde fences", () => {
      const content = "~~~typescript\ncode\n~~~";
      expect(findings(content)).toHaveLength(0);
    });

    test("detects bare tilde fences", () => {
      const content = "~~~\ncode\n~~~";
      const result = findings(content);
      expect(result).toHaveLength(1);
      expect(result[0]!.type).toBe("bare-fence");
    });
  });
});
