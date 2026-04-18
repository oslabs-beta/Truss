import { DependencyGraph } from "./graphBuilder";

export function getTransitiveDependencies(
  graph: DependencyGraph,
  start: string
): Set<string> {
  const visited = new Set<string>();
  const stack = [start];

  while (stack.length > 0) {
    const node = stack.pop()!;
    const neighbors = graph.adjacency.get(node);

    if (!neighbors) continue;

    for (const next of neighbors) {
      if (!visited.has(next)) {
        visited.add(next);
        stack.push(next);
      }
    }
  }

  return visited;
}

export function findDependencyPath(
  graph: DependencyGraph,
  start: string,
  target: string
): string[] | null {
  if (start === target) return [start];

  const queue: string[][] = [[start]];
  const visited = new Set<string>([start]);

  while (queue.length > 0) {
    const path = queue.shift()!;
    const node = path[path.length - 1]!;
    const neighbors = [...(graph.adjacency.get(node) ?? new Set<string>())].sort();

    for (const next of neighbors) {
      if (visited.has(next)) continue;

      const nextPath = [...path, next];
      if (next === target) return nextPath;

      visited.add(next);
      queue.push(nextPath);
    }
  }

  return null;
}