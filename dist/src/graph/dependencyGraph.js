"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildDependencyEdges = buildDependencyEdges;
const importExtractor_1 = require("../parser/importExtractor");
/**
 * buildDependencyEdges()
 * Purpose: Build a full list of dependency edges for all source files.
 * It collects all imports and returns them as DependencyEdge objects.
 * The final list is sorted to keep output stable (important for CI).
 *
 * Input:
 *  - opts.repoRoot: absolute path to repository root
 *  - opts.files: array of source file paths to analyze
 *
 * Output:
 *  - DependencyEdge[] (full dependency graph as edges)
 */
function buildDependencyEdges(opts) {
    const edges = [];
    const parserIssues = [];
    // For each file, extract all import statements
    // and convert them into DependencyEdge objects.
    for (const file of opts.files) {
        const parsed = (0, importExtractor_1.parseImportsFromFile)({ repoRoot: opts.repoRoot, file });
        edges.push(...parsed.edges);
        parserIssues.push(...parsed.parserIssues);
    }
    // Sort edges for stable and deterministic output.
    // First by source file, then by line number, then by target file.
    edges.sort((a, b) => a.fromFile.localeCompare(b.fromFile) ||
        a.line - b.line ||
        targetKey(a).localeCompare(targetKey(b)));
    return { edges, parserIssues };
}
function targetKey(e) {
    return e.importKind === "internal" ? e.toFile : e.packageName;
}
