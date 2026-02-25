import { runCheckPublishGuardrailsFromArgv } from "../apps/outfitter/src/commands/check-publish-guardrails.js";

export {
  REQUIRED_PREPUBLISH_ONLY,
  findPublishGuardrailViolations,
  printCheckPublishGuardrailsResult,
  runCheckPublishGuardrails,
} from "../apps/outfitter/src/commands/check-publish-guardrails.js";
export type {
  PublishGuardrailViolation,
  WorkspacePackageManifest,
} from "../apps/outfitter/src/commands/check-publish-guardrails.js";

if (import.meta.main) {
  void runCheckPublishGuardrailsFromArgv(process.argv.slice(2)).then(
    (exitCode) => {
      process.exit(exitCode);
    }
  );
}
