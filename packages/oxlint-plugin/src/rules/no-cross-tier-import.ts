import {
  asIdentifierName,
  asLiteralString,
  normalizeFilePath,
  type RuleContext,
  type RuleModule,
} from "./shared.js";

type TierName = "foundation" | "runtime" | "tooling";

interface TierConfig {
  readonly foundation: readonly string[];
  readonly runtime: readonly string[];
  readonly tooling: readonly string[];
}

interface RuleOption {
  readonly tiers?: Partial<TierConfig>;
}

const DEFAULT_TIERS: TierConfig = {
  foundation: ["@outfitter/contracts", "@outfitter/types"],
  runtime: [
    "@outfitter/cli",
    "@outfitter/config",
    "@outfitter/daemon",
    "@outfitter/file-ops",
    "@outfitter/index",
    "@outfitter/logging",
    "@outfitter/mcp",
    "@outfitter/schema",
    "@outfitter/state",
    "@outfitter/tui",
  ],
  tooling: [
    "outfitter",
    "@outfitter/docs",
    "@outfitter/presets",
    "@outfitter/testing",
    "@outfitter/tooling",
  ],
};

const TIER_LEVEL: Readonly<Record<TierName, number>> = {
  foundation: 0,
  runtime: 1,
  tooling: 2,
};

function isStringArray(value: unknown): value is readonly string[] {
  return (
    Array.isArray(value) && value.every((entry) => typeof entry === "string")
  );
}

function resolveConfig(options: readonly unknown[]): {
  readonly tiers: TierConfig;
} {
  const option = (options[0] as RuleOption | undefined) ?? {};
  const optionTiers = option.tiers ?? {};

  const tiers: TierConfig = {
    foundation: isStringArray(optionTiers.foundation)
      ? optionTiers.foundation
      : DEFAULT_TIERS.foundation,
    runtime: isStringArray(optionTiers.runtime)
      ? optionTiers.runtime
      : DEFAULT_TIERS.runtime,
    tooling: isStringArray(optionTiers.tooling)
      ? optionTiers.tooling
      : DEFAULT_TIERS.tooling,
  };

  return {
    tiers,
  };
}

function getTierForPackage(
  tiers: TierConfig,
  packageName: string
): TierName | undefined {
  if (tiers.foundation.includes(packageName)) {
    return "foundation";
  }

  if (tiers.runtime.includes(packageName)) {
    return "runtime";
  }

  if (tiers.tooling.includes(packageName)) {
    return "tooling";
  }

  return undefined;
}

function resolveSourcePackage(
  filePath: string | undefined
): string | undefined {
  if (!filePath) {
    return undefined;
  }

  const normalizedPath = normalizeFilePath(filePath);
  const packageMatch = normalizedPath.match(
    /(?:^|\/)packages\/([^/]+)\/src\//u
  );

  if (packageMatch?.[1]) {
    return `@outfitter/${packageMatch[1]}`;
  }

  if (/(?:^|\/)apps\/outfitter\/src\//u.test(normalizedPath)) {
    return "outfitter";
  }

  return undefined;
}

function resolveImportedPackage(
  specifier: string | undefined
): string | undefined {
  if (!specifier) {
    return undefined;
  }

  if (specifier === "outfitter" || specifier.startsWith("outfitter/")) {
    return "outfitter";
  }

  if (!specifier.startsWith("@outfitter/")) {
    return undefined;
  }

  const [, packageName] = specifier.split("/", 3);
  return packageName ? `@outfitter/${packageName}` : undefined;
}

function isBoundaryViolation({
  sourceTier,
  targetTier,
}: {
  readonly sourceTier: TierName;
  readonly targetTier: TierName;
}): boolean {
  return TIER_LEVEL[sourceTier] < TIER_LEVEL[targetTier];
}

function getImportSourceFromImportDeclaration(
  node: unknown
): string | undefined {
  if (!node || typeof node !== "object") {
    return undefined;
  }

  if ((node as { type?: unknown }).type !== "ImportDeclaration") {
    return undefined;
  }

  return asLiteralString((node as { source?: unknown }).source);
}

function getImportSourceFromRequire(node: unknown): string | undefined {
  if (!node || typeof node !== "object") {
    return undefined;
  }

  if ((node as { type?: unknown }).type !== "CallExpression") {
    return undefined;
  }

  const callee = (node as { callee?: unknown }).callee;

  if (asIdentifierName(callee) !== "require") {
    return undefined;
  }

  const firstArgument = (node as { arguments?: readonly unknown[] })
    .arguments?.[0];
  return asLiteralString(firstArgument);
}

function getImportSourceFromExportDeclaration(
  node: unknown
): string | undefined {
  if (!node || typeof node !== "object") {
    return undefined;
  }

  const nodeType = (node as { type?: unknown }).type;

  if (
    !(
      nodeType === "ExportNamedDeclaration" ||
      nodeType === "ExportAllDeclaration"
    )
  ) {
    return undefined;
  }

  return asLiteralString((node as { source?: unknown }).source);
}

export const noCrossTierImportRule: RuleModule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Enforce Foundation/Runtime/Tooling import boundaries across Outfitter packages.",
      recommended: true,
    },
    schema: [
      {
        type: "object",
        properties: {
          tiers: {
            type: "object",
            properties: {
              foundation: {
                type: "array",
                items: { type: "string" },
              },
              runtime: {
                type: "array",
                items: { type: "string" },
              },
              tooling: {
                type: "array",
                items: { type: "string" },
              },
            },
            additionalProperties: false,
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      noCrossTierImport:
        "Invalid tier import: {{sourcePackage}} ({{sourceTier}}) cannot import {{targetPackage}} ({{targetTier}}).",
    },
  },
  create(context: RuleContext) {
    const { tiers } = resolveConfig(context.options);
    const sourcePackage = resolveSourcePackage(context.filename);

    if (!sourcePackage) {
      return {};
    }

    const sourceTier = getTierForPackage(tiers, sourcePackage);

    if (!sourceTier) {
      return {};
    }

    const reportIfViolation = (
      node: unknown,
      importSource: string | undefined
    ): void => {
      const targetPackage = resolveImportedPackage(importSource);

      if (!targetPackage) {
        return;
      }

      const targetTier = getTierForPackage(tiers, targetPackage);

      if (!(targetTier && isBoundaryViolation({ sourceTier, targetTier }))) {
        return;
      }

      context.report({
        node,
        messageId: "noCrossTierImport",
        data: {
          sourcePackage,
          sourceTier,
          targetPackage,
          targetTier,
        },
      });
    };

    return {
      ImportDeclaration(node) {
        reportIfViolation(node, getImportSourceFromImportDeclaration(node));
      },
      CallExpression(node) {
        reportIfViolation(node, getImportSourceFromRequire(node));
      },
      ExportNamedDeclaration(node) {
        reportIfViolation(node, getImportSourceFromExportDeclaration(node));
      },
      ExportAllDeclaration(node) {
        reportIfViolation(node, getImportSourceFromExportDeclaration(node));
      },
    };
  },
};
