import { describe, expect, test } from "bun:test";
import ts from "typescript";
import {
	analyzeSourceFile,
	calculateCoverage,
	classifyDeclaration,
	type DeclarationCoverage,
	getDeclarationKind,
	getDeclarationName,
	isExportedDeclaration,
	resolveJsonMode,
} from "../cli/check-tsdoc.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a source file AST from raw TypeScript source text. */
function parse(source: string, fileName = "test.ts"): ts.SourceFile {
	return ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true);
}

/** Find the first top-level statement in a source file. */
function firstStatement(source: string): ts.Statement {
	const sf = parse(source);
	const stmt = sf.statements[0];
	if (!stmt) throw new Error("No statements found");
	return stmt;
}

/** Parse source and return both the source file and its first statement. */
function parseWithFirstStatement(
	source: string,
	fileName = "test.ts",
): { sf: ts.SourceFile; node: ts.Statement } {
	const sf = parse(source, fileName);
	const node = sf.statements[0];
	if (!node) throw new Error("No statements found");
	return { sf, node };
}

// ---------------------------------------------------------------------------
// isExportedDeclaration
// ---------------------------------------------------------------------------

describe("isExportedDeclaration", () => {
	test("returns true for exported function declaration", () => {
		const node = firstStatement("export function foo(): void {}");
		expect(isExportedDeclaration(node)).toBe(true);
	});

	test("returns true for exported interface", () => {
		const node = firstStatement("export interface Foo { bar: string }");
		expect(isExportedDeclaration(node)).toBe(true);
	});

	test("returns true for exported type alias", () => {
		const node = firstStatement("export type Foo = string;");
		expect(isExportedDeclaration(node)).toBe(true);
	});

	test("returns true for exported class", () => {
		const node = firstStatement("export class Foo {}");
		expect(isExportedDeclaration(node)).toBe(true);
	});

	test("returns true for exported enum", () => {
		const node = firstStatement("export enum Foo { A, B }");
		expect(isExportedDeclaration(node)).toBe(true);
	});

	test("returns true for exported const variable", () => {
		const node = firstStatement("export const foo = 42;");
		expect(isExportedDeclaration(node)).toBe(true);
	});

	test("returns false for non-exported function", () => {
		const node = firstStatement("function foo(): void {}");
		expect(isExportedDeclaration(node)).toBe(false);
	});

	test("returns false for non-exported interface", () => {
		const node = firstStatement("interface Foo { bar: string }");
		expect(isExportedDeclaration(node)).toBe(false);
	});

	test("returns false for import declaration", () => {
		const node = firstStatement('import { foo } from "./bar";');
		expect(isExportedDeclaration(node)).toBe(false);
	});

	test("returns false for re-export statement", () => {
		const node = firstStatement('export { foo } from "./bar";');
		expect(isExportedDeclaration(node)).toBe(false);
	});

	test("returns false for export-all statement", () => {
		const node = firstStatement('export * from "./bar";');
		expect(isExportedDeclaration(node)).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// getDeclarationName
// ---------------------------------------------------------------------------

describe("getDeclarationName", () => {
	test("returns name for function declaration", () => {
		const node = firstStatement("export function myFunc(): void {}");
		expect(getDeclarationName(node)).toBe("myFunc");
	});

	test("returns name for interface declaration", () => {
		const node = firstStatement("export interface MyInterface {}");
		expect(getDeclarationName(node)).toBe("MyInterface");
	});

	test("returns name for type alias", () => {
		const node = firstStatement("export type MyType = string;");
		expect(getDeclarationName(node)).toBe("MyType");
	});

	test("returns name for class declaration", () => {
		const node = firstStatement("export class MyClass {}");
		expect(getDeclarationName(node)).toBe("MyClass");
	});

	test("returns name for enum declaration", () => {
		const node = firstStatement("export enum MyEnum { A }");
		expect(getDeclarationName(node)).toBe("MyEnum");
	});

	test("returns name for variable declaration", () => {
		const node = firstStatement("export const myConst = 42;");
		expect(getDeclarationName(node)).toBe("myConst");
	});

	test("returns undefined for anonymous default export", () => {
		const node = firstStatement("export default function() {}");
		expect(getDeclarationName(node)).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// getDeclarationKind
// ---------------------------------------------------------------------------

describe("getDeclarationKind", () => {
	test("returns 'function' for function declaration", () => {
		const node = firstStatement("export function foo(): void {}");
		expect(getDeclarationKind(node)).toBe("function");
	});

	test("returns 'interface' for interface declaration", () => {
		const node = firstStatement("export interface Foo {}");
		expect(getDeclarationKind(node)).toBe("interface");
	});

	test("returns 'type' for type alias declaration", () => {
		const node = firstStatement("export type Foo = string;");
		expect(getDeclarationKind(node)).toBe("type");
	});

	test("returns 'class' for class declaration", () => {
		const node = firstStatement("export class Foo {}");
		expect(getDeclarationKind(node)).toBe("class");
	});

	test("returns 'enum' for enum declaration", () => {
		const node = firstStatement("export enum Foo { A }");
		expect(getDeclarationKind(node)).toBe("enum");
	});

	test("returns 'variable' for variable statement", () => {
		const node = firstStatement("export const foo = 42;");
		expect(getDeclarationKind(node)).toBe("variable");
	});
});

// ---------------------------------------------------------------------------
// classifyDeclaration
// ---------------------------------------------------------------------------

describe("classifyDeclaration", () => {
	test("returns 'documented' for function with full TSDoc", () => {
		const { sf, node } = parseWithFirstStatement(
			`/** Does something useful. */\nexport function foo(): void {}`,
		);
		expect(classifyDeclaration(node, sf)).toBe("documented");
	});

	test("returns 'documented' for interface with TSDoc and all members documented", () => {
		const { sf, node } = parseWithFirstStatement(
			`/** Represents a user. */\nexport interface User {\n  /** The user name. */\n  name: string;\n}`,
		);
		expect(classifyDeclaration(node, sf)).toBe("documented");
	});

	test("returns 'documented' for empty interface with TSDoc", () => {
		const { sf, node } = parseWithFirstStatement(
			`/** A marker interface. */\nexport interface Marker {}`,
		);
		expect(classifyDeclaration(node, sf)).toBe("documented");
	});

	test("returns 'undocumented' for function without any comment", () => {
		const { sf, node } = parseWithFirstStatement(
			`export function foo(): void {}`,
		);
		expect(classifyDeclaration(node, sf)).toBe("undocumented");
	});

	test("returns 'undocumented' for interface without any comment", () => {
		const { sf, node } = parseWithFirstStatement(
			`export interface Foo { bar: string }`,
		);
		expect(classifyDeclaration(node, sf)).toBe("undocumented");
	});

	test("returns 'partial' for interface with doc but undocumented members", () => {
		const { sf, node } = parseWithFirstStatement(
			[
				"/** A shape. */",
				"export interface Shape {",
				"  /** The width. */",
				"  width: number;",
				"  height: number;",
				"}",
			].join("\n"),
		);
		expect(classifyDeclaration(node, sf)).toBe("partial");
	});

	test("returns 'documented' for interface with all members documented", () => {
		const { sf, node } = parseWithFirstStatement(
			[
				"/** A shape. */",
				"export interface Shape {",
				"  /** The width. */",
				"  width: number;",
				"  /** The height. */",
				"  height: number;",
				"}",
			].join("\n"),
		);
		expect(classifyDeclaration(node, sf)).toBe("documented");
	});

	test("returns 'partial' for class with doc but undocumented members", () => {
		const { sf, node } = parseWithFirstStatement(
			[
				"/** A widget. */",
				"export class Widget {",
				"  /** Name of widget. */",
				"  name: string = '';",
				"  size: number = 0;",
				"}",
			].join("\n"),
		);
		expect(classifyDeclaration(node, sf)).toBe("partial");
	});

	test("returns 'documented' for variable with TSDoc", () => {
		const { sf, node } = parseWithFirstStatement(
			`/** Default timeout in ms. */\nexport const TIMEOUT = 5000;`,
		);
		expect(classifyDeclaration(node, sf)).toBe("documented");
	});

	test("returns 'undocumented' for variable without comment", () => {
		const { sf, node } = parseWithFirstStatement(
			`export const TIMEOUT = 5000;`,
		);
		expect(classifyDeclaration(node, sf)).toBe("undocumented");
	});

	test("ignores non-JSDoc block comments", () => {
		const { sf, node } = parseWithFirstStatement(
			`/* not a jsdoc comment */\nexport function foo(): void {}`,
		);
		expect(classifyDeclaration(node, sf)).toBe("undocumented");
	});
});

// ---------------------------------------------------------------------------
// analyzeSourceFile
// ---------------------------------------------------------------------------

describe("analyzeSourceFile", () => {
	test("returns coverage entries for each exported declaration", () => {
		const source = [
			'/** Greets someone. */\nexport function greet(name: string): string { return "hi"; }',
			"export interface Options { verbose: boolean }",
		].join("\n");
		const sf = parse(source, "src/index.ts");

		const result = analyzeSourceFile(sf);
		expect(result).toHaveLength(2);

		const greetEntry = result.find((d) => d.name === "greet");
		expect(greetEntry).toBeDefined();
		expect(greetEntry?.level).toBe("documented");
		expect(greetEntry?.kind).toBe("function");

		const optionsEntry = result.find((d) => d.name === "Options");
		expect(optionsEntry).toBeDefined();
		expect(optionsEntry?.level).toBe("undocumented");
		expect(optionsEntry?.kind).toBe("interface");
	});

	test("skips non-exported declarations", () => {
		const source = [
			"function internal(): void {}",
			'/** Exported. */\nexport function pub(): string { return "ok"; }',
		].join("\n");
		const sf = parse(source, "src/index.ts");

		const result = analyzeSourceFile(sf);
		expect(result).toHaveLength(1);
		expect(result[0]?.name).toBe("pub");
	});

	test("skips re-exports and export-all", () => {
		const source = [
			'export { foo } from "./foo";',
			'export * from "./bar";',
			"/** A type. */\nexport type MyType = string;",
		].join("\n");
		const sf = parse(source, "src/index.ts");

		const result = analyzeSourceFile(sf);
		expect(result).toHaveLength(1);
		expect(result[0]?.name).toBe("MyType");
	});

	test("returns empty array for file with no exported declarations", () => {
		const source = "const x = 1;\nfunction internal() { return x; }";
		const sf = parse(source, "src/index.ts");

		const result = analyzeSourceFile(sf);
		expect(result).toHaveLength(0);
	});

	test("includes file path and line number", () => {
		const source = "/** Documented. */\nexport function foo(): void {}";
		const sf = parse(source, "packages/cli/src/index.ts");

		const result = analyzeSourceFile(sf);
		expect(result).toHaveLength(1);
		expect(result[0]?.file).toBe("packages/cli/src/index.ts");
		expect(result[0]?.line).toBeGreaterThanOrEqual(1);
	});
});

// ---------------------------------------------------------------------------
// calculateCoverage
// ---------------------------------------------------------------------------

describe("calculateCoverage", () => {
	test("returns zero counts for empty array", () => {
		const result = calculateCoverage([]);
		expect(result).toEqual({
			documented: 0,
			partial: 0,
			undocumented: 0,
			total: 0,
			percentage: 100,
		});
	});

	test("calculates 100% for all documented", () => {
		const declarations: readonly DeclarationCoverage[] = [
			{
				name: "foo",
				kind: "function",
				level: "documented",
				file: "test.ts",
				line: 1,
			},
			{
				name: "bar",
				kind: "function",
				level: "documented",
				file: "test.ts",
				line: 5,
			},
		];
		const result = calculateCoverage(declarations);
		expect(result.documented).toBe(2);
		expect(result.partial).toBe(0);
		expect(result.undocumented).toBe(0);
		expect(result.total).toBe(2);
		expect(result.percentage).toBe(100);
	});

	test("calculates 0% for all undocumented", () => {
		const declarations: readonly DeclarationCoverage[] = [
			{
				name: "foo",
				kind: "function",
				level: "undocumented",
				file: "test.ts",
				line: 1,
			},
			{
				name: "bar",
				kind: "interface",
				level: "undocumented",
				file: "test.ts",
				line: 5,
			},
		];
		const result = calculateCoverage(declarations);
		expect(result.documented).toBe(0);
		expect(result.undocumented).toBe(2);
		expect(result.total).toBe(2);
		expect(result.percentage).toBe(0);
	});

	test("counts partial as half coverage", () => {
		const declarations: readonly DeclarationCoverage[] = [
			{
				name: "foo",
				kind: "function",
				level: "documented",
				file: "test.ts",
				line: 1,
			},
			{
				name: "bar",
				kind: "interface",
				level: "partial",
				file: "test.ts",
				line: 5,
			},
		];
		const result = calculateCoverage(declarations);
		expect(result.documented).toBe(1);
		expect(result.partial).toBe(1);
		expect(result.undocumented).toBe(0);
		expect(result.total).toBe(2);
		// documented (1) + partial * 0.5 (0.5) = 1.5 / 2 = 75%
		expect(result.percentage).toBe(75);
	});

	test("rounds percentage to nearest integer", () => {
		const declarations: readonly DeclarationCoverage[] = [
			{
				name: "a",
				kind: "function",
				level: "documented",
				file: "test.ts",
				line: 1,
			},
			{
				name: "b",
				kind: "function",
				level: "undocumented",
				file: "test.ts",
				line: 2,
			},
			{
				name: "c",
				kind: "function",
				level: "undocumented",
				file: "test.ts",
				line: 3,
			},
		];
		const result = calculateCoverage(declarations);
		// 1/3 = 33.333...% -> 33
		expect(result.percentage).toBe(33);
	});
});

// ---------------------------------------------------------------------------
// resolveJsonMode
// ---------------------------------------------------------------------------

describe("resolveJsonMode", () => {
	test("uses explicit option when provided", () => {
		process.env["OUTFITTER_JSON"] = "0";
		expect(resolveJsonMode({ json: true })).toBe(true);
		expect(resolveJsonMode({ json: false })).toBe(false);
		delete process.env["OUTFITTER_JSON"];
	});

	test("falls back to OUTFITTER_JSON env bridge", () => {
		process.env["OUTFITTER_JSON"] = "1";
		expect(resolveJsonMode({})).toBe(true);
		process.env["OUTFITTER_JSON"] = "0";
		expect(resolveJsonMode({})).toBe(false);
		delete process.env["OUTFITTER_JSON"];
	});
});
