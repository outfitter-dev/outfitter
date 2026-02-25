import {
  getImportSourceFromImportDeclaration,
  getImportSourceFromRequire,
  isPackageSourceFile,
  type RuleContext,
  type RuleModule,
} from "./shared.js";

interface RuleOption {
  readonly maxParentSegments?: number;
}

const DEFAULT_MAX_PARENT_SEGMENTS = 2;

function resolveMaxParentSegments(options: readonly unknown[]): number {
  const candidate = (options[0] as RuleOption | undefined)?.maxParentSegments;

  if (
    typeof candidate === "number" &&
    Number.isInteger(candidate) &&
    candidate >= 0
  ) {
    return candidate;
  }

  return DEFAULT_MAX_PARENT_SEGMENTS;
}

function countLeadingParentSegments(importSource: string): number {
  let count = 0;

  for (const segment of importSource.split("/")) {
    if (segment !== "..") {
      break;
    }

    count += 1;
  }

  return count;
}

export const noDeepRelativeImportRule: RuleModule = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Warn on deep relative imports in package source; prefer @outfitter/* package imports.",
      recommended: true,
    },
    schema: [
      {
        type: "object",
        properties: {
          maxParentSegments: {
            type: "integer",
            minimum: 0,
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      noDeepRelativeImport:
        "Deep relative import '{{importSource}}' exceeds max parent depth ({{maxParentSegments}}). Prefer @outfitter/* package imports.",
    },
  },
  create(context: RuleContext) {
    if (!isPackageSourceFile(context.filename)) {
      return {};
    }

    const maxParentSegments = resolveMaxParentSegments(context.options);

    const reportIfDeepRelativeImport = (
      node: unknown,
      importSource: string | undefined
    ): void => {
      if (!importSource?.startsWith("..")) {
        return;
      }

      const parentSegmentCount = countLeadingParentSegments(importSource);

      if (parentSegmentCount <= maxParentSegments) {
        return;
      }

      context.report({
        node,
        messageId: "noDeepRelativeImport",
        data: {
          importSource,
          maxParentSegments,
        },
      });
    };

    return {
      ImportDeclaration(node) {
        reportIfDeepRelativeImport(
          node,
          getImportSourceFromImportDeclaration(node)
        );
      },
      CallExpression(node) {
        reportIfDeepRelativeImport(node, getImportSourceFromRequire(node));
      },
    };
  },
};
