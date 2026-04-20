"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildGraphFromEdges = buildGraphFromEdges;
function buildGraphFromEdges(edges) {
    const nodes = new Set();
    const adjacency = new Map();
    function ensureNode(file) {
        nodes.add(file);
        if (!adjacency.has(file)) {
            adjacency.set(file, new Set());
        }
    }
    for (const edge of edges) {
        if (edge.importKind !== "internal")
            continue;
        ensureNode(edge.fromFile);
        ensureNode(edge.toFile);
        adjacency.get(edge.fromFile).add(edge.toFile);
    }
    return {
        nodes,
        adjacency,
    };
}
