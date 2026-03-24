"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.discoverSourceFiles = discoverSourceFiles;
const fs = require("node:fs");
const path = require("node:path");
const errors_1 = require("../utils/errors");
const logger_1 = require("../utils/logger");
const DEFAULT_IGNORES = new Set([
    "node_modules",
    ".git",
    "dist",
    "build",
    "out",
    ".next",
    ".turbo",
    "coverage",
    ".cache",
    ".yarn",
]);
const EXT_OK = new Set([".ts", ".tsx", ".js", ".jsx"]);
/**
 * Recursively scans the repository and returns
 * all source files that match allowed extensions.
 *
 * - Starts from repoRoot
 * - Respects default and extra ignore rules
 * - Returns repo-relative POSIX paths
 */
function discoverSourceFiles(opts) {
    // Ensure repoRoot is absolute for consistent path handling
    const repoRoot = path.resolve(opts.repoRoot);
    logger_1.logger.debug(`Scanning source files under: ${repoRoot}`);
    // Build ignore set (default + user-defined)
    const ignore = new Set(DEFAULT_IGNORES);
    for (const i of opts.extraIgnores ?? [])
        ignore.add(i);
    logger_1.logger.debug(`Using ignore rules: ${Array.from(ignore).join(", ")}`);
    const results = [];
    //Recursively walks a directory and collects valid source files
    function walk(dirAbs) {
        //const entries = fs.readdirSync(dirAbs, { withFileTypes: true });
        let entries;
        try {
            entries = fs.readdirSync(dirAbs, { withFileTypes: true });
        }
        catch (error) {
            logger_1.logger.error(`Failed to read directory: ${dirAbs}`);
            throw new errors_1.FileScanError(`Failed to read directory: ${dirAbs}`);
        }
        for (const ent of entries) {
            const abs = path.join(dirAbs, ent.name);
            const rel = path.relative(repoRoot, abs);
            // If entry is a directory, recurse unless ignored
            if (ent.isDirectory()) {
                if (ignore.has(ent.name))
                    continue;
                walk(abs);
                continue;
            }
            if (!ent.isFile())
                continue;
            if (!EXT_OK.has(path.extname(ent.name)))
                continue;
            // Normalize separators for cross-platform deterministic output.
            results.push(rel.split(path.sep).join("/"));
        }
    }
    walk(repoRoot);
    results.sort();
    logger_1.logger.debug(`Discovered ${results.length} source files`);
    return results;
}
