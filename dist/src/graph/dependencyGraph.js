"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildDependencyEdges = buildDependencyEdges;
const importExtractor_1 = require("../parser/importExtractor");
const logger_1 = require("../utils/logger");
/**
 * buildDependencyEdges()
 */
function buildDependencyEdges(opts) {
    const edges = [];
    const parserIssues = [];
    logger_1.logger.debug(`Building dependency edges for ${opts.files.length} files`);
    for (const file of opts.files) {
        try {
            const parsed = (0, importExtractor_1.parseImportsFromFile)({ repoRoot: opts.repoRoot, file });
            edges.push(...parsed.edges);
            parserIssues.push(...parsed.parserIssues);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "unknown parser error";
            logger_1.logger.error(`Failed to analyze dependencies for ${file}: ${message}`);
            // Isolate this file-level failure and continue analyzing the rest.
            parserIssues.push({
                code: "SOURCE_FILE_READ_FAILED",
                severity: "error",
                message: `Failed to analyze source file dependencies: ${message}`,
                fromFile: file,
            });
        }
    }
    edges.sort((a, b) => a.fromFile.localeCompare(b.fromFile) ||
        a.line - b.line ||
        targetKey(a).localeCompare(targetKey(b)));
    logger_1.logger.debug(`Final dependency edge count: ${edges.length}`);
    logger_1.logger.debug(`Total parser issues: ${parserIssues.length}`);
    return { edges, parserIssues };
}
function targetKey(e) {
    return e.importKind === "internal" ? e.toFile : e.packageName;
}
