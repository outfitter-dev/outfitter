import { describe, expect, test } from "bun:test";
import { handlerMustReturnResultRule } from "../../rules/handler-must-return-result.js";
import { readFixture, runRuleForEvent } from "../rule-test-helpers.js";

function createTypeReference(
  name: string,
  params?: readonly unknown[]
): unknown {
  return {
    type: "TSTypeReference",
    typeName: {
      type: "Identifier",
      name,
    },
    typeParameters: params
      ? {
          type: "TSTypeParameterInstantiation",
          params,
        }
      : undefined,
  };
}

function createQualifiedTypeReference(
  leftName: string,
  rightName: string
): unknown {
  return {
    type: "TSTypeReference",
    typeName: {
      type: "TSQualifiedName",
      left: {
        type: "Identifier",
        name: leftName,
      },
      right: {
        type: "Identifier",
        name: rightName,
      },
    },
  };
}

function createHandlerVariableDeclaratorNode(
  returnType: unknown,
  initType: "ArrowFunctionExpression" | "FunctionExpression" = "ArrowFunctionExpression"
): unknown {
  return {
    type: "VariableDeclarator",
    id: {
      type: "Identifier",
      name: "handler",
      typeAnnotation: {
        type: "TSTypeAnnotation",
        typeAnnotation: createTypeReference("Handler"),
      },
    },
    init: {
      type: initType,
      returnType: {
        type: "TSTypeAnnotation",
        typeAnnotation: returnType,
      },
    },
  };
}

function createUntypedHandlerVariableNode(): unknown {
  return {
    type: "VariableDeclarator",
    id: {
      type: "Identifier",
      name: "handler",
    },
    init: {
      type: "ArrowFunctionExpression",
      returnType: {
        type: "TSTypeAnnotation",
        typeAnnotation: createTypeReference("Promise", [
          createTypeReference("Result"),
        ]),
      },
    },
  };
}

describe("handler-must-return-result", () => {
  test("reports Handler-typed functions with non-Result returns", () => {
    const reports = runRuleForEvent({
      event: "VariableDeclarator",
      filename: "packages/logging/src/index.ts",
      nodes: [
        createHandlerVariableDeclaratorNode(
          createTypeReference("Promise", [{ type: "TSStringKeyword" }])
        ),
      ],
      rule: handlerMustReturnResultRule,
      sourceText: readFixture("invalid/handler-must-return-result.ts"),
    });

    expect(reports).toHaveLength(1);
    expect(reports[0]?.messageId).toBe("handlerMustReturnResult");
  });

  test("reports Handler-typed functions with missing return type", () => {
    const reports = runRuleForEvent({
      event: "VariableDeclarator",
      filename: "packages/logging/src/index.ts",
      nodes: [
        {
          type: "VariableDeclarator",
          id: {
            type: "Identifier",
            name: "handler",
            typeAnnotation: {
              type: "TSTypeAnnotation",
              typeAnnotation: createTypeReference("Handler"),
            },
          },
          init: {
            type: "ArrowFunctionExpression",
          },
        },
      ],
      rule: handlerMustReturnResultRule,
      sourceText: readFixture("invalid/handler-must-return-result.ts"),
    });

    expect(reports).toHaveLength(1);
    expect(reports[0]?.messageId).toBe("handlerMustReturnResult");
  });

  test("accepts Promise<Result<...>> return types", () => {
    const reports = runRuleForEvent({
      event: "VariableDeclarator",
      filename: "packages/logging/src/index.ts",
      nodes: [
        createHandlerVariableDeclaratorNode(
          createTypeReference("Promise", [createTypeReference("Result")])
        ),
      ],
      rule: handlerMustReturnResultRule,
      sourceText: readFixture("valid/handler-must-return-result.ts"),
    });

    expect(reports).toHaveLength(0);
  });

  test("ignores variables not explicitly typed as Handler", () => {
    const reports = runRuleForEvent({
      event: "VariableDeclarator",
      filename: "packages/logging/src/index.ts",
      nodes: [createUntypedHandlerVariableNode()],
      rule: handlerMustReturnResultRule,
      sourceText: readFixture("valid/handler-must-return-result.ts"),
    });

    expect(reports).toHaveLength(0);
  });

  test("accepts direct Result return type without Promise wrapper", () => {
    const reports = runRuleForEvent({
      event: "VariableDeclarator",
      filename: "packages/logging/src/index.ts",
      nodes: [
        createHandlerVariableDeclaratorNode(createTypeReference("Result")),
      ],
      rule: handlerMustReturnResultRule,
      sourceText: readFixture("valid/handler-must-return-result.ts"),
    });

    expect(reports).toHaveLength(0);
  });

  test("accepts FunctionExpression init with valid return type", () => {
    const reports = runRuleForEvent({
      event: "VariableDeclarator",
      filename: "packages/logging/src/index.ts",
      nodes: [
        createHandlerVariableDeclaratorNode(
          createTypeReference("Promise", [createTypeReference("Result")]),
          "FunctionExpression"
        ),
      ],
      rule: handlerMustReturnResultRule,
      sourceText: readFixture("valid/handler-must-return-result.ts"),
    });

    expect(reports).toHaveLength(0);
  });

  test("reports FunctionExpression init with non-Result return type", () => {
    const reports = runRuleForEvent({
      event: "VariableDeclarator",
      filename: "packages/logging/src/index.ts",
      nodes: [
        createHandlerVariableDeclaratorNode(
          createTypeReference("Promise", [{ type: "TSVoidKeyword" }]),
          "FunctionExpression"
        ),
      ],
      rule: handlerMustReturnResultRule,
      sourceText: readFixture("invalid/handler-must-return-result.ts"),
    });

    expect(reports).toHaveLength(1);
    expect(reports[0]?.messageId).toBe("handlerMustReturnResult");
  });

  test("ignores ClassExpression init (not a function-like)", () => {
    const reports = runRuleForEvent({
      event: "VariableDeclarator",
      filename: "packages/logging/src/index.ts",
      nodes: [
        {
          type: "VariableDeclarator",
          id: {
            type: "Identifier",
            name: "handler",
            typeAnnotation: {
              type: "TSTypeAnnotation",
              typeAnnotation: createTypeReference("Handler"),
            },
          },
          init: {
            type: "ClassExpression",
          },
        },
      ],
      rule: handlerMustReturnResultRule,
      sourceText: readFixture("valid/handler-must-return-result.ts"),
    });

    // ClassExpression is not ArrowFunctionExpression or FunctionExpression,
    // so asFunctionLike returns undefined and the rule bails out silently
    expect(reports).toHaveLength(0);
  });

  test("resolves Result via TSQualifiedName (e.g. BetterResult.Result)", () => {
    const reports = runRuleForEvent({
      event: "VariableDeclarator",
      filename: "packages/logging/src/index.ts",
      nodes: [
        createHandlerVariableDeclaratorNode(
          createTypeReference("Promise", [
            createQualifiedTypeReference("BetterResult", "Result"),
          ])
        ),
      ],
      rule: handlerMustReturnResultRule,
      sourceText: readFixture("valid/handler-must-return-result.ts"),
    });

    // TSQualifiedName with right.name === "Result" should be recognized
    expect(reports).toHaveLength(0);
  });
});
