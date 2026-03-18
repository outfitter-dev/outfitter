/**
 * Lightweight guardrails for scaffold source artifacts.
 *
 * These checks mirror preset templates into a temp workspace with their
 * `.template` marker removed, then run the same format/lint tools we expect
 * generated projects to satisfy. This gives us a cheap, always-on safety net
 * without paying the cost of a full install/build cycle for every test run.
 *
 * @packageDocumentation
 */

import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import {
  delimiter,
  dirname,
  extname,
  join,
  relative,
  resolve,
} from "node:path";

const OXFMT_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".json",
  ".jsonc",
]);
const OXLINT_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"]);
const ULTRACITE_EXTENSIONS = new Set([
  ".js",
  ".jsx",
  ".json",
  ".jsonc",
  ".md",
  ".ts",
  ".tsx",
]);
const TOOLING_ARTIFACTS = [
  "packages/tooling/configs/.oxlintrc.json",
  "packages/tooling/configs/.oxfmtrc.jsonc",
] as const;

type GuardrailTool =
  | "oxfmt"
  | "oxlint"
  | "readme-typecheck"
  | "schema-annotation"
  | "ultracite";
type ExecutableGuardrailTool = Exclude<
  GuardrailTool,
  "schema-annotation" | "readme-typecheck"
>;

export interface TemplateGuardrailFailure {
  readonly output: string;
  readonly paths: readonly string[];
  readonly tool: GuardrailTool;
}

export interface TemplateGuardrailResult {
  readonly checkedPaths: readonly string[];
  readonly failures: readonly TemplateGuardrailFailure[];
  readonly ok: boolean;
}

export interface RunTemplateGuardrailsOptions {
  readonly workspaceRoot: string;
}

interface MissingSchemaAnnotation {
  readonly line: number;
  readonly path: string;
  readonly source: string;
}

const EXPORTED_SCHEMA_WITHOUT_ANNOTATION_PATTERN =
  /export const [A-Za-z0-9_]+Schema\s*=\s*z\./;

const TEMPLATE_PLACEHOLDER_DEFAULTS: Record<string, string> = {
  "{{packageName}}": "scaffold-test",
  "{{projectName}}": "scaffold-test",
  "{{binName}}": "scaffold-test",
  "{{version}}": "0.1.0",
  "{{description}}": "Test project",
};

function replaceTemplatePlaceholders(code: string): string {
  let result = code;
  for (const [placeholder, value] of Object.entries(
    TEMPLATE_PLACEHOLDER_DEFAULTS
  )) {
    result = result.replaceAll(placeholder, value);
  }
  return result;
}

function stripTemplateMarker(filePath: string): string {
  if (filePath.includes(".template.")) {
    return filePath.replace(".template.", ".");
  }
  return filePath.endsWith(".template")
    ? filePath.slice(0, -".template".length)
    : filePath;
}

function collectArtifactPaths(workspaceRoot: string): string[] {
  const templateGlob = new Bun.Glob(
    "packages/presets/presets/**/*.template{,.*}"
  );
  const collected = [
    ...templateGlob.scanSync({
      cwd: workspaceRoot,
      absolute: false,
    }),
  ];

  for (const artifactPath of TOOLING_ARTIFACTS) {
    if (existsSync(join(workspaceRoot, artifactPath))) {
      collected.push(artifactPath);
    }
  }

  return collected.toSorted();
}

function mirrorArtifacts(
  workspaceRoot: string,
  tempDir: string,
  artifactPaths: readonly string[]
): string[] {
  const mirrored: string[] = [];

  for (const sourcePath of artifactPaths) {
    const destinationRelativePath = stripTemplateMarker(sourcePath);
    const destinationPath = join(tempDir, destinationRelativePath);

    mkdirSync(dirname(destinationPath), { recursive: true });
    let content = readFileSync(join(workspaceRoot, sourcePath), "utf-8");
    // Replace template placeholders so JSON files are valid for oxfmt
    if (
      destinationPath.endsWith(".json") ||
      destinationPath.endsWith(".jsonc")
    ) {
      content = replaceTemplatePlaceholders(content);
    }
    writeFileSync(destinationPath, content);
    mirrored.push(destinationPath);
  }

  return mirrored;
}

export function findMissingExportedSchemaAnnotations(
  files: readonly {
    readonly content: string;
    readonly path: string;
  }[]
): readonly MissingSchemaAnnotation[] {
  const failures: MissingSchemaAnnotation[] = [];

  for (const file of files) {
    const lines = file.content.split("\n");
    for (const [index, line] of lines.entries()) {
      if (!EXPORTED_SCHEMA_WITHOUT_ANNOTATION_PATTERN.test(line)) {
        continue;
      }

      failures.push({
        path: file.path,
        line: index + 1,
        source: line.trim(),
      });
    }
  }

  return failures;
}

function findSchemaAnnotationFailure(
  workspaceRoot: string,
  artifactPaths: readonly string[]
): TemplateGuardrailFailure | undefined {
  const filesToCheck = artifactPaths
    .filter((path) => path.endsWith(".ts") || path.endsWith(".template.ts"))
    .map((path) => ({
      path,
      content: readFileSync(join(workspaceRoot, path), "utf-8"),
    }));
  const missingAnnotations = findMissingExportedSchemaAnnotations(filesToCheck);
  if (missingAnnotations.length === 0) {
    return undefined;
  }

  return {
    tool: "schema-annotation",
    paths: missingAnnotations.map((entry) => entry.path),
    output: missingAnnotations
      .map(
        (entry) =>
          `${entry.path}:${entry.line} exported Zod schema is missing an explicit type annotation: ${entry.source}`
      )
      .join("\n"),
  };
}

const CODE_BLOCK_RE = /```typescript\n([\s\S]*?)```/g;

function extractTypescriptBlocks(
  content: string
): readonly { readonly code: string; readonly line: number }[] {
  const blocks: { code: string; line: number }[] = [];

  for (const match of content.matchAll(CODE_BLOCK_RE)) {
    const offset = match.index ?? 0;
    const lineNumber = content.slice(0, offset).split("\n").length;
    const captured = match[1];
    if (captured === undefined) continue;
    blocks.push({
      code: replaceTemplatePlaceholders(captured),
      line: lineNumber,
    });
  }

  return blocks;
}

/** Known anti-patterns in README code examples that indicate API drift. */
const README_CODE_ANTI_PATTERNS: readonly {
  readonly pattern: RegExp;
  readonly message: string;
}[] = [
  {
    pattern: /result\.ok\b(?!\()/,
    message:
      "Use result.isOk() instead of result.ok — Result is not a plain object",
  },
  {
    pattern: /result\.err\b(?!\()/,
    message:
      "Use result.isErr() instead of result.err — Result is not a plain object",
  },
  {
    pattern: /\.safeParse\(.*\);\s*\n\s*if\s*\(\s*!.*\.success\b/,
    message:
      "Consider using Result pattern instead of safeParse().success for consistency",
  },
];

/**
 * Lint README TypeScript code blocks for known API drift patterns.
 *
 * Rather than full compilation (which can't resolve template placeholder
 * imports), this checks for known anti-patterns like `result.ok` instead
 * of `result.isOk()` that indicate the example drifted from the real API.
 */
function findReadmeCodeAntiPatterns(
  workspaceRoot: string,
  artifactPaths: readonly string[]
): TemplateGuardrailFailure | undefined {
  const mdPaths = artifactPaths.filter(
    (p) =>
      (p.endsWith(".md") || p.endsWith(".template.md")) &&
      (p.includes("README") || p.includes("readme"))
  );

  const errors: string[] = [];

  for (const mdPath of mdPaths) {
    const fullPath = join(workspaceRoot, mdPath);
    const content = readFileSync(fullPath, "utf-8");
    const blocks = extractTypescriptBlocks(content);

    for (const block of blocks) {
      const trimmed = block.code.trim();
      if (trimmed.length < 10 || trimmed.split("\n").length < 3) {
        continue;
      }

      for (const check of README_CODE_ANTI_PATTERNS) {
        if (check.pattern.test(block.code)) {
          errors.push(`${mdPath}:${block.line} — ${check.message}`);
        }
      }
    }
  }

  if (errors.length === 0) {
    return undefined;
  }

  return {
    tool: "readme-typecheck",
    paths: mdPaths,
    output: errors.join("\n"),
  };
}

function runTool(
  workspaceRoot: string,
  cwd: string,
  tool: ExecutableGuardrailTool,
  args: readonly string[]
): TemplateGuardrailFailure | undefined {
  let executable = "";
  let command: string[] = [];

  switch (tool) {
    case "oxfmt":
      executable = join(workspaceRoot, "node_modules/.bin/oxfmt");
      command = ["--check", ...args];
      break;
    case "oxlint":
      executable = join(workspaceRoot, "node_modules/.bin/oxlint");
      command = [...args];
      break;
    case "ultracite":
      executable = join(workspaceRoot, "node_modules/.bin/ultracite");
      command = ["check", ...args];
      break;
  }

  const result = spawnSync(executable, command, {
    cwd,
    encoding: "utf-8",
    env: {
      ...process.env,
      PATH: [
        join(workspaceRoot, "node_modules/.bin"),
        process.env["PATH"] ?? "",
      ]
        .filter((value) => value.length > 0)
        .join(delimiter),
    },
  });

  if (result.status === 0) {
    return undefined;
  }

  const output = [result.stdout?.trim(), result.stderr?.trim()]
    .filter((value): value is string => Boolean(value))
    .join("\n");

  return {
    tool,
    paths: args,
    output,
  };
}

export async function runTemplateGuardrails(
  options: RunTemplateGuardrailsOptions
): Promise<TemplateGuardrailResult> {
  const workspaceRoot = resolve(options.workspaceRoot);
  const artifactPaths = collectArtifactPaths(workspaceRoot);
  const tempDir = mkdtempSync(join(workspaceRoot, ".tmp-template-guardrails-"));

  try {
    const mirroredPaths = mirrorArtifacts(
      workspaceRoot,
      tempDir,
      artifactPaths
    );
    const oxfmtPaths = mirroredPaths.filter((path) =>
      OXFMT_EXTENSIONS.has(extname(path))
    );
    const oxlintPaths = mirroredPaths.filter((path) =>
      OXLINT_EXTENSIONS.has(extname(path))
    );
    const ultracitePaths = mirroredPaths.filter((path) =>
      ULTRACITE_EXTENSIONS.has(extname(path))
    );
    const relativeOxlintPaths = oxlintPaths.map((path) =>
      relative(tempDir, path)
    );

    const failures = [
      findSchemaAnnotationFailure(workspaceRoot, artifactPaths),
      findReadmeCodeAntiPatterns(workspaceRoot, artifactPaths),
      oxfmtPaths.length > 0
        ? runTool(workspaceRoot, workspaceRoot, "oxfmt", [
            "--config",
            join(workspaceRoot, "packages/tooling/configs/.oxfmtrc.jsonc"),
            ...oxfmtPaths,
          ])
        : undefined,
      oxlintPaths.length > 0
        ? runTool(workspaceRoot, tempDir, "oxlint", [
            "--config",
            join(workspaceRoot, "packages/tooling/configs/.oxlintrc.json"),
            ...relativeOxlintPaths,
          ])
        : undefined,
      ultracitePaths.length > 0
        ? runTool(workspaceRoot, workspaceRoot, "ultracite", ultracitePaths)
        : undefined,
    ].filter(
      (failure): failure is TemplateGuardrailFailure => failure !== undefined
    );

    return {
      checkedPaths: artifactPaths,
      failures,
      ok: failures.length === 0,
    };
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}
