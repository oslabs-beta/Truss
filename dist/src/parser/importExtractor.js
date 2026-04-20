"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseImportsFromFile = parseImportsFromFile;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const ts = __importStar(require("typescript"));
const logger_1 = require("../utils/logger");
const pathResolver_1 = require("../utils/pathResolver");
function normalizeExternal(specifier) {
    // Reduces deep imports like `pkg/sub/path` to the package name used in reports.
    if (specifier.startsWith("node:"))
        return specifier;
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
    logger_1.logger.debug(`Parsing imports in file: ${opts.file}`);
    if (!fs.existsSync(abs)) {
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
    }
    catch (error) {
        logger_1.logger.error(`Failed to read file: ${opts.file}`);
        parserIssues.push({
            code: "SOURCE_FILE_READ_FAILED",
            severity: "error",
            message: `Failed to read source file: ${error.message || "unknown error"}`,
            fromFile: opts.file,
        });
        return { edges, parserIssues };
    }
    const sourceFile = ts.createSourceFile(abs, sourceText, ts.ScriptTarget.Latest, true);
    const parseDiagnostics = sourceFile.parseDiagnostics ?? [];
    for (const diagnostic of parseDiagnostics) {
        const line = diagnostic.start !== undefined
            ? sourceFile.getLineAndCharacterOfPosition(diagnostic.start).line + 1
            : undefined;
        const importText = diagnostic.start !== undefined && diagnostic.length !== undefined
            ? sourceText
                .slice(diagnostic.start, diagnostic.start + diagnostic.length)
                .trim() || undefined
            : undefined;
        parserIssues.push({
            code: "TYPESCRIPT_SYNTAX_DIAGNOSTIC",
            severity: diagnostic.category === ts.DiagnosticCategory.Error ? "error" : "warning",
            message: ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
            fromFile: opts.file,
            line,
            importText,
        });
    }
    function pushEdge(specifier, node) {
        // Builds the edge location from the AST node, resolves local imports to files,
        // and records a parser warning when a relative import cannot be resolved.
        const start = node.getStart(sourceFile);
        const line = sourceFile.getLineAndCharacterOfPosition(start).line + 1;
        const importText = sourceText.slice(start, node.end).trim();
        if ((0, pathResolver_1.isLocalSpecifier)(specifier)) {
            const toFile = (0, pathResolver_1.resolveImportToFile)(opts.repoRoot, opts.file, specifier);
            if (!toFile) {
                logger_1.logger.debug(`Unresolvable import "${specifier}" in ${opts.file}:${line}`);
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
        // Handles static imports/exports, CommonJS `require`, and dynamic `import()`.
        if (ts.isImportDeclaration(node) &&
            ts.isStringLiteral(node.moduleSpecifier)) {
            pushEdge(node.moduleSpecifier.text, node);
        }
        if (ts.isExportDeclaration(node) &&
            node.moduleSpecifier &&
            ts.isStringLiteral(node.moduleSpecifier)) {
            pushEdge(node.moduleSpecifier.text, node);
        }
        if (ts.isCallExpression(node) &&
            ts.isIdentifier(node.expression) &&
            node.expression.text === "require" &&
            node.arguments.length === 1 &&
            ts.isStringLiteral(node.arguments[0])) {
            pushEdge(node.arguments[0].text, node);
        }
        if (ts.isCallExpression(node) &&
            node.expression.kind === ts.SyntaxKind.ImportKeyword &&
            node.arguments.length === 1 &&
            ts.isStringLiteral(node.arguments[0])) {
            pushEdge(node.arguments[0].text, node);
        }
        ts.forEachChild(node, visit);
    }
    // Walks the file once and collects every dependency edge and parser warning found.
    visit(sourceFile);
    return { edges, parserIssues };
}
