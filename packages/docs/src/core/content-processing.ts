/**
 * Source content transforms for docs sync/check.
 *
 * @packageDocumentation
 */

import { dirname, extname, relative, resolve } from "node:path";

import { Result } from "better-result";

import { DocsCoreError, type PackageDocsError } from "./errors.js";
import {
  isPathInsideWorkspace,
  relativeToWorkspace,
  toPosixPath,
} from "./path-utils.js";
import type { DocsWarning, MdxMode } from "./types.js";

function splitMarkdownTarget(target: string): {
  pathPart: string;
  suffix: string;
  wrappedInAngles: boolean;
} {
  const trimmed = target.trim();
  if (trimmed.length === 0) {
    return { pathPart: target, suffix: "", wrappedInAngles: false };
  }

  // Keep optional title suffix untouched: "path \"title\"" or "path 'title'".
  const splitAt = trimmed.search(/\s/);
  const firstToken = splitAt >= 0 ? trimmed.slice(0, splitAt) : trimmed;
  const suffix = splitAt >= 0 ? trimmed.slice(splitAt) : "";

  const wrappedInAngles =
    firstToken.startsWith("<") &&
    firstToken.endsWith(">") &&
    firstToken.length > 2;
  const pathPart = wrappedInAngles ? firstToken.slice(1, -1) : firstToken;

  return { pathPart, suffix, wrappedInAngles };
}

function isRewritableRelativeTarget(pathPart: string): boolean {
  return !(
    pathPart.length === 0 ||
    pathPart.startsWith("#") ||
    pathPart.startsWith("/") ||
    pathPart.startsWith("http://") ||
    pathPart.startsWith("https://") ||
    pathPart.startsWith("mailto:") ||
    pathPart.startsWith("tel:") ||
    pathPart.startsWith("data:") ||
    pathPart.startsWith("//")
  );
}

function splitPathQueryAndHash(pathPart: string): {
  pathname: string;
  query: string;
  hash: string;
} {
  const hashIndex = pathPart.indexOf("#");
  const withNoHash = hashIndex >= 0 ? pathPart.slice(0, hashIndex) : pathPart;
  const hash = hashIndex >= 0 ? pathPart.slice(hashIndex) : "";

  const queryIndex = withNoHash.indexOf("?");
  const pathname =
    queryIndex >= 0 ? withNoHash.slice(0, queryIndex) : withNoHash;
  const query = queryIndex >= 0 ? withNoHash.slice(queryIndex) : "";

  return { pathname, query, hash };
}

function rewriteMarkdownLinkTarget(
  target: string,
  sourceAbsolutePath: string,
  destinationAbsolutePath: string,
  workspaceRoot: string,
  mirrorTargetBySourcePath: ReadonlyMap<string, string>
): string {
  const { pathPart, suffix, wrappedInAngles } = splitMarkdownTarget(target);
  if (!isRewritableRelativeTarget(pathPart)) {
    return target;
  }

  const { pathname, query, hash } = splitPathQueryAndHash(pathPart);
  if (pathname.length === 0) {
    return target;
  }

  const absoluteTarget = resolve(dirname(sourceAbsolutePath), pathname);
  if (!isPathInsideWorkspace(workspaceRoot, absoluteTarget)) {
    return target;
  }

  const rewrittenAbsoluteTarget =
    mirrorTargetBySourcePath.get(absoluteTarget) ?? absoluteTarget;

  let rewrittenPath = toPosixPath(
    relative(dirname(destinationAbsolutePath), rewrittenAbsoluteTarget)
  );

  if (rewrittenPath.length === 0) {
    rewrittenPath = "./";
  } else if (!rewrittenPath.startsWith(".")) {
    rewrittenPath = `./${rewrittenPath}`;
  }

  const rewritten = `${rewrittenPath}${query}${hash}`;
  const maybeWrapped = wrappedInAngles ? `<${rewritten}>` : rewritten;
  return `${maybeWrapped}${suffix}`;
}

export function rewriteMarkdownLinks(
  markdown: string,
  sourceAbsolutePath: string,
  destinationAbsolutePath: string,
  workspaceRoot: string,
  mirrorTargetBySourcePath: ReadonlyMap<string, string>
): string {
  return markdown.replace(
    /(!?\[[^\]]*]\()([^)]+)(\))/g,
    (_match, prefix: string, target: string, suffix: string) =>
      `${prefix}${rewriteMarkdownLinkTarget(
        target,
        sourceAbsolutePath,
        destinationAbsolutePath,
        workspaceRoot,
        mirrorTargetBySourcePath
      )}${suffix}`
  );
}

function getCodeFenceDelimiter(line: string): string | null {
  const fenceMatch = /^\s*(```+|~~~+)/u.exec(line);
  return fenceMatch?.at(1) ?? null;
}

function strictMdxError(input: {
  workspaceRoot: string;
  sourceAbsolutePath: string;
  lineNumber: number;
  syntax: string;
}): PackageDocsError {
  return DocsCoreError.validation(
    `Unsupported MDX syntax in strict mode: ${input.syntax}`,
    {
      line: input.lineNumber,
      path: relativeToWorkspace(input.workspaceRoot, input.sourceAbsolutePath),
      syntax: input.syntax,
    }
  );
}

export function processDocsSourceContent(input: {
  content: string;
  sourceAbsolutePath: string;
  workspaceRoot: string;
  mdxMode: MdxMode;
}): Result<
  { content: string; warnings: readonly DocsWarning[] },
  PackageDocsError
> {
  if (extname(input.sourceAbsolutePath).toLowerCase() !== ".mdx") {
    return Result.ok({ content: input.content, warnings: [] });
  }

  const warningPath = relativeToWorkspace(
    input.workspaceRoot,
    input.sourceAbsolutePath
  );
  const outputLines: string[] = [];
  const warnings: DocsWarning[] = [];
  const sourceLines = input.content.split(/\r?\n/u);
  let activeFenceDelimiter: string | null = null;

  for (let index = 0; index < sourceLines.length; index += 1) {
    const line = sourceLines[index] ?? "";
    const lineNumber = index + 1;
    const fenceDelimiter = getCodeFenceDelimiter(line);

    if (activeFenceDelimiter) {
      outputLines.push(line);
      if (
        fenceDelimiter &&
        fenceDelimiter[0] === activeFenceDelimiter[0] &&
        fenceDelimiter.length >= activeFenceDelimiter.length
      ) {
        activeFenceDelimiter = null;
      }
      continue;
    }

    if (fenceDelimiter) {
      activeFenceDelimiter = fenceDelimiter;
      outputLines.push(line);
      continue;
    }

    if (/^\s*(import|export)\s/u.test(line)) {
      if (input.mdxMode === "strict") {
        return Result.err(
          strictMdxError({
            workspaceRoot: input.workspaceRoot,
            sourceAbsolutePath: input.sourceAbsolutePath,
            lineNumber,
            syntax: "import/export statement",
          })
        );
      }

      warnings.push({
        message: `Removed import/export statement on line ${lineNumber}`,
        path: warningPath,
      });
      continue;
    }

    if (/^\s*<\/?[A-Z][\w.]*\b[^>]*>\s*$/u.test(line)) {
      if (input.mdxMode === "strict") {
        return Result.err(
          strictMdxError({
            workspaceRoot: input.workspaceRoot,
            sourceAbsolutePath: input.sourceAbsolutePath,
            lineNumber,
            syntax: "JSX component tag",
          })
        );
      }

      warnings.push({
        message: `Removed JSX component tag on line ${lineNumber}`,
        path: warningPath,
      });
      continue;
    }

    if (/^\s*\{.*\}\s*$/u.test(line)) {
      if (input.mdxMode === "strict") {
        return Result.err(
          strictMdxError({
            workspaceRoot: input.workspaceRoot,
            sourceAbsolutePath: input.sourceAbsolutePath,
            lineNumber,
            syntax: "expression block",
          })
        );
      }

      warnings.push({
        message: `Removed expression block on line ${lineNumber}`,
        path: warningPath,
      });
      continue;
    }

    if (/\{[^{}]+\}/u.test(line)) {
      if (input.mdxMode === "strict") {
        return Result.err(
          strictMdxError({
            workspaceRoot: input.workspaceRoot,
            sourceAbsolutePath: input.sourceAbsolutePath,
            lineNumber,
            syntax: "inline expression",
          })
        );
      }

      warnings.push({
        message: `Removed inline expression on line ${lineNumber}`,
        path: warningPath,
      });

      outputLines.push(
        line.replace(/\{[^{}]+\}/gu, "").replace(/[ \t]+$/u, "")
      );
      continue;
    }

    outputLines.push(line);
  }

  return Result.ok({
    content: outputLines.join("\n"),
    warnings,
  });
}
