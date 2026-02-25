import {
  normalizeFilePath,
  type RuleContext,
  type RuleModule,
} from "./shared.js";

const PACKAGE_SOURCE_PATTERN = /(?:^|\/)packages\/[^/]+\/src\/(.+)$/u;

function isNestedPackageBarrel(filePath: string): boolean {
  const sourcePath = filePath.match(PACKAGE_SOURCE_PATTERN)?.[1];

  if (!sourcePath) {
    return false;
  }

  if (sourcePath === "index.ts") {
    return false;
  }

  return sourcePath.endsWith("/index.ts");
}

export const noNestedBarrelRule: RuleModule = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Warn on nested package src/index.ts barrels that obscure module boundaries.",
      recommended: true,
    },
    schema: [],
    messages: {
      noNestedBarrel:
        "Avoid nested barrel files. Keep package barrel at packages/*/src/index.ts only.",
    },
  },
  create(context: RuleContext) {
    return {
      Program(node) {
        const filePath = context.filename
          ? normalizeFilePath(context.filename)
          : undefined;

        if (!(filePath && isNestedPackageBarrel(filePath))) {
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
