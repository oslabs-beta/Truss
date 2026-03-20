import * as fs from "node:fs";
import * as path from "node:path";
import * as ts from "typescript";
import { DependencyEdge } from "../core/types";
import { FileScanError, ResolveError } from "../utils/errors";
import { logger } from "../utils/logger";
import {
  resolveImportToFile,
  isLocalSpecifier,
} from "../utils/pathResolver";

// External normalization: keep root package name
// "lodash/get" -> "lodash"
// "@nestjs/common/testing" -> "@nestjs/common"
// "node:fs" -> "node:fs"
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
}): DependencyEdge[] {
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

  function pushEdge(specifier: string, node: ts.Node): void {
    const start = node.getStart(sourceFile);
    const line = sourceFile.getLineAndCharacterOfPosition(start).line + 1;
    const importText = sourceText.slice(start, node.end).trim();

    // Internal imports: "./x", "../x", "/src/x"
    if (isLocalSpecifier(specifier)) {
      const toFile = resolveImportToFile(opts.repoRoot, opts.file, specifier);

      if (!toFile) {
        logger.error(
          `Failed to resolve import "${specifier}" in ${opts.file}:${line}`,
        );

        throw new ResolveError(
          `Import resolution error in ${opts.file}:${line}\n` +
            `Unresolvable local import: "${specifier}"\n` +
            `Import: ${importText}`,
        );
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

    // External imports: "react", "express", "@nestjs/common", "node:fs"
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
  return edges;
}