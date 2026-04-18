import { DependencyGraph } from "./graphBuilder";

export type GraphCycle = {
  path: string[];
};

export function detectCycles(graph: DependencyGraph): GraphCycle[] {
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const stack: string[] = [];
  const cycleKeys = new Set<string>();
  const cycles: GraphCycle[] = [];

  const sortedNodes = [...graph.nodes].sort();

  function visit(node: string): void {
    visited.add(node);
    visiting.add(node);
    stack.push(node);

    const neighbors = [...(graph.adjacency.get(node) ?? new Set<string>())].sort();

    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        visit(neighbor);
        continue;
      }

      if (visiting.has(neighbor)) {
        const startIndex = stack.indexOf(neighbor);
        if (startIndex === -1) continue;

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