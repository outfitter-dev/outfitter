import { readFileSync } from "node:fs";

import {
  normalizeFilePath,
  type RuleContext,
  type RuleModule,
} from "./shared.js";

interface RuleOption {
  readonly registryFilePath?: string;
  readonly registrySourceText?: string;
}

interface ActionSourceFile {
  readonly moduleName: string;
  readonly repositoryRoot: string;
}

const ACTION_DEFINITION_PATTERN =
  /export\s+const\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*defineAction(?:\s*<[\s\S]*?>)?\s*\(/gu;
const ACTIONS_DIRECTORY_MARKER = "/apps/outfitter/src/actions/";
const RELATIVE_ACTIONS_DIRECTORY_PREFIX = "apps/outfitter/src/actions/";

function resolveOption(options: readonly unknown[]): RuleOption {
  const option = options[0];

  if (!option || typeof option !== "object") {
    return {};
  }

  return option as RuleOption;
}

function resolveActionSourceFile(
  filePath: string | undefined
): ActionSourceFile | undefined {
  if (!filePath) {
    return undefined;
  }

  const normalizedPath = normalizeFilePath(filePath);
  const markerIndex = normalizedPath.indexOf(ACTIONS_DIRECTORY_MARKER);
  const relativePrefixMatch = normalizedPath.startsWith(
    RELATIVE_ACTIONS_DIRECTORY_PREFIX
  );

  if (markerIndex < 0 && !relativePrefixMatch) {
    return undefined;
  }

  const moduleFileName =
    markerIndex >= 0
      ? normalizedPath.slice(markerIndex + ACTIONS_DIRECTORY_MARKER.length)
      : normalizedPath.slice(RELATIVE_ACTIONS_DIRECTORY_PREFIX.length);

  if (!moduleFileName.endsWith(".ts") || moduleFileName.includes("/")) {
    return undefined;
  }

  const repositoryRoot =
    markerIndex >= 0 ? normalizedPath.slice(0, markerIndex) : ".";

  return {
    repositoryRoot,
    moduleName: moduleFileName.slice(0, -3),
  };
}

function extractDefinedActionNames(sourceText: string): readonly string[] {
  const actionNames = new Set<string>();

  for (const match of sourceText.matchAll(ACTION_DEFINITION_PATTERN)) {
    if (match[1]) {
      actionNames.add(match[1]);
    }
  }

  return Array.from(actionNames);
}

function escapeForRegExp(value: string): string {
  return value.replaceAll(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function extractImportedNamesForModule({
  moduleName,
  registrySourceText,
}: {
  readonly moduleName: string;
  readonly registrySourceText: string;
}): ReadonlySet<string> {
  const moduleSpecifier = `./actions/${moduleName}.js`;
  const escapedModuleSpecifier = escapeForRegExp(moduleSpecifier);
  const importPattern = new RegExp(
    `import\\s*\\{([\\s\\S]*?)\\}\\s*from\\s*["']${escapedModuleSpecifier}["'];`,
    "gu"
  );

  const importedNames = new Set<string>();

  for (const match of registrySourceText.matchAll(importPattern)) {
    const importsBlock = match[1];

    if (!importsBlock) {
      continue;
    }

    for (const rawImport of importsBlock.split(",")) {
      const importEntry = rawImport.trim();

      if (importEntry.length === 0) {
        continue;
      }

      const importedName = importEntry.split(/\s+as\s+/u)[0]?.trim();

      if (importedName) {
        importedNames.add(importedName);
      }
    }
  }

  return importedNames;
}

function resolveRegistrySourceText({
  option,
  repositoryRoot,
}: {
  readonly option: RuleOption;
  readonly repositoryRoot: string;
}): string | undefined {
  if (
    typeof option.registrySourceText === "string" &&
    option.registrySourceText.length > 0
  ) {
    return option.registrySourceText;
  }

  const registryFilePath =
    typeof option.registryFilePath === "string" &&
    option.registryFilePath.length > 0
      ? option.registryFilePath
      : `${repositoryRoot}/apps/outfitter/src/actions.ts`;

  try {
    return readFileSync(registryFilePath, "utf8");
  } catch {
    return undefined;
  }
}

export const actionMustRegisterRule: RuleModule = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Warn when defineAction() exports in apps/outfitter/src/actions are not imported in apps/outfitter/src/actions.ts.",
      recommended: true,
    },
    schema: [
      {
        type: "object",
        properties: {
          registryFilePath: {
            type: "string",
          },
          registrySourceText: {
            type: "string",
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      actionMustRegister:
        "Action '{{actionName}}' is defined with defineAction() but is not imported in apps/outfitter/src/actions.ts.",
    },
  },
  create(context: RuleContext) {
    const actionSourceFile = resolveActionSourceFile(context.filename);

    if (!actionSourceFile) {
      return {};
    }

    const sourceText = context.sourceCode?.getText() ?? "";
    const definedActionNames = extractDefinedActionNames(sourceText);

    if (definedActionNames.length === 0) {
      return {};
    }

    const option = resolveOption(context.options);
    const registrySourceText = resolveRegistrySourceText({
      option,
      repositoryRoot: actionSourceFile.repositoryRoot,
    });

    if (!registrySourceText) {
      return {};
    }

    const importedNames = extractImportedNamesForModule({
      moduleName: actionSourceFile.moduleName,
      registrySourceText,
    });

    const missingActionNames = definedActionNames.filter(
      (actionName) => !importedNames.has(actionName)
    );

    if (missingActionNames.length === 0) {
      return {};
    }

    return {
      Program(node) {
        for (const actionName of missingActionNames) {
          context.report({
            node,
            messageId: "actionMustRegister",
            data: {
              actionName,
            },
          });
        }
      },
    };
  },
};
