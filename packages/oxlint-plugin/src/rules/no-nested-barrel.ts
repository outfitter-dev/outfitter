import {
  normalizeFilePath,
  type RuleContext,
  type RuleModule,
} from "./shared.js";

const PACKAGE_SOURCE_PATTERN = /(?:^|\/)packages\/[^/]+\/src\/(.+)$/u;

interface RuleOption {
  readonly maxDepth?: number;
}

function resolveOption(options: readonly unknown[]): RuleOption {
  const option = options[0];

  if (!option || typeof option !== "object") {
    return {};
  }

  return option as RuleOption;
}

/**
 * Compute the directory depth of an index.ts file relative to src/.
 *
 * `index.ts` → 1  (top-level barrel)
 * `colors/index.ts` → 2  (subpath export)
 * `theme/presets/index.ts` → 3  (nested subpath export)
 */
function getBarrelDepth(sourcePath: string): number {
  return sourcePath.split("/").length;
}

function isNestedPackageBarrel(filePath: string, maxDepth: number): boolean {
  const sourcePath = filePath.match(PACKAGE_SOURCE_PATTERN)?.[1];

  if (!sourcePath) {
    return false;
  }

  if (!sourcePath.endsWith("/index.ts") && sourcePath !== "index.ts") {
    return false;
  }

  const depth = getBarrelDepth(sourcePath);

  // depth 1 = src/index.ts (always allowed)
  // depth 2 = src/<dir>/index.ts (allowed when maxDepth >= 2)
  return depth > maxDepth;
}

export const noNestedBarrelRule: RuleModule = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Warn on nested package src/index.ts barrels that obscure module boundaries.",
      recommended: true,
    },
    schema: [
      {
        type: "object",
        properties: {
          maxDepth: {
            type: "integer",
            minimum: 1,
            description:
              "Maximum allowed barrel depth relative to src/. " +
              "1 = only src/index.ts, 2 = also src/<dir>/index.ts, etc.",
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      noNestedBarrel:
        "Avoid nested barrel files. Keep package barrel at packages/*/src/index.ts only.",
    },
  },
  create(context: RuleContext) {
    const option = resolveOption(context.options);
    const maxDepth = option.maxDepth ?? 1;

    return {
      Program(node) {
        const filePath = context.filename
          ? normalizeFilePath(context.filename)
          : undefined;

        if (!(filePath && isNestedPackageBarrel(filePath, maxDepth))) {
          return;
        }

        context.report({
          node,
          messageId: "noNestedBarrel",
        });
      },
    };
  },
};
