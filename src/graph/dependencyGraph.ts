import { parseImportsFromFile } from "../parser/importExtractor";
import { DependencyEdge, ParserIssue } from "../core/types";
import { logger } from "../utils/logger";

export function buildDependencyEdges(opts: {
  repoRoot: string;
  files: string[];
}): { edges: DependencyEdge[]; parserIssues: ParserIssue[] } {
  const edges: DependencyEdge[] = [];
  const parserIssues: ParserIssue[] = [];
  // only recurse into files that were discovered — prevents ignored files
  // from being reintroduced transitively
  const discoveredFiles = new Set(opts.files);
  const parseCache = new Map<
    string,
    { edges: DependencyEdge[]; parserIssues: ParserIssue[] }
  >();
  const parserIssuesSeenForFile = new Set<string>();
  const emittedEdgeKeys = new Set<string>();

  logger.debug(`Building dependency edges for ${opts.files.length} files`);

  const rootFiles = [...opts.files].sort((a, b) => a.localeCompare(b));
  for (const file of rootFiles) {
    traverseInternalDependencies(file, {
      visiting: new Set<string>(),
      visited: new Set<string>(),
    });
  }

  function parseWithCache(file: string): {
    edges: DependencyEdge[];
    parserIssues: ParserIssue[];
  } {
    const cached = parseCache.get(file);
    if (cached) return cached;

    try {
      const parsed = parseImportsFromFile({ repoRoot: opts.repoRoot, file });
      parseCache.set(file, parsed);
      return parsed;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "unknown parser error";

      logger.error(`Failed to analyze dependencies for ${file}: ${message}`);

      // Isolate this file-level failure and continue analyzing the rest.
      const failed: { edges: DependencyEdge[]; parserIssues: ParserIssue[] } = {
        edges: [],
        parserIssues: [
          {
            code: "SOURCE_FILE_READ_FAILED",
            severity: "error",
            message: `Failed to analyze source file dependencies: ${message}`,
            fromFile: file,
          },
        ],
      };
      parseCache.set(file, failed);
      return failed;
    }
  }

  function traverseInternalDependencies(
    file: string,
    state: { visiting: Set<string>; visited: Set<string> },
  ): void {
    // Per-root cycle guard: bail when we revisit a file still being expanded.
    if (state.visiting.has(file) || state.visited.has(file)) return;
    state.visiting.add(file);

    const parsed = parseWithCache(file);

    if (!parserIssuesSeenForFile.has(file)) {
      parserIssuesSeenForFile.add(file);
      parserIssues.push(...parsed.parserIssues);
    }

    const sortedEdges = [...parsed.edges].sort(compareEdges);

    for (const edge of sortedEdges) {
      const key = edgeDedupKey(edge);
      if (emittedEdgeKeys.has(key)) continue;
      emittedEdgeKeys.add(key);
      edges.push(edge);
    }

    const sortedInternalTargets = sortedEdges
      .filter((edge) => edge.importKind === "internal")
      .map((edge) => edge.toFile)
      .sort((a, b) => a.localeCompare(b));

    for (const toFile of sortedInternalTargets) {
      if (discoveredFiles.has(toFile)) {
        traverseInternalDependencies(toFile, state);
      }
    }

    state.visiting.delete(file);
    state.visited.add(file);
  }

  // Sorting by source location and target keeps reports and snapshots stable across runs.
  edges.sort(compareEdges);

  logger.debug(`Final dependency edge count: ${edges.length}`);
  logger.debug(`Total parser issues: ${parserIssues.length}`);

  return { edges, parserIssues };
}

function targetKey(e: DependencyEdge): string {
  // Internal edges sort by destination file, external edges by package name.
  return e.importKind === "internal" ? e.toFile : e.packageName;
}

function edgeDedupKey(edge: DependencyEdge): string {
  // Stable key keeps transitive traversal deterministic across roots and cycles.
  const toKey = edge.importKind === "internal" ? edge.toFile : edge.packageName;
  return [
    edge.importKind,
    edge.fromFile,
    toKey,
    edge.line.toString(),
    edge.importText,
  ].join("|");
}

function compareEdges(a: DependencyEdge, b: DependencyEdge): number {
  return (
    a.fromFile.localeCompare(b.fromFile) ||
    a.line - b.line ||
    targetKey(a).localeCompare(targetKey(b)) ||
    a.importKind.localeCompare(b.importKind) ||
    a.importText.localeCompare(b.importText)
  );
}
