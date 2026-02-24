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
    version: "0.1.0",
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
  rules: {},
};

export { rules } from "./rules/index.js";
export default plugin;
