/**
 * `outfitter demo` - Showcases @outfitter/cli rendering capabilities.
 *
 * A "Storybook for CLI" that demonstrates available rendering primitives
 * with copy-pasteable code examples.
 *
 * @packageDocumentation
 */

import { isCancel, select } from "@clack/prompts";
import { output } from "@outfitter/cli/output";
import { isInteractive } from "@outfitter/cli/terminal";
import { createTheme, renderTable, SPINNERS } from "@outfitter/tui/render";
import { ANSI } from "@outfitter/tui/streaming";
import {
  getSectionIds,
  getSections,
  runAllSections,
  runSection,
} from "./demo/registry.js";

// Import app-specific sections to register them
// Note: Primitive demos (colors, table, etc.) are now provided by @outfitter/cli/demo
import "./demo/errors.js";

// =============================================================================
// Types
// =============================================================================

/**
 * Options for the demo command.
 */
export interface DemoOptions {
  /** Section to run (undefined = run all) */
  readonly section?: string | undefined;
  /** List available sections instead of running */
  readonly list?: boolean | undefined;
  /** Run animated demo (spinners only) */
  readonly animate?: boolean | undefined;
}

/**
 * Result of running the demo command.
 */
export interface DemoResult {
  /** Output text to display */
  readonly output: string;
  /** Exit code (0 = success, 1 = error) */
  readonly exitCode: number;
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Runs the demo command programmatically.
 *
 * When no section is specified and running in an interactive terminal,
 * prompts the user to select a section.
 *
 * @param options - Demo options
 * @returns Demo result with output and exit code
 *
 * @example
 * ```typescript
 * // Run all sections
 * const result = await runDemo({});
 * console.log(result.output);
 *
 * // Run specific section
 * const result = await runDemo({ section: "colors" });
 *
 * // List available sections
 * const result = await runDemo({ list: true });
 * ```
 */
export async function runDemo(options: DemoOptions): Promise<DemoResult> {
  // Handle --list flag
  if (options.list) {
    return listSections();
  }

  // Handle --animate flag (spinners only)
  if (options.animate) {
    await runAnimatedSpinnerDemo();
    return { output: "", exitCode: 0 };
  }

  // Handle specific section
  if (options.section) {
    return runSectionByName(options.section);
  }

  // No section specified - show interactive picker if in TTY, otherwise run all
  if (isInteractive()) {
    const selectedSection = await selectSection();
    if (selectedSection === null) {
      return { output: "", exitCode: 130 }; // Cancelled
    }
    return runSectionByName(selectedSection);
  }

  // Non-interactive: run all sections
  const output = runAllSections();
  return { output, exitCode: 0 };
}

/**
 * Runs a section by name.
 */
function runSectionByName(sectionName: string): DemoResult {
  // Special case: "all" runs all sections
  if (sectionName === "all") {
    const output = runAllSections();
    return { output, exitCode: 0 };
  }

  const output = runSection(sectionName);
  if (output === undefined) {
    return {
      output: formatError(sectionName),
      exitCode: 1,
    };
  }
  return { output, exitCode: 0 };
}

/**
 * Prompts the user to select a demo section.
 *
 * @returns Selected section name, or null if cancelled
 */
async function selectSection(): Promise<string | null> {
  const sections = getSections();

  const options = [
    { value: "all", label: "All sections", hint: "Run all demos" },
    ...sections.map((s) => ({
      value: s.id,
      label: s.id,
      hint: s.description,
    })),
  ];

  const selection = await select({
    message: "Select a demo section",
    options,
  });

  if (isCancel(selection)) {
    return null;
  }

  return String(selection);
}

// =============================================================================
// Internal Helpers
// =============================================================================

/**
 * Lists available sections.
 */
function listSections(): DemoResult {
  const sections = getSections();
  const theme = createTheme();

  if (sections.length === 0) {
    return {
      output: theme.muted("No demo sections available."),
      exitCode: 0,
    };
  }

  const lines: string[] = [
    "Available demo sections:",
    "",
    renderTable(
      sections.map((s) => ({ section: s.id, description: s.description })),
      { headers: { section: "Section", description: "Description" } }
    ),
    "",
    theme.muted('Run "outfitter demo [section]" to run a specific section.'),
    theme.muted('Run "outfitter demo all" to run all sections.'),
  ];

  return { output: lines.join("\n"), exitCode: 0 };
}

/**
 * Formats an error message for unknown section.
 */
function formatError(sectionId: string): DemoResult["output"] {
  const theme = createTheme();
  const available = getSectionIds();

  const lines: string[] = [
    theme.error(`Unknown section: ${sectionId}`),
    "",
    `Available sections: ${available.length > 0 ? available.join(", ") : "(none)"}`,
    "",
    theme.muted('Run "outfitter demo --list" to see all sections.'),
  ];

  return lines.join("\n");
}

/**
 * Runs an animated spinner demo showing all spinner styles simultaneously.
 * Runs indefinitely until Ctrl+C.
 */
async function runAnimatedSpinnerDemo(): Promise<void> {
  const theme = createTheme();
  const styles = Object.keys(SPINNERS) as Array<keyof typeof SPINNERS>;
  const intervalMs = 80;

  const stream = process.stdout;
  const isTTY = stream.isTTY ?? false;
  const writeLine = (line: string): void => {
    stream.write(`${line}\n`);
  };

  writeLine("");
  writeLine(theme.bold("ANIMATED SPINNER DEMO"));
  writeLine(theme.muted("All styles running simultaneously"));
  writeLine(theme.muted("Press Ctrl+C to stop"));
  writeLine("");

  if (!isTTY) {
    // Non-TTY fallback: just show static frames
    for (const style of styles) {
      const spinner = SPINNERS[style];
      writeLine(`${style.padEnd(10)} ${spinner.frames.join(" ")}`);
    }
    return;
  }

  // Hide cursor and reserve lines
  stream.write(ANSI.hideCursor);
  const numLines = styles.length;

  // Print initial state
  for (const style of styles) {
    const spinner = SPINNERS[style];
    const frame = spinner.frames[0] ?? "";
    stream.write(
      `  ${frame}  ${style.padEnd(10)} ${theme.muted(`(${spinner.interval}ms)`)}\n`
    );
  }

  const frameIndices = styles.map(() => 0);

  // Animation loop
  const animate = (): void => {
    // Move cursor up to first spinner line
    stream.write(ANSI.cursorUp(numLines));

    for (let i = 0; i < styles.length; i++) {
      const style = styles[i];
      if (!style) continue;
      const spinner = SPINNERS[style];
      const frameIndex = frameIndices[i] ?? 0;
      const frame = spinner.frames[frameIndex % spinner.frames.length] ?? "";

      stream.write(ANSI.clearLine);
      stream.write(
        `  ${frame}  ${style.padEnd(10)} ${theme.muted(`(${spinner.interval}ms)`)}\n`
      );

      frameIndices[i] = frameIndex + 1;
    }
  };

  const timer = setInterval(animate, intervalMs);

  // Clean up on Ctrl+C
  const cleanup = (): void => {
    clearInterval(timer);
    stream.write(ANSI.showCursor);
    writeLine("");
    writeLine(theme.muted("Use createSpinner() from @outfitter/cli/streaming"));
    writeLine("");
    process.exit(0);
  };

  process.on("SIGINT", cleanup);

  // Keep running indefinitely (never resolves)
  await new Promise(() => {
    // Intentionally empty - promise never resolves to keep process alive
  });
}

/**
 * Outputs demo results.
 */
export async function printDemoResults(result: DemoResult): Promise<void> {
  if (result.output) {
    await output(result.output, { mode: "human" });
  }
}
