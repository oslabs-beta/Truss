import { DependencyEdge } from "../core/types";

export type DependencyGraph = {
  nodes: Set<string>;
  adjacency: Map<string, Set<string>>;
};

export function buildGraphFromEdges(
  edges: DependencyEdge[]
): DependencyGraph {
  const nodes = new Set<string>();
  const adjacency = new Map<string, Set<string>>();

  function ensureNode(file: string): void {
    nodes.add(file);

    if (!adjacency.has(file)) {
      adjacency.set(file, new Set<string>());
    }
  }

  for (const edge of edges) {
    if (edge.importKind !== "internal") continue;

    ensureNode(edge.fromFile);
    ensureNode(edge.toFile);

    adjacency.get(edge.fromFile)!.add(edge.toFile);
  }

  return {
    nodes,
    adjacency,
  };
}