import { parseImportsFromFile } from "../parser/importExtractor";
import { DependencyEdge } from "../core/types";

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
}): DependencyEdge[] {
  const edges: DependencyEdge[] = [];

  // For each file, extract all import statements
  // and convert them into DependencyEdge objects.
  for (const file of opts.files) {
    edges.push(...parseImportsFromFile({ repoRoot: opts.repoRoot, file }));
  }

  // Sort edges for stable and deterministic output.
  // First by source file, then by line number, then by target file.
  edges.sort(
    (a, b) =>
      a.fromFile.localeCompare(b.fromFile) ||
      a.line - b.line ||
      a.toFile.localeCompare(b.toFile),
  );

  return edges;
}
