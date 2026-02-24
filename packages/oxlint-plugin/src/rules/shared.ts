export interface RuleContext {
  readonly filename?: string;
  readonly options: unknown[];
  report(descriptor: Record<string, unknown>): void;
  readonly sourceCode?: {
    getText(): string;
  };
}

export interface RuleModule {
  create(context: RuleContext): Record<string, (node: unknown) => void>;
  readonly meta: {
    readonly type: "problem" | "suggestion" | "layout";
    readonly docs: {
      readonly description: string;
      readonly recommended: boolean;
    };
    readonly schema: unknown[];
    readonly messages: Record<string, string>;
  };
}

const PACKAGES_SRC_PATTERN = /(?:^|\/)packages\/[^/]+\/src\//;
const TEST_FILE_PATTERN = /(?:^|\/)__tests__\/|\.test\.[cm]?[jt]sx?$/;

interface NodeWithType {
  readonly type: string;
}

interface MemberExpressionNode extends NodeWithType {
  readonly object: unknown;
  readonly property: unknown;
  readonly type: "MemberExpression";
}

interface CallExpressionNode extends NodeWithType {
  readonly callee: unknown;
  readonly type: "CallExpression";
}

interface ChainExpressionNode extends NodeWithType {
  readonly expression: unknown;
  readonly type: "ChainExpression";
}

export function normalizeFilePath(filePath: string): string {
  return filePath.replaceAll("\\", "/");
}

export function isPackageSourceFile(filePath: string | undefined): boolean {
  if (!filePath) {
    return false;
  }

  const normalized = normalizeFilePath(filePath);

  if (!PACKAGES_SRC_PATTERN.test(normalized)) {
    return false;
  }

  return !TEST_FILE_PATTERN.test(normalized);
}

export function asIdentifierName(value: unknown): string | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  if ("type" in value && (value as { type: unknown }).type === "Identifier") {
    const name = (value as { name?: unknown }).name;
    return typeof name === "string" ? name : undefined;
  }

  return undefined;
}

export function asLiteralString(value: unknown): string | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  if ("type" in value && (value as { type: unknown }).type === "Literal") {
    const literalValue = (value as { value?: unknown }).value;
    return typeof literalValue === "string" ? literalValue : undefined;
  }

  return undefined;
}

function asNodeWithType(value: unknown): NodeWithType | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const type = (value as { type?: unknown }).type;
  return typeof type === "string" ? (value as NodeWithType) : undefined;
}

function asCallExpression(value: unknown): CallExpressionNode | undefined {
  const node = asNodeWithType(value);

  if (!node || node.type !== "CallExpression") {
    return undefined;
  }

  return value as CallExpressionNode;
}

function asMemberExpression(value: unknown): MemberExpressionNode | undefined {
  const node = asNodeWithType(value);

  if (!node || node.type !== "MemberExpression") {
    return undefined;
  }

  return value as MemberExpressionNode;
}

function unwrapChainExpression(value: unknown): unknown {
  const node = asNodeWithType(value);

  if (!node || node.type !== "ChainExpression") {
    return value;
  }

  return (value as ChainExpressionNode).expression;
}

export function matchesMemberExpression({
  node,
  objectName,
  propertyName,
}: {
  readonly node: unknown;
  readonly objectName: string;
  readonly propertyName?: string;
}): boolean {
  const memberExpression = asMemberExpression(unwrapChainExpression(node));

  if (!memberExpression) {
    return false;
  }

  if (asIdentifierName(memberExpression.object) !== objectName) {
    return false;
  }

  if (!propertyName) {
    return true;
  }

  return (
    asIdentifierName(memberExpression.property) === propertyName ||
    asLiteralString(memberExpression.property) === propertyName
  );
}

export function invokesMemberCall({
  node,
  objectName,
  propertyName,
}: {
  readonly node: unknown;
  readonly objectName: string;
  readonly propertyName?: string;
}): boolean {
  const callExpression = asCallExpression(node);

  if (!callExpression) {
    return false;
  }

  if (typeof propertyName === "string") {
    return matchesMemberExpression({
      node: callExpression.callee,
      objectName,
      propertyName,
    });
  }

  return matchesMemberExpression({
    node: callExpression.callee,
    objectName,
  });
}
