import type { GraphNode } from "./graphNode";
import type { DependencyEdge }  from "../core/types";

/**
 * GraphEdge
 * One edge = one dependency from one node to another.
 * meta keeps the original DependencyEdge (line, importText, importKind, etc.)
 */
export type GraphEdge = {
  from: GraphNode;
  to: GraphNode;
  meta: DependencyEdge;
};

/**
 * createGraphEdge()
 * Purpose: Create a GraphEdge between two nodes and connect it to node lists.
 *
 * Input:
 *  - from: source node
 *  - to: target node
 *  - meta: original DependencyEdge data
 *
 * Output:
 *  - GraphEdge
 */
export function createGraphEdge(from: GraphNode, to: GraphNode, meta: DependencyEdge): GraphEdge {
  const edge: GraphEdge = { from, to, meta };

  // Connect edge to nodes (adjacency lists).
  from.outgoing.push(edge);
  to.incoming.push(edge);

  return edge;
}