import {
  extractPackageName,
  isPackageSourceFile,
  matchesMemberExpression,
  type RuleContext,
  type RuleModule,
} from "./shared.js";

interface RuleOption {
  readonly allowedPackages?: readonly string[];
}

function resolveOption(options: readonly unknown[]): RuleOption {
  const option = options[0];

  if (!option || typeof option !== "object") {
    return {};
  }

  return option as RuleOption;
}

function resolveAllowedPackages(option: RuleOption): ReadonlySet<string> {
  const packages = option.allowedPackages;

  if (!Array.isArray(packages)) {
    return new Set();
  }

  return new Set(packages.filter((p) => typeof p === "string"));
}

export const noProcessEnvInPackagesRule: RuleModule = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Warn on process.env usage in packages/*/src. Prefer @outfitter/config or explicit context wiring.",
      recommended: true,
    },
    schema: [
      {
        type: "object",
        properties: {
          allowedPackages: {
            type: "array",
            items: { type: "string" },
            uniqueItems: true,
            description:
              'Directory names (not npm package names) under packages/ to exempt, e.g. "config" for packages/config.',
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      noProcessEnvInPackages:
        "Avoid direct process.env access in packages source. Use @outfitter/config or pass env via context.",
    },
  },
  create(context: RuleContext) {
    if (!isPackageSourceFile(context.filename)) {
      return {};
    }

    const option = resolveOption(context.options);
    const allowedPackages = resolveAllowedPackages(option);
    const packageName = extractPackageName(context.filename);

    if (packageName && allowedPackages.has(packageName)) {
      return {};
    }

    return {
      MemberExpression(node) {
        if (
          !matchesMemberExpression({
            node,
            objectName: "process",
            propertyName: "env",
          })
        ) {
          return;
        }

        context.report({
          node,
          messageId: "noProcessEnvInPackages",
        });
      },
    };
  },
};
