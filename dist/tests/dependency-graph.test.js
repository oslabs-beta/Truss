"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = require("node:assert/strict");
const path = require("node:path");
const cycleDetector_1 = require("../src/graph/cycleDetector");
const dependencyGraph_1 = require("../src/graph/dependencyGraph");
const packageRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const fixturesRoot = path.join(packageRoot, "tests", "fixtures");
function fixturePath(name) {
    return path.join(fixturesRoot, name);
}
function edgeKey(edge) {
    if (edge.importKind === "internal") {
        return `${edge.fromFile}->${edge.toFile}:${edge.line}`;
    }
    return `${edge.fromFile}->${edge.packageName}:${edge.line}`;
}
(0, node_test_1.default)("buildDependencyEdges prevents cycle recursion and deduplicates deterministically", () => {
    const repoRoot = fixturePath("cycle-repo");
    const files = ["src/a.ts", "src/b.ts", "src/c.ts"];
    const reversed = [...files].reverse();
    const first = (0, dependencyGraph_1.buildDependencyEdges)({ repoRoot, files });
    const second = (0, dependencyGraph_1.buildDependencyEdges)({ repoRoot, files: reversed });
    strict_1.default.strictEqual(first.parserIssues.length, 0);
    strict_1.default.strictEqual(first.edges.length, 4);
    strict_1.default.strictEqual(new Set(first.edges.map(edgeKey)).size, first.edges.length);
    strict_1.default.deepStrictEqual(first.edges.map(edgeKey), [
        "src/a.ts->src/b.ts:1",
        "src/b.ts->src/a.ts:1",
        "src/c.ts->src/a.ts:1",
        "src/c.ts->src/b.ts:2",
    ]);
    strict_1.default.deepStrictEqual(second.parserIssues, first.parserIssues);
    strict_1.default.deepStrictEqual(second.edges.map(edgeKey), first.edges.map(edgeKey));
});
(0, node_test_1.default)("detectCycles finds a simple cycle deterministically", () => {
    const adjacency = new Map([
        ["src/a.ts", new Set(["src/b.ts"])],
        ["src/b.ts", new Set(["src/c.ts"])],
        ["src/c.ts", new Set(["src/a.ts"])],
    ]);
    const nodes = new Set(adjacency.keys());
    const graph = {
        nodes,
        adjacency,
    };
    const cycles = (0, cycleDetector_1.detectCycles)(graph);
    strict_1.default.deepEqual(cycles, [
        {
            path: [
                "src/a.ts",
                "src/b.ts",
                "src/c.ts",
                "src/a.ts",
            ],
        },
    ]);
});
