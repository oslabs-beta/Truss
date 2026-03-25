import * as fs from "node:fs";
import * as path from "node:path";
import * as ts from "typescript";

import { DependencyEdge, ParserIssue } from "../core/types";
import { logger } from "../utils/logger";
import {
  resolveImportToFile,
  isLocalSpecifier,
} from "../utils/pathResolver";

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
  const edges: DependencyEdge[] = [];
  const parserIssues: ParserIssue[] = [];
  // #region agent log
  fetch("http://127.0.0.1:7861/ingest/8b9c63fd-394c-4722-bece-a02463c6f64a", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "e9e872",
    },
    body: JSON.stringify({
      sessionId: "e9e872",
      runId: "pre-fix",
      hypothesisId: "H1",
      location: "src/parser/importExtractor.ts:30",
      message: "parseImportsFromFile entry",
      data: { file: opts.file, abs },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  logger.debug(`Parsing imports in file: ${opts.file}`);

  if (!fs.existsSync(abs)) {
    // #region agent log
    fetch("http://127.0.0.1:7861/ingest/8b9c63fd-394c-4722-bece-a02463c6f64a", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "e9e872",
      },
      body: JSON.stringify({
        sessionId: "e9e872",
        runId: "pre-fix",
        hypothesisId: "H4",
        location: "src/parser/importExtractor.ts:48",
        message: "source file does not exist",
        data: { file: opts.file, abs },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    parserIssues.push({
      code: "SOURCE_FILE_NOT_FOUND",
      severity: "error",
      message: "Source file not found",
      fromFile: opts.file,
    });
    return { edges, parserIssues };
  }

  let sourceText: string;
  try {
    sourceText = fs.readFileSync(abs, "utf8");
  } catch (error) {
    logger.error(`Failed to read file: ${opts.file}`);
    // #region agent log
    fetch("http://127.0.0.1:7861/ingest/8b9c63fd-394c-4722-bece-a02463c6f64a", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "e9e872",
      },
      body: JSON.stringify({
        sessionId: "e9e872",
        runId: "pre-fix",
        hypothesisId: "H4",
        location: "src/parser/importExtractor.ts:72",
        message: "source file read failed",
        data: { file: opts.file, error: (error as Error).message },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    parserIssues.push({
      code: "SOURCE_FILE_READ_FAILED",
      severity: "error",
      message: `Failed to read source file: ${(error as Error).message || "unknown error"}`,
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

  const parseDiagnostics =
    (
      sourceFile as ts.SourceFile & {
        parseDiagnostics?: readonly ts.DiagnosticWithLocation[];
      }
    ).parseDiagnostics ?? [];

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
        diagnostic.category === ts.DiagnosticCategory.Error ? "error" : "warning",
      message: ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
      fromFile: opts.file,
      line,
      importText,
    });
  }

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
  // #region agent log
  fetch("http://127.0.0.1:7861/ingest/8b9c63fd-394c-4722-bece-a02463c6f64a", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "e9e872",
    },
    body: JSON.stringify({
      sessionId: "e9e872",
      runId: "pre-fix",
      hypothesisId: "H5",
      location: "src/parser/importExtractor.ts:205",
      message: "parseImportsFromFile exit",
      data: { file: opts.file, edges: edges.length, parserIssues: parserIssues.length },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  return { edges, parserIssues };
}
