import { maxFileLinesRule } from "./max-file-lines.js";
import { noConsoleInPackagesRule } from "./no-console-in-packages.js";
import { noProcessEnvInPackagesRule } from "./no-process-env-in-packages.js";
import { noProcessExitInPackagesRule } from "./no-process-exit-in-packages.js";
import { noThrowInHandlerRule } from "./no-throw-in-handler.js";
import { preferBunApiRule } from "./prefer-bun-api.js";
import type { RuleModule } from "./shared.js";

export const rules: Record<string, RuleModule> = {
  "max-file-lines": maxFileLinesRule,
  "no-console-in-packages": noConsoleInPackagesRule,
  "no-process-env-in-packages": noProcessEnvInPackagesRule,
  "no-process-exit-in-packages": noProcessExitInPackagesRule,
  "no-throw-in-handler": noThrowInHandlerRule,
  "prefer-bun-api": preferBunApiRule,
};
