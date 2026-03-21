"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseImportsFromFile = parseImportsFromFile;
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const errors_1 = require("../utils/errors");
const RESOLVABLE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mts", ".cts", ".mjs", ".cjs"];
function toRepoRelativePosix(repoRoot, absPath) {
    const rel = path.relative(repoRoot, absPath);
    if (rel.startsWith("..") || path.isAbsolute(rel))
        return null;
    return rel.split(path.sep).join("/");
}
// External normalization: keep root package name
// "lodash/get" -> "lodash"
// "@nestjs/common/testing" -> "@nestjs/common"
// "node:fs" -> "node:fs"
function normalizeExternal(specifier) {
    if (specifier.startsWith("node:"))
        return specifier;
    if (specifier.startsWith("@")) {
        const parts = specifier.split("/");
        return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : specifier;
    }
    return specifier.split("/")[0] ?? specifier;
}
function resolveRelativeImportToFile(repoRoot, fromFile, specifier) {
    const fromAbs = path.resolve(repoRoot, fromFile);
    const baseDir = path.dirname(fromAbs);
    const unresolved = path.resolve(baseDir, specifier);
    const candidates = [
        unresolved,
        ...RESOLVABLE_EXTENSIONS.map((ext) => `${unresolved}${ext}`),
        ...RESOLVABLE_EXTENSIONS.map((ext) => path.join(unresolved, `index${ext}`)),
    ];
    for (const candidate of candidates) {
        if (!fs.existsSync(candidate))
            continue;
        if (!fs.statSync(candidate).isFile())
            continue;
        return toRepoRelativePosix(repoRoot, candidate);
    }
    return null;
}
function parseImportsFromFile(opts) {
    const abs = path.resolve(opts.repoRoot, opts.file);
    if (!fs.existsSync(abs)) {
        throw new errors_1.FileScanError(`Source file not found: ${opts.file}`);
    }
    let sourceText;
    try {
        sourceText = fs.readFileSync(abs, "utf8");
    }
    catch {
        throw new errors_1.FileScanError(`Failed to read file: ${opts.file}`);
    }
    const sourceFile = ts.createSourceFile(abs, sourceText, ts.ScriptTarget.Latest, true);
    const edges = [];
    const parserIssues = [];
    function pushEdge(specifier, node) {
        const start = node.getStart(sourceFile);
        const line = sourceFile.getLineAndCharacterOfPosition(start).line + 1;
        const importText = sourceText.slice(start, node.end).trim();
        // 1) Internal: relative only
        if (specifier.startsWith(".")) {
            const toFile = resolveRelativeImportToFile(opts.repoRoot, opts.file, specifier);
            if (!toFile) {
                // Keep analyzing the repository even if one import is broken.
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
        // 2) External: everything else
        edges.push({
            fromFile: opts.file,
            packageName: normalizeExternal(specifier),
            importText,
            line,
            importKind: "external",
        });
    }
    function visit(node) {
        // import x from "..."
        if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
            pushEdge(node.moduleSpecifier.text, node);
        }
        // export { ... } from "..."
        if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
            pushEdge(node.moduleSpecifier.text, node);
        }
        // require("...")
        if (ts.isCallExpression(node) &&
            ts.isIdentifier(node.expression) &&
            node.expression.text === "require" &&
            node.arguments.length === 1 &&
            ts.isStringLiteral(node.arguments[0])) {
            pushEdge(node.arguments[0].text, node);
        }
        ts.forEachChild(node, visit);
    }
    visit(sourceFile);
    return { edges, parserIssues };
}
