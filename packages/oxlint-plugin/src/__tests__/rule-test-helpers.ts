import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { RuleContext, RuleModule } from "../rules/shared.js";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(TEST_DIR, "fixtures");

export interface CapturedReport {
  readonly data?: Record<string, string | number>;
  readonly messageId: string;
  readonly node: unknown;
}

export function readFixture(relativePath: string): string {
  return readFileSync(join(FIXTURES_DIR, relativePath), "utf8");
}

export function countPattern(sourceText: string, pattern: RegExp): number {
  return Array.from(sourceText.matchAll(pattern)).length;
}

export function createThrowStatementNode(): unknown {
  return { type: "ThrowStatement" };
}

export function createCallExpressionNode(
  objectName: string,
  propertyName: string
): unknown {
  return {
    type: "CallExpression",
    callee: {
      type: "MemberExpression",
      computed: false,
      object: {
        type: "Identifier",
        name: objectName,
      },
      property: {
        type: "Identifier",
        name: propertyName,
      },
    },
  };
}

export function createMemberExpressionNode(
  objectName: string,
  propertyName: string
): unknown {
  return {
    type: "MemberExpression",
    computed: false,
    object: {
      type: "Identifier",
      name: objectName,
    },
    property: {
      type: "Identifier",
      name: propertyName,
    },
  };
}

export function createImportDeclarationNode(importSource: string): unknown {
  return {
    type: "ImportDeclaration",
    source: {
      type: "Literal",
      value: importSource,
    },
  };
}

export function createRequireCallNode(importSource: string): unknown {
  return {
    type: "CallExpression",
    callee: {
      type: "Identifier",
      name: "require",
    },
    arguments: [
      {
        type: "Literal",
        value: importSource,
      },
    ],
  };
}

export function runRuleForEvent({
  event,
  filename,
  nodes,
  options,
  rule,
  sourceText,
}: {
  readonly event: string;
  readonly filename: string;
  readonly nodes: readonly unknown[];
  readonly options?: readonly unknown[];
  readonly rule: RuleModule;
  readonly sourceText?: string;
}): readonly CapturedReport[] {
  const reports: CapturedReport[] = [];

  const context: RuleContext = {
    filename,
    options: [...(options ?? [])],
    sourceCode: {
      getText: () => sourceText ?? "",
    },
    report(descriptor) {
      reports.push({
        messageId:
          typeof descriptor.messageId === "string"
            ? descriptor.messageId
            : "unknown",
        data: descriptor.data,
        node: descriptor.node,
      });
    },
  };

  const listeners = rule.create(context);
  const listener = listeners[event];

  if (!listener) {
    return reports;
  }

  for (const node of nodes) {
    listener(node);
  }

  return reports;
}
