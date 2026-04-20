"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectCycles = detectCycles;
function detectCycles(graph) {
    const visited = new Set();
    const visiting = new Set();
    const stack = [];
    const cycleKeys = new Set();
    const cycles = [];
    const sortedNodes = [...graph.nodes].sort();
    function visit(node) {
        visited.add(node);
        visiting.add(node);
        stack.push(node);
        const neighbors = [...(graph.adjacency.get(node) ?? new Set())].sort();
        for (const neighbor of neighbors) {
            if (!visited.has(neighbor)) {
                visit(neighbor);
                continue;
            }
            if (visiting.has(neighbor)) {
                const startIndex = stack.indexOf(neighbor);
                if (startIndex === -1)
                    continue;
                const cyclePath = [...stack.slice(startIndex), neighbor];
                const cycleKey = cyclePath.join(" -> ");
                if (!cycleKeys.has(cycleKey)) {
                    cycleKeys.add(cycleKey);
                    cycles.push({ path: cyclePath });
                }
            }
        }
        stack.pop();
        visiting.delete(node);
    }
    for (const node of sortedNodes) {
        if (!visited.has(node)) {
            visit(node);
        }
    }
    return cycles;
}
