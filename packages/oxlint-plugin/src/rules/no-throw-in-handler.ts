import {
  isPackageSourceFile,
  type RuleContext,
  type RuleModule,
} from "./shared.js";

export const noThrowInHandlerRule: RuleModule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow throw statements in package source; return Result.err() instead.",
      recommended: true,
    },
    schema: [],
    messages: {
      noThrowInHandler:
        "Use Result.err() instead of throw in package handlers.",
    },
  },
  create(context: RuleContext) {
    if (!isPackageSourceFile(context.filename)) {
      return {};
    }

    return {
      ThrowStatement(node) {
        context.report({
          node,
          messageId: "noThrowInHandler",
        });
      },
    };
  },
};
