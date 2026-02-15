/**
 * Errors demo section.
 *
 * Showcases error taxonomy and output formatting from @outfitter/contracts
 * and @outfitter/cli.
 *
 * @packageDocumentation
 */

import {
  AuthError,
  type ErrorCategory,
  exitCodeMap,
  NotFoundError,
  statusCodeMap,
  ValidationError,
} from "@outfitter/contracts";
import { createTheme, renderTable } from "@outfitter/tui/render";
import type { DemoSection } from "./registry.js";
import { registerSection } from "./registry.js";

/**
 * Error class information for demonstration.
 */
interface ErrorInfo {
  readonly name: string;
  readonly category: ErrorCategory;
}

/**
 * Gets all error classes with their categories.
 */
function getErrorInfos(): ErrorInfo[] {
  return [
    { name: "ValidationError", category: "validation" },
    { name: "NotFoundError", category: "not_found" },
    { name: "ConflictError", category: "conflict" },
    { name: "PermissionError", category: "permission" },
    { name: "TimeoutError", category: "timeout" },
    { name: "RateLimitError", category: "rate_limit" },
    { name: "NetworkError", category: "network" },
    { name: "InternalError", category: "internal" },
    { name: "AuthError", category: "auth" },
    { name: "CancelledError", category: "cancelled" },
  ];
}

/**
 * Formats an error for human-readable display (simulating CLI output).
 */
function formatErrorHuman(error: { _tag: string; message: string }): string {
  return `${error._tag}: ${error.message}`;
}

/**
 * Serializes an error for JSON display (simulating CLI output).
 */
function formatErrorJson(error: {
  _tag: string;
  message: string;
  category: string;
  context?: Record<string, unknown>;
}): string {
  const result: Record<string, unknown> = {
    message: error.message,
    _tag: error._tag,
    category: error.category,
  };
  if (error.context !== undefined) {
    result["context"] = error.context;
  }
  return JSON.stringify(result);
}

/**
 * Renders the errors demo section.
 */
function runErrorsDemo(): string {
  const theme = createTheme();
  const lines: string[] = [];

  // ==========================================================================
  // Error Output Section
  // ==========================================================================
  lines.push("ERROR OUTPUT");
  lines.push("============");
  lines.push("");
  lines.push('import { exitWithError } from "@outfitter/cli";');
  lines.push(
    'import { ValidationError, NotFoundError } from "@outfitter/contracts";'
  );
  lines.push("");

  // Human mode example
  const validationError = new ValidationError({
    message: "Invalid email format",
    field: "email",
  });
  lines.push("// Human mode (TTY):");
  lines.push(
    'exitWithError(new ValidationError({ message: "Invalid email format" }))'
  );
  lines.push(`→ stderr: "${formatErrorHuman(validationError)}"`);
  lines.push(`→ exit code: ${validationError.exitCode()}`);
  lines.push("");

  const notFoundError = new NotFoundError({
    message: "User not found",
    resourceType: "user",
    resourceId: "abc123",
  });
  lines.push(
    'exitWithError(new NotFoundError({ message: "User not found", ... }))'
  );
  lines.push(`→ stderr: "${formatErrorHuman(notFoundError)}"`);
  lines.push(`→ exit code: ${notFoundError.exitCode()}`);
  lines.push("");

  // JSON mode example
  lines.push("// JSON mode (pipe/CI):");
  const validationWithContext = new ValidationError({
    message: "Invalid email",
    field: "email",
  });
  lines.push(
    'exitWithError(new ValidationError({ message: "Invalid email", field: "email" }))'
  );
  lines.push(
    `→ stderr: ${formatErrorJson({
      ...validationWithContext,
      context: { field: "email" },
    })}`
  );
  lines.push(`→ exit code: ${validationWithContext.exitCode()}`);

  // ==========================================================================
  // Error Taxonomy Section
  // ==========================================================================
  lines.push("");
  lines.push("ERROR TAXONOMY → EXIT CODES");
  lines.push("===========================");
  lines.push("");

  const taxonomyData = getErrorInfos().map((info) => ({
    Category: info.category,
    "Exit Code": exitCodeMap[info.category],
    "HTTP Status": statusCodeMap[info.category],
    "Example Error": info.name,
  }));

  lines.push(renderTable(taxonomyData));

  // ==========================================================================
  // Creating Errors Section
  // ==========================================================================
  lines.push("");
  lines.push("CREATING ERRORS");
  lines.push("===============");
  lines.push("");
  lines.push(
    'import { ValidationError, NotFoundError, TimeoutError } from "@outfitter/contracts";'
  );
  lines.push("");

  // Example: ValidationError
  lines.push("// Input validation failed");
  lines.push(
    'new ValidationError({ message: "Email format invalid", field: "email" })'
  );
  lines.push("");

  // Example: NotFoundError
  lines.push("// Resource not found");
  lines.push(
    'new NotFoundError({ message: "note not found: abc123", resourceType: "note", resourceId: "abc123" })'
  );
  lines.push("");

  // Example: TimeoutError
  lines.push("// Operation timed out");
  lines.push(
    'new TimeoutError({ message: "Database query timed out", operation: "query", timeoutMs: 5000 })'
  );

  // ==========================================================================
  // Mode Detection Section
  // ==========================================================================
  lines.push("");
  lines.push("MODE DETECTION");
  lines.push("==============");
  lines.push("");
  lines.push("Output mode auto-detected:");
  lines.push("- TTY → human-readable format");
  lines.push("- Pipe/CI → JSON format");
  lines.push("- OUTFITTER_JSON=1 → force JSON");
  lines.push("- OUTFITTER_JSONL=1 → force JSONL");

  // ==========================================================================
  // Error Methods Section
  // ==========================================================================
  lines.push("");
  lines.push("ERROR METHODS");
  lines.push("=============");
  lines.push("");
  lines.push("All error classes provide:");
  lines.push("- .exitCode() → CLI exit code (from exitCodeMap)");
  lines.push("- .statusCode() → HTTP status code (from statusCodeMap)");
  lines.push("- .category → error category string");
  lines.push("- ._tag → error type name (e.g., 'ValidationError')");
  lines.push("");

  const authError = new AuthError({
    message: "Invalid token",
    reason: "expired",
  });
  lines.push(theme.muted("Example:"));
  lines.push(
    `const err = new AuthError({ message: "Invalid token", reason: "expired" })`
  );
  lines.push(`err.exitCode()   // ${authError.exitCode()}`);
  lines.push(`err.statusCode() // ${authError.statusCode()}`);
  lines.push(`err.category     // "${authError.category}"`);
  lines.push(`err._tag         // "${authError._tag}"`);

  return lines.join("\n");
}

// Register the errors section
registerSection({
  id: "errors",
  description: "Error taxonomy and output formatting",
  run: runErrorsDemo,
} satisfies DemoSection);

export { runErrorsDemo };
