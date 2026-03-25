import { parseImportsFromFile } from "../parser/importExtractor";
import { DependencyEdge, ParserIssue } from "../core/types";
import { logger } from "../utils/logger";

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
