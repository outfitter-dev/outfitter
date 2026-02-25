import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  extractMarkdownLinks,
  validateLinks,
} from "../cli/check-markdown-links.js";

// ---------------------------------------------------------------------------
// extractMarkdownLinks — pure extraction from markdown content
// ---------------------------------------------------------------------------

describe("extractMarkdownLinks", () => {
  test("extracts relative links", () => {
    const content = `Check the [guide](./docs/guide.md) for details.`;
    const links = extractMarkdownLinks(content);
    expect(links).toEqual([{ target: "./docs/guide.md", line: 1 }]);
  });

  test("extracts multiple links from the same line", () => {
    const content = `See [A](./a.md) and [B](./b.md).`;
    const links = extractMarkdownLinks(content);
    expect(links).toHaveLength(2);
    expect(links[0]).toEqual({ target: "./a.md", line: 1 });
    expect(links[1]).toEqual({ target: "./b.md", line: 1 });
  });

  test("extracts links across multiple lines", () => {
    const content = `# Title

See [guide](./guide.md).

Also [reference](../ref.md).`;
    const links = extractMarkdownLinks(content);
    expect(links).toHaveLength(2);
    expect(links[0]).toEqual({ target: "./guide.md", line: 3 });
    expect(links[1]).toEqual({ target: "../ref.md", line: 5 });
  });

  test("strips anchors from link targets", () => {
    const content = `See [section](./guide.md#installation).`;
    const links = extractMarkdownLinks(content);
    expect(links).toEqual([{ target: "./guide.md", line: 1 }]);
  });

  test("skips external URLs (http/https)", () => {
    const content = `Visit [site](https://example.com) or [http](http://example.com).`;
    const links = extractMarkdownLinks(content);
    expect(links).toEqual([]);
  });

  test("skips bare anchor links", () => {
    const content = `Jump to [section](#overview).`;
    const links = extractMarkdownLinks(content);
    expect(links).toEqual([]);
  });

  test("skips mailto links", () => {
    const content = `Contact [us](mailto:hello@example.com).`;
    const links = extractMarkdownLinks(content);
    expect(links).toEqual([]);
  });

  test("skips data: and tel: links", () => {
    const content = `[img](data:image/png;base64,abc) and [call](tel:+1234567890).`;
    const links = extractMarkdownLinks(content);
    expect(links).toEqual([]);
  });

  test("skips links inside code fences", () => {
    const content = `\`\`\`markdown
[not a link](./ignored.md)
\`\`\`

[real link](./real.md)`;
    const links = extractMarkdownLinks(content);
    expect(links).toEqual([{ target: "./real.md", line: 5 }]);
  });

  test("skips links inside inline code", () => {
    const content = "Use `[text](./path.md)` syntax for links.";
    const links = extractMarkdownLinks(content);
    expect(links).toEqual([]);
  });

  test("skips links inside double-backtick inline code", () => {
    const content = "Use ``[text](./path.md)`` syntax for links.";
    const links = extractMarkdownLinks(content);
    expect(links).toEqual([]);
  });

  test("skips links inside multi-backtick code spans containing backticks", () => {
    const content = "Use `` `[text](./path.md)` `` syntax for docs examples.";
    const links = extractMarkdownLinks(content);
    expect(links).toEqual([]);
  });

  test("handles links without explicit relative prefix", () => {
    const content = `See [agents](AGENTS.md) for details.`;
    const links = extractMarkdownLinks(content);
    expect(links).toEqual([{ target: "AGENTS.md", line: 1 }]);
  });
});

// ---------------------------------------------------------------------------
// validateLinks — filesystem validation using temp directories
// ---------------------------------------------------------------------------

describe("validateLinks", () => {
  let tempDir: string;

  async function setup(files: Record<string, string>): Promise<string> {
    tempDir = await mkdtemp(join(tmpdir(), "check-md-links-"));
    for (const [filePath, content] of Object.entries(files)) {
      const fullPath = join(tempDir, filePath);
      const dir = fullPath.substring(0, fullPath.lastIndexOf("/"));
      await mkdir(dir, { recursive: true });
      await writeFile(fullPath, content, "utf-8");
    }
    return tempDir;
  }

  async function cleanup(): Promise<void> {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  }

  test("returns no broken links when all targets exist", async () => {
    const dir = await setup({
      "README.md": "See [guide](./docs/guide.md).",
      "docs/guide.md": "# Guide",
    });
    try {
      const broken = await validateLinks(dir, ["README.md"]);
      expect(broken).toEqual([]);
    } finally {
      await cleanup();
    }
  });

  test("reports broken links when target does not exist", async () => {
    const dir = await setup({
      "README.md": "See [missing](./docs/missing.md).",
    });
    try {
      const broken = await validateLinks(dir, ["README.md"]);
      expect(broken).toHaveLength(1);
      expect(broken[0]).toMatchObject({
        source: "README.md",
        target: "./docs/missing.md",
        line: 1,
      });
    } finally {
      await cleanup();
    }
  });

  test("resolves links relative to the source file", async () => {
    const dir = await setup({
      "docs/intro.md": "See [patterns](../patterns.md).",
      "patterns.md": "# Patterns",
    });
    try {
      const broken = await validateLinks(dir, ["docs/intro.md"]);
      expect(broken).toEqual([]);
    } finally {
      await cleanup();
    }
  });

  test("skips links targeting docs/packages/ paths", async () => {
    const dir = await setup({
      "README.md": "See [api docs](./docs/packages/cli/README.md).",
    });
    try {
      const broken = await validateLinks(dir, ["README.md"]);
      expect(broken).toEqual([]);
    } finally {
      await cleanup();
    }
  });

  test("reports multiple broken links from a single file", async () => {
    const dir = await setup({
      "README.md": `See [a](./a.md) and [b](./b.md).`,
    });
    try {
      const broken = await validateLinks(dir, ["README.md"]);
      expect(broken).toHaveLength(2);
    } finally {
      await cleanup();
    }
  });

  test("validates links across multiple files", async () => {
    const dir = await setup({
      "README.md": "See [guide](./guide.md).",
      "docs/intro.md": "See [missing](./nope.md).",
      "guide.md": "# Guide",
    });
    try {
      const broken = await validateLinks(dir, ["README.md", "docs/intro.md"]);
      expect(broken).toHaveLength(1);
      expect(broken[0]).toMatchObject({
        source: "docs/intro.md",
        target: "./nope.md",
        line: 1,
      });
    } finally {
      await cleanup();
    }
  });

  test("handles links to directories with index files", async () => {
    const dir = await setup({
      "README.md": "See [docs](./docs/).",
      "docs/index.md": "# Docs index",
    });
    try {
      // Linking to a directory is valid if the directory exists
      const broken = await validateLinks(dir, ["README.md"]);
      expect(broken).toEqual([]);
    } finally {
      await cleanup();
    }
  });
});
