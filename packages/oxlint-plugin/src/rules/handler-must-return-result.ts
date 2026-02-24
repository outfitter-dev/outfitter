import {
  asIdentifierName,
  type RuleContext,
  type RuleModule,
} from "./shared.js";

interface TypeReferenceNode {
  readonly type: "TSTypeReference";
  readonly typeName: unknown;
  readonly typeParameters?: unknown;
}

interface TypeAnnotationNode {
  readonly type: "TSTypeAnnotation";
  readonly typeAnnotation: unknown;
}

interface VariableDeclaratorNode {
  readonly id: unknown;
  readonly init?: unknown;
  readonly type: "VariableDeclarator";
}

interface FunctionLikeNode {
  readonly returnType?: unknown;
  readonly type: "ArrowFunctionExpression" | "FunctionExpression";
}

function asTypeReference(node: unknown): TypeReferenceNode | undefined {
  if (!node || typeof node !== "object") {
    return undefined;
  }

  if ((node as { type?: unknown }).type !== "TSTypeReference") {
    return undefined;
  }

  return node as TypeReferenceNode;
}

function asTypeAnnotation(node: unknown): TypeAnnotationNode | undefined {
  if (!node || typeof node !== "object") {
    return undefined;
  }

  if ((node as { type?: unknown }).type !== "TSTypeAnnotation") {
    return undefined;
  }

  return node as TypeAnnotationNode;
}

function asVariableDeclarator(
  node: unknown
): VariableDeclaratorNode | undefined {
  if (!node || typeof node !== "object") {
    return undefined;
  }

  if ((node as { type?: unknown }).type !== "VariableDeclarator") {
    return undefined;
  }

  return node as VariableDeclaratorNode;
}

function asFunctionLike(node: unknown): FunctionLikeNode | undefined {
  if (!node || typeof node !== "object") {
    return undefined;
  }

  const type = (node as { type?: unknown }).type;

  if (type !== "ArrowFunctionExpression" && type !== "FunctionExpression") {
    return undefined;
  }

  return node as FunctionLikeNode;
}

function resolveQualifiedTypeName(node: unknown): string | undefined {
  const identifierName = asIdentifierName(node);

  if (identifierName) {
    return identifierName;
  }

  if (!node || typeof node !== "object") {
    return undefined;
  }

  if ((node as { type?: unknown }).type !== "TSQualifiedName") {
    return undefined;
  }

  return resolveQualifiedTypeName((node as { right?: unknown }).right);
}

function getTypeParameters(
  typeReference: TypeReferenceNode
): readonly unknown[] {
  const typeParameters = typeReference.typeParameters;

  if (!typeParameters || typeof typeParameters !== "object") {
    return [];
  }

  if (
    (typeParameters as { type?: unknown }).type !==
    "TSTypeParameterInstantiation"
  ) {
    return [];
  }

  const params = (typeParameters as { params?: unknown }).params;
  return Array.isArray(params) ? params : [];
}

function isTypeReferenceNamed(node: unknown, typeName: string): boolean {
  const typeReference = asTypeReference(node);

  if (!typeReference) {
    return false;
  }

  return resolveQualifiedTypeName(typeReference.typeName) === typeName;
}

function getVariableTypeAnnotation(node: VariableDeclaratorNode): unknown {
  if (!node.id || typeof node.id !== "object") {
    return undefined;
  }

  const typeAnnotation = asTypeAnnotation(
    (node.id as { typeAnnotation?: unknown }).typeAnnotation
  );

  return typeAnnotation?.typeAnnotation;
}

function getFunctionReturnType(node: FunctionLikeNode): unknown {
  return asTypeAnnotation(node.returnType)?.typeAnnotation;
}

function returnsResultType(returnType: unknown): boolean {
  if (isTypeReferenceNamed(returnType, "Result")) {
    return true;
  }

  const promiseType = asTypeReference(returnType);

  if (
    !promiseType ||
    resolveQualifiedTypeName(promiseType.typeName) !== "Promise"
  ) {
    return false;
  }

  const [promiseValueType] = getTypeParameters(promiseType);
  return isTypeReferenceNamed(promiseValueType, "Result");
}

export const handlerMustReturnResultRule: RuleModule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require Handler-typed functions to explicitly return Result<T, E> or Promise<Result<T, E>>.",
      recommended: true,
    },
    schema: [],
    messages: {
      handlerMustReturnResult:
        "Handler-typed functions must explicitly return Result<T, E> or Promise<Result<T, E>>.",
    },
  },
  create(context: RuleContext) {
    return {
      VariableDeclarator(node) {
        const variableNode = asVariableDeclarator(node);

        if (!variableNode) {
          return;
        }

        const variableType = getVariableTypeAnnotation(variableNode);

        if (!isTypeReferenceNamed(variableType, "Handler")) {
          return;
        }

        const functionNode = asFunctionLike(variableNode.init);

        if (!functionNode) {
          return;
        }

        const returnType = getFunctionReturnType(functionNode);

        if (returnType && returnsResultType(returnType)) {
          return;
        }

        context.report({
          node,
          messageId: "handlerMustReturnResult",
        });
      },
    };
  },
};
