import {
  asIdentifierName,
  isPackageSourceFile,
  normalizeFilePath,
  type RuleContext,
  type RuleModule,
} from "./shared.js";

const CONTRACTS_PACKAGE_SRC_PATTERN = /(?:^|\/)packages\/contracts\/src\//u;

function isContractsSourceFile(filePath: string | undefined): boolean {
  if (!filePath) {
    return false;
  }

  return CONTRACTS_PACKAGE_SRC_PATTERN.test(normalizeFilePath(filePath));
}

function extendsNativeError(node: unknown): boolean {
  if (!node || typeof node !== "object") {
    return false;
  }

  const nodeType = (node as { type?: unknown }).type;

  if (nodeType !== "ClassDeclaration" && nodeType !== "ClassExpression") {
    return false;
  }

  const superClass = (node as { superClass?: unknown }).superClass;
  return asIdentifierName(superClass) === "Error";
}

export const useErrorTaxonomyRule: RuleModule = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Encourage package code to use @outfitter/contracts error taxonomy instead of extending Error directly.",
      recommended: true,
    },
    schema: [],
    messages: {
      useErrorTaxonomy:
        "Prefer @outfitter/contracts error taxonomy categories over extending Error directly.",
    },
  },
  create(context: RuleContext) {
    if (!isPackageSourceFile(context.filename)) {
      return {};
    }

    if (isContractsSourceFile(context.filename)) {
      return {};
    }

    const reportIfExtendsError = (node: unknown): void => {
      if (!extendsNativeError(node)) {
        return;
      }

      context.report({
        node,
        messageId: "useErrorTaxonomy",
      });
    };

    return {
      ClassDeclaration(node) {
        reportIfExtendsError(node);
      },
      ClassExpression(node) {
        reportIfExtendsError(node);
      },
    };
  },
};
