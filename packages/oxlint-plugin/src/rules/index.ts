import { actionMustRegisterRule } from "./action-must-register.js";
import { handlerMustReturnResultRule } from "./handler-must-return-result.js";
import { maxFileLinesRule } from "./max-file-lines.js";
import { noConsoleInPackagesRule } from "./no-console-in-packages.js";
import { noCrossTierImportRule } from "./no-cross-tier-import.js";
import { noDeepRelativeImportRule } from "./no-deep-relative-import.js";
import { noNestedBarrelRule } from "./no-nested-barrel.js";
import { noProcessEnvInPackagesRule } from "./no-process-env-in-packages.js";
import { noProcessExitInPackagesRule } from "./no-process-exit-in-packages.js";
import { noThrowInHandlerRule } from "./no-throw-in-handler.js";
import { preferBunApiRule } from "./prefer-bun-api.js";
import type { RuleModule } from "./shared.js";
import { snapshotLocationRule } from "./snapshot-location.js";
import { testFileNamingRule } from "./test-file-naming.js";
import { useErrorTaxonomyRule } from "./use-error-taxonomy.js";

export const rules: Record<string, RuleModule> = {
  "action-must-register": actionMustRegisterRule,
  "handler-must-return-result": handlerMustReturnResultRule,
  "max-file-lines": maxFileLinesRule,
  "no-console-in-packages": noConsoleInPackagesRule,
  "no-cross-tier-import": noCrossTierImportRule,
  "no-deep-relative-import": noDeepRelativeImportRule,
  "no-nested-barrel": noNestedBarrelRule,
  "no-process-env-in-packages": noProcessEnvInPackagesRule,
  "no-process-exit-in-packages": noProcessExitInPackagesRule,
  "no-throw-in-handler": noThrowInHandlerRule,
  "prefer-bun-api": preferBunApiRule,
  "snapshot-location": snapshotLocationRule,
  "test-file-naming": testFileNamingRule,
  "use-error-taxonomy": useErrorTaxonomyRule,
};
