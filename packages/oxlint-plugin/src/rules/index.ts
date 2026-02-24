import { handlerMustReturnResultRule } from "./handler-must-return-result.js";
import { maxFileLinesRule } from "./max-file-lines.js";
import { noConsoleInPackagesRule } from "./no-console-in-packages.js";
import { noCrossTierImportRule } from "./no-cross-tier-import.js";
import { noDeepRelativeImportRule } from "./no-deep-relative-import.js";
import { noProcessEnvInPackagesRule } from "./no-process-env-in-packages.js";
import { noProcessExitInPackagesRule } from "./no-process-exit-in-packages.js";
import { noThrowInHandlerRule } from "./no-throw-in-handler.js";
import { preferBunApiRule } from "./prefer-bun-api.js";
import type { RuleModule } from "./shared.js";
import { useErrorTaxonomyRule } from "./use-error-taxonomy.js";

export const rules: Record<string, RuleModule> = {
  "handler-must-return-result": handlerMustReturnResultRule,
  "max-file-lines": maxFileLinesRule,
  "no-console-in-packages": noConsoleInPackagesRule,
  "no-cross-tier-import": noCrossTierImportRule,
  "no-deep-relative-import": noDeepRelativeImportRule,
  "no-process-env-in-packages": noProcessEnvInPackagesRule,
  "no-process-exit-in-packages": noProcessExitInPackagesRule,
  "no-throw-in-handler": noThrowInHandlerRule,
  "prefer-bun-api": preferBunApiRule,
  "use-error-taxonomy": useErrorTaxonomyRule,
};
