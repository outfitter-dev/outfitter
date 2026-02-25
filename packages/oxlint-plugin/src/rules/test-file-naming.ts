import {
  normalizeFilePath,
  type RuleContext,
  type RuleModule,
} from "./shared.js";

const SPEC_FILE_PATTERN = /\.spec\.[cm]?[jt]sx?$/u;

export const testFileNamingRule: RuleModule = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Warn when test files use .spec.* naming instead of Bun's .test.* convention.",
      recommended: true,
    },
    schema: [],
    messages: {
      testFileNaming:
        "Use .test.ts naming instead of .spec.ts for Bun test files.",
    },
  },
  create(context: RuleContext) {
    return {
      Program(node) {
        const filePath = context.filename
          ? normalizeFilePath(context.filename)
          : undefined;

        if (!(filePath && SPEC_FILE_PATTERN.test(filePath))) {
          return;
        }

        context.report({
          node,
          messageId: "testFileNaming",
        });
      },
    };
  },
};
