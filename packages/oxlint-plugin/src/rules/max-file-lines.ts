import {
  isPackageSourceFile,
  type RuleContext,
  type RuleModule,
} from "./shared.js";

interface MaxFileLinesOptions {
  readonly error: number;
  readonly extensions: readonly string[];
  readonly warn: number;
}

const DEFAULT_EXTENSIONS: readonly string[] = [
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mts",
  ".cts",
  ".mjs",
  ".cjs",
];

const DEFAULT_WARN_LIMIT = 200;
const DEFAULT_ERROR_LIMIT = 400;

function toPositiveInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : undefined;
}

function resolveExtensions(value: unknown): readonly string[] {
  if (!Array.isArray(value)) {
    return DEFAULT_EXTENSIONS;
  }

  const filtered = value.filter(
    (item): item is string => typeof item === "string" && item.startsWith(".")
  );

  return filtered.length > 0 ? filtered : DEFAULT_EXTENSIONS;
}

function resolveOptions(options: readonly unknown[]): MaxFileLinesOptions {
  const firstOption = options[0];

  if (!firstOption || typeof firstOption !== "object") {
    return {
      warn: DEFAULT_WARN_LIMIT,
      error: DEFAULT_ERROR_LIMIT,
      extensions: DEFAULT_EXTENSIONS,
    };
  }

  const warnCandidate = toPositiveInteger(
    (firstOption as { warn?: unknown }).warn
  );
  const errorCandidate = toPositiveInteger(
    (firstOption as { error?: unknown }).error
  );

  const warnLimit = warnCandidate ?? DEFAULT_WARN_LIMIT;
  const errorLimit = errorCandidate ?? DEFAULT_ERROR_LIMIT;

  const extensions = resolveExtensions(
    (firstOption as { extensions?: unknown }).extensions
  );

  if (errorLimit <= warnLimit) {
    return { warn: warnLimit, error: warnLimit + 1, extensions };
  }

  return { warn: warnLimit, error: errorLimit, extensions };
}

function countLines(sourceText: string): number {
  if (sourceText.length === 0) {
    return 0;
  }

  const normalizedSourceText = sourceText
    .replace(/\r\n/gu, "\n")
    .replace(/\r/gu, "\n");
  const newlineCount = normalizedSourceText.match(/\n/gu)?.length ?? 0;
  return normalizedSourceText.endsWith("\n") ? newlineCount : newlineCount + 1;
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
          extensions: {
            type: "array",
            items: { type: "string", pattern: "^\\." },
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      fileTooLongWarn:
        "File has {{lineCount}} lines (warn threshold: {{warnLimit}}). Consider extracting implementation into src/internal/ modules.",
      fileTooLongError:
        "File has {{lineCount}} lines (error threshold: {{errorLimit}}). Extract implementation into src/internal/ modules before adding more code. See docs/reference/file-splitting.md.",
    },
  },
  create(context: RuleContext) {
    if (!isPackageSourceFile(context.filename)) {
      return {};
    }

    const { warn, error, extensions } = resolveOptions(context.options);
    const filename = context.filename ?? "";

    if (!extensions.some((ext) => filename.endsWith(ext))) {
      return {};
    }

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
