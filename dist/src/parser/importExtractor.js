"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseImportsFromFile = parseImportsFromFile;
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const logger_1 = require("../utils/logger");
const pathResolver_1 = require("../utils/pathResolver");

function normalizeExternal(specifier) {
  if (specifier.startsWith("node:")) return specifier;
  if (specifier.startsWith("@")) {
    const parts = specifier.split("/");
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : specifier;
  }
  return specifier.split("/")[0] ?? specifier;
}

function parseImportsFromFile(opts) {
  const abs = path.resolve(opts.repoRoot, opts.file);
  const edges = [];
  const parserIssues = [];
  const edges = [];
  const parserIssues = [];
  logger_1.logger.debug(`Parsing imports in file: ${opts.file}`);

  if (!fs.existsSync(abs)) {
    parserIssues.push({
      code: "SOURCE_FILE_NOT_FOUND",
      severity: "error",
      message: "Source file not found",
      fromFile: opts.file,
    });
    return { edges, parserIssues };
    parserIssues.push({
      code: "SOURCE_FILE_NOT_FOUND",
      severity: "error",
      message: "Source file not found",
      fromFile: opts.file,
    });
    return { edges, parserIssues };
  }

  let sourceText;
  try {
    sourceText = fs.readFileSync(abs, "utf8");
  } catch (error) {}
  try {
  } catch (error) {
    logger_1.logger.error(`Failed to read file: ${opts.file}`);
    parserIssues.push({
      code: "SOURCE_FILE_READ_FAILED",
      severity: "error",
      message: `Failed to read source file: ${error.message || "unknown error"}`,
      fromFile: opts.file,
    });
    return { edges, parserIssues };
    parserIssues.push({
      code: "SOURCE_FILE_READ_FAILED",
      severity: "error",
      message: `Failed to read source file: ${error.message || "unknown error"}`,
      fromFile: opts.file,
    });
    return { edges, parserIssues };
  }

  const sourceFile = ts.createSourceFile(
    abs,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
  );
  const parseDiagnostics = sourceFile.parseDiagnostics ?? [];

  for (const diagnostic of parseDiagnostics) {
    const line =
      diagnostic.start !== undefined
        ? sourceFile.getLineAndCharacterOfPosition(diagnostic.start).line + 1
        : undefined;
    const importText =
      diagnostic.start !== undefined && diagnostic.length !== undefined
        ? sourceText
            .slice(diagnostic.start, diagnostic.start + diagnostic.length)
            .trim() || undefined
        : undefined;

    parserIssues.push({
      code: "TYPESCRIPT_SYNTAX_DIAGNOSTIC",
      severity:
        diagnostic.category === ts.DiagnosticCategory.Error
          ? "error"
          : "warning",
      message: ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
      fromFile: opts.file,
      line,
      importText,
    });
  }

  function pushEdge(specifier, node) {
    const start = node.getStart(sourceFile);
    const line = sourceFile.getLineAndCharacterOfPosition(start).line + 1;
    const importText = sourceText.slice(start, node.end).trim();

    if ((0, pathResolver_1.isLocalSpecifier)(specifier)) {
      const toFile = (0, pathResolver_1.resolveImportToFile)(
        opts.repoRoot,
        opts.file,
        specifier,
      );

      if (!toFile) {
        logger_1.logger.debug(
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

  function visit(node) {
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

    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
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
