"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toRepoRelativePosix = toRepoRelativePosix;
exports.isLocalSpecifier = isLocalSpecifier;
exports.resolveImportToFile = resolveImportToFile;
const fs = require("node:fs");
const path = require("node:path");
const logger_1 = require("./logger");
/**
 * File extensions we try when resolving local imports.
 */
const RESOLVABLE_EXTENSIONS = [
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".mts",
    ".cts",
    ".mjs",
    ".cjs",
];
/**
 * Convert absolute file path to repo-relative POSIX path.
 * Returns null if file is outside the repo root.
 */
function toRepoRelativePosix(repoRoot, absPath) {
    const rel = path.relative(repoRoot, absPath);
    if (rel.startsWith("..") || path.isAbsolute(rel)) {
        return null;
    }
    return rel.split(path.sep).join("/");
}
/**
 * Check if import specifier points to a local file.
 * Examples:
 * - "./x"    -> true
 * - "../x"   -> true
 * - "/src/x" -> true
 * - "react"  -> false
 */
function isLocalSpecifier(specifier) {
    return specifier.startsWith(".") || specifier.startsWith("/");
}
/**
 * Resolve a local import path to a repo-relative file path.
 * Returns null if:
 * - the specifier is external
 * - or the target file cannot be found
 */
function resolveImportToFile(repoRoot, fromFile, specifier) {
    if (!isLocalSpecifier(specifier)) {
        logger_1.logger.debug(`Skipping external import "${specifier}" from "${fromFile}"`);
        return null;
    }
    const fromAbs = path.resolve(repoRoot, fromFile);
    const baseDir = path.dirname(fromAbs);
    /**
     * If specifier starts with "/":
     * treat it as repo-root-relative, for example:
     * "/src/utils/x" -> "<repoRoot>/src/utils/x"
     *
     * If specifier starts with ".":
     * treat it as file-relative, for example:
     * "../utils/x" -> relative to current file
     */
    const unresolved = specifier.startsWith("/")
        ? path.resolve(repoRoot, `.${specifier}`)
        : path.resolve(baseDir, specifier);
    logger_1.logger.debug(`Base resolved path for "${specifier}": ${unresolved}`);
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
        const rel = toRepoRelativePosix(repoRoot, candidate);
        if (rel) {
            logger_1.logger.debug(`Resolved "${specifier}" from "${fromFile}" to "${rel}"`);
            return rel;
        }
    }
    logger_1.logger.debug(`Could not resolve "${specifier}" from "${fromFile}"`);
    return null;
}
