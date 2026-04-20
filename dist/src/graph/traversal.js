"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTransitiveDependencies = getTransitiveDependencies;
exports.findDependencyPath = findDependencyPath;
function getTransitiveDependencies(graph, start) {
    const visited = new Set();
    const stack = [start];
    while (stack.length > 0) {
        const node = stack.pop();
        const neighbors = graph.adjacency.get(node);
        if (!neighbors)
            continue;
        for (const next of neighbors) {
            if (!visited.has(next)) {
                visited.add(next);
                stack.push(next);
            }
        }
    }
    return visited;
}
function findDependencyPath(graph, start, target) {
    if (start === target)
        return [start];
    const queue = [[start]];
    const visited = new Set([start]);
    while (queue.length > 0) {
        const path = queue.shift();
        const node = path[path.length - 1];
        const neighbors = [...(graph.adjacency.get(node) ?? new Set())].sort();
        for (const next of neighbors) {
            if (visited.has(next))
                continue;
            const nextPath = [...path, next];
            if (next === target)
                return nextPath;
            visited.add(next);
            queue.push(nextPath);
        }
    }
    return null;
}
