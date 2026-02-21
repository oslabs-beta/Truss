import * as fs from "node:fs";
import * as path from "node:path";
import * as ts from "typescript";
import { DependencyEdge } from "../core/types";

/**
 * List of file extensions we try when resolving local imports.
 */
const RESOLVABLE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mts", ".cts", ".mjs", ".cjs"];

/**
 * Convert absolute file path to repo-relative POSIX path.
 *
 * Input:
 *  - repoRoot: absolute path to repository root
 *  - absPath: absolute file path
 *
 * Output:
 *  - relative path using "/" separators
 *  - null if file is outside repo
 */
function toRepoRelativePosix(repoRoot: string, absPath: string): string | null {
  const rel = path.relative(repoRoot, absPath);
  if (rel.startsWith("..") || path.isAbsolute(rel)) return null;
  return rel.split(path.sep).join("/");
}

/**
 * Try to resolve an import specifier to a real file inside the repo.
 *
 * Input:
 *  - repoRoot: repo root path
 *  - fromFile: file where import is located
 *  - specifier: import path string (e.g. "./service")
 *
 * Output:
 *  - repo-relative file path if found
 *  - null if not resolvable or external import
 */
function resolveImportToFile(
  repoRoot: string,
  fromFile: string,
  specifier: string
): string | null {

  // Only resolve local (relative) imports.
  if (!specifier.startsWith(".") && !specifier.startsWith("/")) return null;

  const fromAbs = path.resolve(repoRoot, fromFile);
  const baseDir = path.dirname(fromAbs);

  const unresolved = specifier.startsWith("/")
    ? path.resolve(repoRoot, specifier.slice(1))
    : path.resolve(baseDir, specifier);

  // Try possible file variations (with extension or index file).
  const candidates = [
    unresolved,
    ...RESOLVABLE_EXTENSIONS.map((ext) => `${unresolved}${ext}`),
    ...RESOLVABLE_EXTENSIONS.map((ext) => path.join(unresolved, `index${ext}`)),
  ];

  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;
    const stat = fs.statSync(candidate);
    if (!stat.isFile()) continue;

    return toRepoRelativePosix(repoRoot, candidate);
  }

  return null;
}

/**
 * parseImportsFromFile()
 * Purpose: Parse one file and extract dependency edges.
 *
 * It detects:
 *  - import declarations
 *  - export ... from
 *  - require()
 *  - dynamic import()
 *
 * Input:
 *  - repoRoot: repository root path
 *  - file: repo-relative file path
 *
 * Output:
 *  - DependencyEdge[] for this file
 */
export function parseImportsFromFile(opts: {
  repoRoot: string;
  file: string;
}): DependencyEdge[] {

  const abs = path.resolve(opts.repoRoot, opts.file);
  if (!fs.existsSync(abs)) return [];

  const sourceText = fs.readFileSync(abs, "utf8");
  const sourceFile = ts.createSourceFile(
    abs,
    sourceText,
    ts.ScriptTarget.Latest,
    true
  );

  const edges: DependencyEdge[] = [];

  /**
   * Create and push a dependency edge if import is resolvable.
   */
  const pushEdge = (specifier: string, node: ts.Node): void => {
    const toFile = resolveImportToFile(opts.repoRoot, opts.file, specifier);
    if (!toFile) return; // skip external or unresolvable imports

    const start = node.getStart(sourceFile);
    const line =
      sourceFile.getLineAndCharacterOfPosition(start).line + 1;

    const importText = sourceText.slice(start, node.end).trim();

    edges.push({
      fromFile: opts.file,
      toFile,
      importText,
      line,
      importKind: "internal", // only internal imports are emitted here
    });
  };

  /**
   * Visit every AST node recursively.
   */
  const visit = (node: ts.Node): void => {

    // import x from "..."
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      pushEdge(node.moduleSpecifier.text, node);
    }

    // export { ... } from "..."
    if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      pushEdge(node.moduleSpecifier.text, node);
    }

    // require("...")
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "require" &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      pushEdge(node.arguments[0].text, node);
    }

    // dynamic import("...")
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      pushEdge(node.arguments[0].text, node);
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  return edges;
}
