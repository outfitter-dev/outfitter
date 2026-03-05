/**
 * Pure analysis functions for TSDoc coverage checking.
 *
 * Handles AST inspection, declaration classification, source file analysis,
 * and coverage calculation.
 *
 * @packageDocumentation
 */

import ts from "typescript";

import type { CoverageLevel, DeclarationCoverage } from "./tsdoc-types.js";

// ---------------------------------------------------------------------------
// Declaration inspection
// ---------------------------------------------------------------------------

/**
 * Check whether a node is an exported declaration worth checking.
 *
 * Returns true for function, interface, type alias, class, enum, and variable
 * declarations that carry the `export` keyword. Re-exports (`export { ... } from`)
 * and `export *` are excluded since TSDoc belongs at the definition site.
 */
export function isExportedDeclaration(node: ts.Node): boolean {
  // Exclude re-exports: export { ... } from "..."
  if (ts.isExportDeclaration(node)) return false;

  // Exclude export * from "..."
  if (ts.isExportAssignment(node)) return false;

  // Must be a supported declaration kind
  const isDeclaration =
    ts.isFunctionDeclaration(node) ||
    ts.isInterfaceDeclaration(node) ||
    ts.isTypeAliasDeclaration(node) ||
    ts.isClassDeclaration(node) ||
    ts.isEnumDeclaration(node) ||
    ts.isVariableStatement(node);

  if (!isDeclaration) return false;

  // Check for export modifier
  const modifiers = ts.canHaveModifiers(node)
    ? ts.getModifiers(node)
    : undefined;
  if (!modifiers) return false;

  return modifiers.some((mod) => mod.kind === ts.SyntaxKind.ExportKeyword);
}

/**
 * Extract the name of a declaration node.
 *
 * For variable statements, returns the name of the first variable declarator.
 * Returns `undefined` for anonymous declarations (e.g., `export default function() {}`).
 */
export function getDeclarationName(node: ts.Node): string | undefined {
  if (ts.isVariableStatement(node)) {
    const decl = node.declarationList.declarations[0];
    if (decl && ts.isIdentifier(decl.name)) {
      return decl.name.text;
    }
    return undefined;
  }

  if (
    ts.isFunctionDeclaration(node) ||
    ts.isInterfaceDeclaration(node) ||
    ts.isTypeAliasDeclaration(node) ||
    ts.isClassDeclaration(node) ||
    ts.isEnumDeclaration(node)
  ) {
    return node.name?.text;
  }

  return undefined;
}

/**
 * Determine the kind label for a declaration node.
 *
 * Maps AST node types to human-readable kind strings used in coverage reports.
 */
export function getDeclarationKind(node: ts.Node): string {
  if (ts.isFunctionDeclaration(node)) return "function";
  if (ts.isInterfaceDeclaration(node)) return "interface";
  if (ts.isTypeAliasDeclaration(node)) return "type";
  if (ts.isClassDeclaration(node)) return "class";
  if (ts.isEnumDeclaration(node)) return "enum";
  if (ts.isVariableStatement(node)) return "variable";
  return "unknown";
}

// ---------------------------------------------------------------------------
// JSDoc detection
// ---------------------------------------------------------------------------

/**
 * Check whether a node has a leading JSDoc comment (starts with `/**`).
 *
 * Uses `ts.getLeadingCommentRanges` to inspect the raw source text,
 * filtering for block comments that begin with the JSDoc marker.
 */
function hasJSDocComment(node: ts.Node, sourceFile: ts.SourceFile): boolean {
  const sourceText = sourceFile.getFullText();
  const ranges = ts.getLeadingCommentRanges(sourceText, node.getFullStart());
  if (!ranges) return false;

  return ranges.some((range) => {
    if (range.kind !== ts.SyntaxKind.MultiLineCommentTrivia) return false;
    const text = sourceText.slice(range.pos, range.end);
    return text.startsWith("/**");
  });
}

/**
 * Check whether a member node (property, method) has a leading JSDoc comment.
 */
function memberHasJSDoc(member: ts.Node, sourceFile: ts.SourceFile): boolean {
  const sourceText = sourceFile.getFullText();
  const ranges = ts.getLeadingCommentRanges(sourceText, member.getFullStart());
  if (!ranges) return false;

  return ranges.some((range) => {
    if (range.kind !== ts.SyntaxKind.MultiLineCommentTrivia) return false;
    const text = sourceText.slice(range.pos, range.end);
    return text.startsWith("/**");
  });
}

// ---------------------------------------------------------------------------
// Declaration classification
// ---------------------------------------------------------------------------

/**
 * Classify a declaration's TSDoc coverage level.
 *
 * - `"documented"` -- has a JSDoc comment with a description. For interfaces
 *   and classes, all members must also have JSDoc comments.
 * - `"partial"` -- the declaration has a JSDoc comment but some members
 *   (in interfaces/classes) lack documentation.
 * - `"undocumented"` -- no JSDoc comment at all.
 */
export function classifyDeclaration(
  node: ts.Node,
  sourceFile: ts.SourceFile
): CoverageLevel {
  const hasDoc = hasJSDocComment(node, sourceFile);

  if (!hasDoc) return "undocumented";

  // For interfaces and classes, check member documentation
  if (ts.isInterfaceDeclaration(node) || ts.isClassDeclaration(node)) {
    const members = node.members;
    if (members.length > 0) {
      const allMembersDocumented = members.every((member) =>
        memberHasJSDoc(member, sourceFile)
      );
      if (!allMembersDocumented) return "partial";
    }
  }

  return "documented";
}

// ---------------------------------------------------------------------------
// Source file analysis
// ---------------------------------------------------------------------------

/**
 * Analyze all exported declarations in a source file for TSDoc coverage.
 *
 * Walks top-level statements, filters to exported declarations, and
 * classifies each for documentation coverage.
 */
export function analyzeSourceFile(
  sourceFile: ts.SourceFile
): DeclarationCoverage[] {
  const results: DeclarationCoverage[] = [];

  for (const statement of sourceFile.statements) {
    if (!isExportedDeclaration(statement)) continue;

    const name = getDeclarationName(statement);
    if (!name) continue;

    const kind = getDeclarationKind(statement);
    const level = classifyDeclaration(statement, sourceFile);
    const { line } = sourceFile.getLineAndCharacterOfPosition(
      statement.getStart(sourceFile)
    );

    results.push({
      name,
      kind,
      level,
      file: sourceFile.fileName,
      line: line + 1, // Convert 0-based to 1-based
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Coverage calculation
// ---------------------------------------------------------------------------

/**
 * Calculate aggregate coverage statistics from declaration results.
 *
 * Partial documentation counts as half coverage in the percentage calculation.
 * An empty array returns 100% (no declarations to check).
 */
export function calculateCoverage(
  declarations: readonly DeclarationCoverage[]
): {
  documented: number;
  partial: number;
  undocumented: number;
  total: number;
  percentage: number;
} {
  const total = declarations.length;
  if (total === 0) {
    return {
      documented: 0,
      partial: 0,
      undocumented: 0,
      total: 0,
      percentage: 100,
    };
  }

  const documented = declarations.filter(
    (d) => d.level === "documented"
  ).length;
  const partial = declarations.filter((d) => d.level === "partial").length;
  const undocumented = declarations.filter(
    (d) => d.level === "undocumented"
  ).length;

  // Partial counts as half
  const score = documented + partial * 0.5;
  const percentage = Math.round((score / total) * 100);

  return { documented, partial, undocumented, total, percentage };
}
