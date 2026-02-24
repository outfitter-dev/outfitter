import {
  isPackageSourceFile,
  matchesMemberExpression,
  type RuleContext,
  type RuleModule,
} from "./shared.js";

export const noProcessEnvInPackagesRule: RuleModule = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Warn on process.env usage in packages/*/src. Prefer @outfitter/config or explicit context wiring.",
      recommended: true,
    },
    schema: [],
    messages: {
      noProcessEnvInPackages:
        "Avoid direct process.env access in packages source. Use @outfitter/config or pass env via context.",
    },
  },
  create(context: RuleContext) {
    if (!isPackageSourceFile(context.filename)) {
      return {};
    }

    return {
      MemberExpression(node) {
        if (
          !matchesMemberExpression({
            node,
            objectName: "process",
            propertyName: "env",
          })
        ) {
          return;
        }

        context.report({
          node,
          messageId: "noProcessEnvInPackages",
        });
      },
    };
  },
};
