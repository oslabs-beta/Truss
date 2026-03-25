import { parseImportsFromFile } from "../parser/importExtractor";
import { DependencyEdge, ParserIssue } from "../core/types";
import { logger } from "../utils/logger";
import { GraphNode, createGraphNode } from "./graphNode";
import { createGraphEdge } from "./graphEdge";

export function buildDependencyEdges(opts: {
  repoRoot: string;
  files: string[];
}): { edges: DependencyEdge[]; parserIssues: ParserIssue[] } {
  const edges: DependencyEdge[] = [];
  const parserIssues: ParserIssue[] = [];

  logger.debug(`Building dependency edges for ${opts.files.length} files`);

  for (const file of opts.files) {
    try {
      const parsed = parseImportsFromFile({ repoRoot: opts.repoRoot, file });
      edges.push(...parsed.edges);
      parserIssues.push(...parsed.parserIssues);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "unknown parser error";

      logger.error(`Failed to analyze dependencies for ${file}: ${message}`);

      // Isolate this file-level failure and continue analyzing the rest.
      parserIssues.push({
        code: "SOURCE_FILE_READ_FAILED",
        severity: "error",
        message: `Failed to analyze source file dependencies: ${message}`,
        fromFile: file,
      });
    }
  }

  // Sorting by source location and target keeps reports and snapshots stable across runs.
  edges.sort(
    (a, b) =>
      a.fromFile.localeCompare(b.fromFile) ||
      a.line - b.line ||
      targetKey(a).localeCompare(targetKey(b)),
  );

  logger.debug(`Final dependency edge count: ${edges.length}`);
  logger.debug(`Total parser issues: ${parserIssues.length}`);

  return { edges, parserIssues };
}

function targetKey(e: DependencyEdge): string {
  // Internal edges sort by destination file, external edges by package name.
  return e.importKind === "internal" ? e.toFile : e.packageName;
}

export function buildGraph(edges: DependencyEdge[]): Map<string, GraphNode> {
  const nodes = new Map<string, GraphNode>();

  const getOrCreate = (file: string): GraphNode => {
    let node = nodes.get(file);
    if (!node) {
      node = createGraphNode(file);
      nodes.set(file, node);
    }
    return node;
  };

  for (const edge of edges) {
    // skip external imports — no source node to walk into
    if (edge.importKind !== "internal") continue;
    const from = getOrCreate(edge.fromFile);
    const to = getOrCreate(edge.toFile);
    createGraphEdge(from, to, edge);
  }

  return nodes;
}

export function resolveTransitiveEdges(
  graph: Map<string, GraphNode>,
  directEdges: DependencyEdge[],
): DependencyEdge[] {
  const transitiveEdges: DependencyEdge[] = [];

  for (const startFile of [...graph.keys()].sort()) {
    // visited guards against cycles
    const visited = new Set<string>([startFile]);
    const queue: string[] = [startFile];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const node = graph.get(current);
      if (!node) continue;

      for (const edge of [...node.outgoing].sort((a, b) =>
        a.to.file.localeCompare(b.to.file),
      )) {
        if (!visited.has(edge.to.file)) {
          visited.add(edge.to.file);
          queue.push(edge.to.file);
        }
      }
    }

    // drop the origin itself
    visited.delete(startFile);

    const directTargets = new Set<string>(
      directEdges
        .filter((e) => e.importKind === "internal" && e.fromFile === startFile)
        .map((e) => e.toFile),
    );

    for (const reachable of [...visited].sort()) {
      if (!directTargets.has(reachable)) {
        transitiveEdges.push({
          importKind: "internal",
          fromFile: startFile,
          toFile: reachable,
          importText: "(transitive)",
          line: 0,
        });
      }
    }
  }

  return [...directEdges, ...transitiveEdges];
}
