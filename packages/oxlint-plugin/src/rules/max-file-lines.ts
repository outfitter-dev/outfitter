import {
  isPackageSourceFile,
  type RuleContext,
  type RuleModule,
} from "./shared.js";

interface MaxFileLinesOptions {
  readonly error: number;
  readonly warn: number;
}

const DEFAULT_WARN_LIMIT = 200;
const DEFAULT_ERROR_LIMIT = 400;

function toPositiveInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : undefined;
}

function resolveOptions(options: readonly unknown[]): MaxFileLinesOptions {
  const firstOption = options[0];

  if (!firstOption || typeof firstOption !== "object") {
    return { warn: DEFAULT_WARN_LIMIT, error: DEFAULT_ERROR_LIMIT };
  }

  const warnCandidate = toPositiveInteger(
    (firstOption as { warn?: unknown }).warn
  );
  const errorCandidate = toPositiveInteger(
    (firstOption as { error?: unknown }).error
  );

  const warnLimit = warnCandidate ?? DEFAULT_WARN_LIMIT;
  const errorLimit = errorCandidate ?? DEFAULT_ERROR_LIMIT;

  if (errorLimit <= warnLimit) {
    return { warn: warnLimit, error: warnLimit + 1 };
  }

  return { warn: warnLimit, error: errorLimit };
}

function countLines(sourceText: string): number {
  if (sourceText.length === 0) {
    return 0;
  }

  return sourceText.split(/\r\n|\n|\r/u).length;
}

export const maxFileLinesRule: RuleModule = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Warn or error when package source files exceed configured line-count thresholds.",
      recommended: true,
    },
    schema: [
      {
        type: "object",
        properties: {
          warn: { type: "integer", minimum: 1 },
          error: { type: "integer", minimum: 1 },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      fileTooLongWarn:
        "File has {{lineCount}} lines (warn threshold: {{warnLimit}}). Consider splitting into smaller modules.",
      fileTooLongError:
        "File has {{lineCount}} lines (error threshold: {{errorLimit}}). Split this file before adding more code.",
    },
  },
  create(context: RuleContext) {
    if (!isPackageSourceFile(context.filename)) {
      return {};
    }

    const { warn, error } = resolveOptions(context.options);

    return {
      Program(node) {
        const lineCount = countLines(context.sourceCode?.getText() ?? "");

        if (lineCount > error) {
          context.report({
            node,
            messageId: "fileTooLongError",
            data: {
              lineCount,
              errorLimit: error,
            },
          });
          return;
        }

        if (lineCount > warn) {
          context.report({
            node,
            messageId: "fileTooLongWarn",
            data: {
              lineCount,
              warnLimit: warn,
            },
          });
        }
      },
    };
  },
};
