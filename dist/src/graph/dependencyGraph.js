"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildDependencyEdges = buildDependencyEdges;
exports.buildGraphFromEdges = buildGraphFromEdges;
const importExtractor_1 = require("../parser/importExtractor");
const logger_1 = require("../utils/logger");
function buildDependencyEdges(opts) {
    const edges = [];
    const parserIssues = [];
    // only recurse into files that were discovered — prevents ignored files
    // from being reintroduced transitively
    const discoveredFiles = new Set(opts.files);
    const parseCache = new Map();
    const parserIssuesSeenForFile = new Set();
    const emittedEdgeKeys = new Set();
    logger_1.logger.debug(`Building dependency edges for ${opts.files.length} files`);
    const rootFiles = [...opts.files].sort((a, b) => a.localeCompare(b));
    for (const file of rootFiles) {
        traverseInternalDependencies(file, {
            visiting: new Set(),
            visited: new Set(),
        });
    }
    function parseWithCache(file) {
        const cached = parseCache.get(file);
        if (cached)
            return cached;
        try {
            const parsed = (0, importExtractor_1.parseImportsFromFile)({ repoRoot: opts.repoRoot, file });
            parseCache.set(file, parsed);
            return parsed;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "unknown parser error";
            logger_1.logger.error(`Failed to analyze dependencies for ${file}: ${message}`);
            // Isolate this file-level failure and continue analyzing the rest.
            const failed = {
                edges: [],
                parserIssues: [
                    {
                        code: "SOURCE_FILE_READ_FAILED",
                        severity: "error",
                        message: `Failed to analyze source file dependencies: ${message}`,
                        fromFile: file,
                    },
                ],
            };
            parseCache.set(file, failed);
            return failed;
        }
    }
    function traverseInternalDependencies(file, state) {
        // Per-root cycle guard: bail when we revisit a file still being expanded.
        if (state.visiting.has(file) || state.visited.has(file))
            return;
        state.visiting.add(file);
        const parsed = parseWithCache(file);
        if (!parserIssuesSeenForFile.has(file)) {
            parserIssuesSeenForFile.add(file);
            parserIssues.push(...parsed.parserIssues);
        }
        const sortedEdges = [...parsed.edges].sort(compareEdges);
        for (const edge of sortedEdges) {
            const key = edgeDedupKey(edge);
            if (emittedEdgeKeys.has(key))
                continue;
            emittedEdgeKeys.add(key);
            edges.push(edge);
        }
        const sortedInternalTargets = sortedEdges
            .filter((edge) => edge.importKind === "internal")
            .map((edge) => edge.toFile)
            .sort((a, b) => a.localeCompare(b));
        for (const toFile of sortedInternalTargets) {
            if (discoveredFiles.has(toFile)) {
                traverseInternalDependencies(toFile, state);
            }
        }
        state.visiting.delete(file);
        state.visited.add(file);
    }
    // Sorting by source location and target keeps reports and snapshots stable across runs.
    edges.sort(compareEdges);
    logger_1.logger.debug(`Final dependency edge count: ${edges.length}`);
    logger_1.logger.debug(`Total parser issues: ${parserIssues.length}`);
    return { edges, parserIssues };
}
function targetKey(e) {
    // Internal edges sort by destination file, external edges by package name.
    return e.importKind === "internal" ? e.toFile : e.packageName;
}
function edgeDedupKey(edge) {
    // Stable key keeps transitive traversal deterministic across roots and cycles.
    const toKey = edge.importKind === "internal" ? edge.toFile : edge.packageName;
    return [
        edge.importKind,
        edge.fromFile,
        toKey,
        edge.line.toString(),
        edge.importText,
    ].join("|");
}
function compareEdges(a, b) {
    return (a.fromFile.localeCompare(b.fromFile) ||
        a.line - b.line ||
        targetKey(a).localeCompare(targetKey(b)) ||
        a.importKind.localeCompare(b.importKind) ||
        a.importText.localeCompare(b.importText));
}
function buildGraphFromEdges(edges) {
    const graph = new Map();
    for (const edge of edges) {
        if (edge.importKind !== "internal")
            continue;
        const neighbors = graph.get(edge.fromFile);
        if (neighbors) {
            neighbors.add(edge.toFile);
        }
        else {
            graph.set(edge.fromFile, new Set([edge.toFile]));
        }
        if (!graph.has(edge.toFile)) {
            graph.set(edge.toFile, new Set());
        }
    }
    return graph;
}
