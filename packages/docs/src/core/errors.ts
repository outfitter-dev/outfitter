/**
 * Error types for docs-core.
 *
 * @packageDocumentation
 */

export class DocsCoreError extends Error {
  readonly _tag = "DocsCoreError" as const;
  readonly category: "validation" | "internal";
  readonly context: Record<string, unknown> | undefined;

  constructor(input: {
    message: string;
    category: "validation" | "internal";
    context?: Record<string, unknown>;
  }) {
    super(input.message);
    this.name = "DocsCoreError";
    this.category = input.category;
    this.context = input.context;
  }

  static validation(
    message: string,
    context?: Record<string, unknown>
  ): DocsCoreError {
    return new DocsCoreError({
      message,
      category: "validation",
      ...(context ? { context } : {}),
    });
  }

  static internal(
    message: string,
    context?: Record<string, unknown>
  ): DocsCoreError {
    return new DocsCoreError({
      message,
      category: "internal",
      ...(context ? { context } : {}),
    });
  }
}

export type PackageDocsError = DocsCoreError;
