import {
  asLiteralString,
  type RuleContext,
  type RuleModule,
} from "./shared.js";

const DEFAULT_IMPORT_MAPPING: Record<string, string> = {
  "better-sqlite3": "bun:sqlite",
  crypto: "Bun.hash(), Bun.CryptoHasher",
  glob: "Bun.Glob",
  "node:crypto": "Bun.hash(), Bun.CryptoHasher",
  semver: "Bun.semver",
  uuid: "Bun.randomUUIDv7()",
};

function resolveImportMapping(
  options: readonly unknown[]
): Record<string, string> {
  const customMappings = (options[0] as { mappings?: unknown } | undefined)
    ?.mappings;

  if (!customMappings || typeof customMappings !== "object") {
    return DEFAULT_IMPORT_MAPPING;
  }

  const normalizedMappings: Record<string, string> = {};

  for (const [importName, alternative] of Object.entries(customMappings)) {
    if (typeof alternative === "string" && alternative.length > 0) {
      normalizedMappings[importName] = alternative;
    }
  }

  return {
    ...DEFAULT_IMPORT_MAPPING,
    ...normalizedMappings,
  };
}

function getImportSource(node: unknown): string | undefined {
  if (!node || typeof node !== "object") {
    return undefined;
  }

  if ((node as { type?: unknown }).type !== "ImportDeclaration") {
    return undefined;
  }

  return asLiteralString((node as { source?: unknown }).source);
}

export const preferBunApiRule: RuleModule = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Suggest Bun-native APIs when equivalent npm or Node imports are used.",
      recommended: true,
    },
    schema: [
      {
        type: "object",
        properties: {
          mappings: {
            type: "object",
            additionalProperties: {
              type: "string",
            },
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      preferBunApi:
        "Prefer Bun-native API over '{{importName}}': {{bunAlternative}}.",
    },
  },
  create(context: RuleContext) {
    const importMapping = resolveImportMapping(context.options);

    return {
      ImportDeclaration(node) {
        const importSource = getImportSource(node);

        if (!importSource) {
          return;
        }

        const bunAlternative = importMapping[importSource];

        if (!bunAlternative) {
          return;
        }

        context.report({
          node,
          messageId: "preferBunApi",
          data: {
            importName: importSource,
            bunAlternative,
          },
        });
      },
    };
  },
};
