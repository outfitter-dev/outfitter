import { runCheckDocsSentinelFromArgv } from "../apps/outfitter/src/commands/check-docs-sentinel.js";

export {
  checkDocsReadmeSentinelContent,
  printCheckDocsSentinelResult,
  runCheckDocsSentinel,
} from "../apps/outfitter/src/commands/check-docs-sentinel.js";
export type {
  CheckDocsSentinelResult,
  DocsReadmeSentinelCheckReason,
  DocsReadmeSentinelCheckResult,
} from "../apps/outfitter/src/commands/check-docs-sentinel.js";

if (import.meta.main) {
  void runCheckDocsSentinelFromArgv(process.argv.slice(2)).then((exitCode) => {
    process.exit(exitCode);
  });
}
