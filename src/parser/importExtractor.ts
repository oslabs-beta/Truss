import * as fs from "node:fs";
import * as path from "node:path";
import * as ts from "typescript";

import { DependencyEdge, ParserIssue } from "../core/types";
import { FileScanError } from "../utils/errors";
import { logger } from "../utils/logger";
import {
  resolveImportToFile,
  isLocalSpecifier,
} from "../utils/pathResolver";

const RESOLVABLE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mts", ".cts", ".mjs", ".cjs"];

function toRepoRelativePosix(repoRoot: string, absPath: string): string | null {
  const rel = path.relative(repoRoot, absPath);
  if (rel.startsWith("..") || path.isAbsolute(rel)) return null;
  return rel.split(path.sep).join("/");
}

function normalizeExternal(specifier: string): string {
  if (specifier.startsWith("node:")) return specifier;

  if (specifier.startsWith("@")) {
    const parts = specifier.split("/");
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : specifier;
  }

  return specifier.split("/")[0] ?? specifier;
}

export function parseImportsFromFile(opts: {
  repoRoot: string;
  file: string;
}): { edges: DependencyEdge[]; parserIssues: ParserIssue[] } {
  const abs = path.resolve(opts.repoRoot, opts.file);

  logger.debug(`Parsing imports in file: ${opts.file}`);

  if (!fs.existsSync(abs)) {
    throw new FileScanError(`Source file not found: ${opts.file}`);
  }

  let sourceText: string;
  try {
    sourceText = fs.readFileSync(abs, "utf8");
  } catch {
    logger.error(`Failed to read file: ${opts.file}`);
    throw new FileScanError(`Failed to read file: ${opts.file}`);
  }

  const sourceFile = ts.createSourceFile(
    abs,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
  );

  const edges: DependencyEdge[] = [];
  const parserIssues: ParserIssue[] = [];

  function pushEdge(specifier: string, node: ts.Node): void {
    const start = node.getStart(sourceFile);
    const line = sourceFile.getLineAndCharacterOfPosition(start).line + 1;
    const importText = sourceText.slice(start, node.end).trim();

    if (isLocalSpecifier(specifier)) {
      const toFile = resolveImportToFile(opts.repoRoot, opts.file, specifier);

      if (!toFile) {
        logger.debug(
          `Unresolvable import "${specifier}" in ${opts.file}:${line}`,
        );

        parserIssues.push({
          code: "UNRESOLVABLE_RELATIVE_IMPORT",
          severity: "warning",
          message: `Unresolvable relative import "${specifier}"`,
          fromFile: opts.file,
          line,
          specifier,
          importText,
        });
        return;
      }

      edges.push({
        fromFile: opts.file,
        toFile,
        importText,
        line,
        importKind: "internal",
      });

      return;
    }

    edges.push({
      fromFile: opts.file,
      packageName: normalizeExternal(specifier),
      importText,
      line,
      importKind: "external",
    });
  }

  function visit(node: ts.Node): void {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      pushEdge(node.moduleSpecifier.text, node);
    }

    if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      pushEdge(node.moduleSpecifier.text, node);
    }

    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "require" &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      pushEdge(node.arguments[0].text, node);
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return { edges, parserIssues };
}