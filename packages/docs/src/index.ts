/**
 * @outfitter/docs
 *
 * CLI and host command adapter for Outfitter docs workflows.
 *
 * @packageDocumentation
 */

export type { CreateDocsCommandOptions } from "./command/create-docs-command.js";
export { createDocsCommand } from "./command/create-docs-command.js";
export {
  type ExecuteCheckCommandOptions,
  executeCheckCommand,
} from "./commands/check.js";
export {
  type ExecuteSyncCommandOptions,
  executeSyncCommand,
} from "./commands/sync.js";
