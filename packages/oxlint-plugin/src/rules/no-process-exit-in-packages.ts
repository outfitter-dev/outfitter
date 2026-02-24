import {
  invokesMemberCall,
  isPackageSourceFile,
  type RuleContext,
  type RuleModule,
} from "./shared.js";

export const noProcessExitInPackagesRule: RuleModule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow process.exit() in packages/*/src. Exits should only occur in CLI adapters.",
      recommended: true,
    },
    schema: [],
    messages: {
      noProcessExitInPackages:
        "Do not call process.exit() in packages source. Return a Result and let transport adapters exit.",
    },
  },
  create(context: RuleContext) {
    if (!isPackageSourceFile(context.filename)) {
      return {};
    }

    return {
      CallExpression(node) {
        if (
          !invokesMemberCall({
            node,
            objectName: "process",
            propertyName: "exit",
          })
        ) {
          return;
        }

        context.report({
          node,
          messageId: "noProcessExitInPackages",
        });
      },
    };
  },
};
