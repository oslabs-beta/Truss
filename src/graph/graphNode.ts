import type { GraphEdge } from "./graphEdge";

/**
 * GraphNode
 * One node = one source file in the repo.
 * It stores outgoing and incoming edges for graph algorithms (like cycle detection).
 */
export type GraphNode = {
  file: string;
  outgoing: GraphEdge[];
  incoming: GraphEdge[];
};

/**
 * createGraphNode()
 * Purpose: Create a GraphNode for a file.
 *
 * Input:
 *  - file: repo-relative file path
 *
 * Output:
 *  - GraphNode with empty outgoing/incoming lists
 */
export function createGraphNode(file: string): GraphNode {
  return {
    file,
    outgoing: [],
    incoming: [],
  };
}