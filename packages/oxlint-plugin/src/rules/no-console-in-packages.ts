import {
  invokesMemberCall,
  isPackageSourceFile,
  type RuleContext,
  type RuleModule,
} from "./shared.js";

export const noConsoleInPackagesRule: RuleModule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow console.* calls in packages/*/src source files (except tests).",
      recommended: true,
    },
    schema: [],
    messages: {
      noConsoleInPackages:
        "Avoid console.* in packages source. Route diagnostics through @outfitter/logging.",
    },
  },
  create(context: RuleContext) {
    if (!isPackageSourceFile(context.filename)) {
      return {};
    }

    return {
      CallExpression(node) {
        if (!invokesMemberCall({ node, objectName: "console" })) {
          return;
        }

        context.report({
          node,
          messageId: "noConsoleInPackages",
        });
      },
    };
  },
};
