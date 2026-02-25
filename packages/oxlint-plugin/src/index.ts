import packageMetadata from "../package.json";
import { rules as ruleRegistry } from "./rules/index.js";

export interface OutfitterPlugin {
  readonly configs: Record<
    string,
    {
      readonly plugins: Record<string, unknown>;
      readonly rules: Record<string, unknown>;
    }
  >;
  readonly meta: {
    readonly name: string;
    readonly version: string;
  };
  readonly rules: Record<string, unknown>;
}

const plugin: OutfitterPlugin = {
  meta: {
    name: "@outfitter/oxlint-plugin",
    version: packageMetadata.version,
  },
  rules: ruleRegistry,
  configs: {},
};

// Attach recommended config after object creation so it can reference the
// plugin object itself without circular initialization problems.
plugin.configs["recommended"] = {
  plugins: {
    outfitter: plugin,
  },
  rules: {
    "outfitter/action-must-register": "warn",
    "outfitter/handler-must-return-result": "error",
    "outfitter/no-throw-in-handler": "error",
    "outfitter/no-console-in-packages": "error",
    "outfitter/no-cross-tier-import": "error",
    "outfitter/no-deep-relative-import": "warn",
    "outfitter/no-nested-barrel": "warn",
    "outfitter/no-process-exit-in-packages": "error",
    "outfitter/no-process-env-in-packages": "warn",
    "outfitter/max-file-lines": ["error", { warn: 200, error: 400 }],
    "outfitter/prefer-bun-api": "warn",
    "outfitter/snapshot-location": "warn",
    "outfitter/test-file-naming": "warn",
    "outfitter/use-error-taxonomy": "warn",
  },
};

export { rules } from "./rules/index.js";
export default plugin;
