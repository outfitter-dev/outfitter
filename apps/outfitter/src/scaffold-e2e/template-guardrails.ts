/**
 * Lightweight guardrails for scaffold source artifacts.
 *
 * These checks mirror preset templates into a temp workspace with their
 * `.template` suffix removed, then run the same format/lint tools we expect
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
import { delimiter, dirname, join, relative, resolve } from "node:path";

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

type GuardrailTool = "oxfmt" | "oxlint" | "schema-annotation" | "ultracite";

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

function stripTemplateSuffix(filePath: string): string {
  return filePath.endsWith(".template")
    ? filePath.slice(0, -".template".length)
    : filePath;
}

function fileExtension(filePath: string): string {
  const segments = filePath.split("/");
  const fileName = segments[segments.length - 1] ?? "";
  const dotIndex = fileName.indexOf(".");
  if (dotIndex === -1) {
    return "";
  }

  return fileName.slice(dotIndex);
}

function collectArtifactPaths(workspaceRoot: string): string[] {
  const templateGlob = new Bun.Glob("packages/presets/presets/**/*.template");
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
    const destinationRelativePath = stripTemplateSuffix(sourcePath);
    const destinationPath = join(tempDir, destinationRelativePath);

    mkdirSync(dirname(destinationPath), { recursive: true });
    writeFileSync(
      destinationPath,
      readFileSync(join(workspaceRoot, sourcePath), "utf-8")
    );
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
    .filter((path) => path.endsWith(".ts") || path.endsWith(".ts.template"))
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

function runTool(
  workspaceRoot: string,
  cwd: string,
  tool: GuardrailTool,
  args: readonly string[]
): TemplateGuardrailFailure | undefined {
  const executable =
    tool === "oxfmt"
      ? join(workspaceRoot, "node_modules/.bin/oxfmt")
      : tool === "oxlint"
        ? join(workspaceRoot, "node_modules/.bin/oxlint")
        : join(workspaceRoot, "node_modules/.bin/ultracite");
  const command =
    tool === "oxfmt"
      ? ["--check", ...args]
      : tool === "oxlint"
        ? [...args]
        : ["check", ...args];

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
      OXFMT_EXTENSIONS.has(fileExtension(path))
    );
    const oxlintPaths = mirroredPaths.filter((path) =>
      OXLINT_EXTENSIONS.has(fileExtension(path))
    );
    const ultracitePaths = mirroredPaths.filter((path) =>
      ULTRACITE_EXTENSIONS.has(fileExtension(path))
    );
    const relativeOxlintPaths = oxlintPaths.map((path) =>
      relative(tempDir, path)
    );

    const failures = [
      findSchemaAnnotationFailure(workspaceRoot, artifactPaths),
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
