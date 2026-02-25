import {
  normalizeFilePath,
  type RuleContext,
  type RuleModule,
} from "./shared.js";

const SNAPSHOT_FILE_PATTERN = /\.snap$/u;
const SNAPSHOT_DIRECTORY_PATTERN = /(?:^|\/)__snapshots__\//u;

export const snapshotLocationRule: RuleModule = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Warn when snapshot files are not placed in __snapshots__ directories.",
      recommended: true,
    },
    schema: [],
    messages: {
      snapshotLocation:
        "Place snapshot files inside a __snapshots__/ directory.",
    },
  },
  create(context: RuleContext) {
    return {
      Program(node) {
        const filePath = context.filename
          ? normalizeFilePath(context.filename)
          : undefined;

        if (!(filePath && SNAPSHOT_FILE_PATTERN.test(filePath))) {
          return;
        }

        if (SNAPSHOT_DIRECTORY_PATTERN.test(filePath)) {
          return;
        }

        context.report({
          node,
          messageId: "snapshotLocation",
        });
      },
    };
  },
};
