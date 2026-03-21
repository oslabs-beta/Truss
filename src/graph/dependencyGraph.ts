import { parseImportsFromFile } from "../parser/importExtractor";
import { DependencyEdge, ParserIssue } from "../core/types";


/**
 * buildDependencyEdges()
 * Purpose: Build a full list of dependency edges for all source files.
 * It collects all imports and returns them as DependencyEdge objects.
 * The final list is sorted to keep output stable (important for CI).
 *
 * Input:
 *  - opts.repoRoot: absolute path to repository root
 *  - opts.files: array of source file paths to analyze
 *
 * Output:
 *  - DependencyEdge[] (full dependency graph as edges)
 */
export function buildDependencyEdges(opts: {
  repoRoot: string;
  files: string[];
}): { edges: DependencyEdge[]; parserIssues: ParserIssue[] } {
  const edges: DependencyEdge[] = [];
  const parserIssues: ParserIssue[] = [];

  // For each file, extract all import statements
  // and convert them into DependencyEdge objects.
  for (const file of opts.files) {
    const parsed = parseImportsFromFile({ repoRoot: opts.repoRoot, file });
    edges.push(...parsed.edges);
    parserIssues.push(...parsed.parserIssues);
  }

  // Sort edges for stable and deterministic output.
  // First by source file, then by line number, then by target file.
  edges.sort(
    (a, b) =>
      a.fromFile.localeCompare(b.fromFile) ||
      a.line - b.line ||
      targetKey(a).localeCompare(targetKey(b)),
  );

  return { edges, parserIssues };
}

function targetKey(e: DependencyEdge): string {
  return e.importKind === "internal" ? e.toFile : e.packageName
}
