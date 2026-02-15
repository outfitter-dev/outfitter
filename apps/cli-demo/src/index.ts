/**
 * CLI demo programmatic API.
 *
 * @packageDocumentation
 */

export {
  type DemoSection,
  getSection,
  getSectionIds,
  getSections,
  registerSection,
  runAllSections,
  runSection,
} from "./commands/demo/registry.js";
export {
  type DemoOptions,
  type DemoResult,
  printDemoResults,
  runDemo,
} from "./commands/demo.js";
export {
  type CliOutputMode,
  resolveOutputModeFromContext,
  resolveStructuredOutputMode,
  type StructuredOutputMode,
} from "./output-mode.js";
