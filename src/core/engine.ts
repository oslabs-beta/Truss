import * as path from "node:path";
import { loadTrussConfig } from "../config/configLoader";
import { discoverSourceFiles } from "../parser/fileScanner";
import { buildDependencyEdges } from "../graph/dependencyGraph";
import { buildGraphFromEdges } from "../graph/graphBuilder";
import { applySuppressions, evaluateRules } from "./validator";
import {
  AnalysisCategoryCounts,
  AnalysisDiagnostic,
  CheckOptions,
  CheckRunResult,
  ExitCode,
  ParserIssue,
  TrussReport,
} from "./types";
import { ConfigError } from "../utils/errors";
import { logger } from "../utils/logger";
import { detectCycles } from "../graph/cycleDetector";

// import { renderGraphAsDot } from "../graph/doRenderer";
// import * as fs from "node:fs";
type AnalysisResult = {
  repoRoot: string;
  config: ReturnType<typeof loadTrussConfig>;
  files: string[];
  edges: ReturnType<typeof buildDependencyEdges>["edges"];
  parserIssues: ReturnType<typeof buildDependencyEdges>["parserIssues"];
  graph: ReturnType<typeof buildGraphFromEdges>;
  cycles: { path: string[] }[];
};

export function runAnalysis(opts: {
  repoRoot: string;
  configPath: string;
}): AnalysisResult {
  const repoRoot = path.resolve(opts.repoRoot);

  logger.debug(`Starting Truss analysis in ${repoRoot}`);

  logger.debug("Loading config...");
  const config = loadTrussConfig(
    path.resolve(repoRoot, opts.configPath),
    opts.configPath
  );

  logger.debug("Scanning source files...");
  const files = discoverSourceFiles({
    repoRoot,
    extraIgnores: config.ignore,
  });
  logger.debug(`Found ${files.length} source files`);

  if (files.length === 0) {
    throw new ConfigError(
      "No source files found (.ts/.tsx/.js/.jsx). Check repoRoot/ignore settings."
    );
  }

  logger.debug("Building dependency edges...");
  const dependencyResult = buildDependencyEdges({ repoRoot, files });

  const edges = dependencyResult.edges;
  const parserIssues = dependencyResult.parserIssues;

  logger.debug(`Built ${edges.length} dependency edges`);
  logger.debug(`Collected ${parserIssues.length} parser issues`);

  logger.debug("Building internal dependency graph...");
  const graph = buildGraphFromEdges(edges);
  logger.debug(`Graph nodes: ${graph.nodes.size}`);

  logger.debug("Detecting dependency cycles...");
  const cycles = detectCycles(graph);
  logger.debug(`Detected ${cycles.length} cycle(s)`);

  return {
    repoRoot,
    config,
    files,
    edges,
    parserIssues,
    graph,
    cycles,
  };
}

export async function runCheck(
  opts: CheckOptions
): Promise<CheckRunResult> {
  try {
   const {
  config,
  files,
  edges,
  parserIssues,
  graph,
  cycles,
} = runAnalysis({
  repoRoot: opts.repoRoot,
  configPath: opts.configPath,
});

    // Converts dependency edges into violations by comparing layer relationships to the rules.
    logger.debug("Evaluating architecture rules...");
    const { violations } = evaluateRules({ config, edges, graph });
    logger.debug(
      `Found ${violations.length} total violations before suppressions`
    );

    // Moves matching violations into the suppressed bucket without removing them from the report.
    logger.debug("Applying suppressions...");
    const { unsuppressed, suppressed } = applySuppressions({
      config,
      violations,
    });

    logger.debug(
      `Unsuppressed: ${unsuppressed.length}, suppressed: ${suppressed.length}`
    );

    const parserDiagnostics = buildDiagnostics(parserIssues);
const graphDiagnostics = buildGraphDiagnostics(cycles);
const diagnostics = [...parserDiagnostics, ...graphDiagnostics];
const categories = countDiagnosticCategories(diagnostics);

    // Builds the final report shape consumed by both human and JSON formatters.
    const report: TrussReport = {
      checkedFiles: files.length,
      edges: edges.length,
      unsuppressed,
      suppressed,
      parserIssues,
      analysis: {
        diagnostics,
        categories,
      },
      summary: {
        unsuppressedCount: unsuppressed.length,
        suppressedCount: suppressed.length,
        parserIssueCount: parserIssues.length,
        diagnosticCount: diagnostics.length,
        totalCount: unsuppressed.length + suppressed.length,
      },
    };

    const hasGraphErrors = diagnostics.some(
  (d) => d.category === "graph" && d.severity === "error"
);

const exitCode =
  report.summary.unsuppressedCount > 0 || hasGraphErrors
    ? ExitCode.VIOLATIONS
    : ExitCode.OK;

    logger.debug(`Check completed with exit code ${exitCode}`);

    return { exitCode, report };
  } catch (e) {
    if (e instanceof ConfigError) {
      logger.error(`Config error: ${e.message}`);
      return { exitCode: ExitCode.CONFIG_ERROR, error: e.message };
    }

    const message = e instanceof Error ? e.message : String(e);
    logger.error(`Internal error: ${message}`);
    return {
      exitCode: ExitCode.INTERNAL_ERROR,
      error: `Internal error: ${message}`,
    };
  }
}

function buildDiagnostics(parserIssues: ParserIssue[]): AnalysisDiagnostic[] {
  // Re-maps parser issues into the generic diagnostics format used by report.analysis.
  return parserIssues.map((issue) => ({
    category: "parser",
    code: issue.code,
    severity: issue.severity,
    message: issue.message,
    file: issue.fromFile,
    line: issue.line,
    importText: issue.importText,
  }));
}

function buildGraphDiagnostics(
  cycles: { path: string[] }[]
): AnalysisDiagnostic[] {
  return cycles.map((cycle) => ({
    category: "graph",
    code: "DEPENDENCY_CYCLE",
    severity: "error",
    message: `Dependency cycle detected: ${cycle.path.join(" -> ")}`,
    file: cycle.path[0],
  }));
}

function countDiagnosticCategories(
  diagnostics: AnalysisDiagnostic[]
): AnalysisCategoryCounts {
  // Counts diagnostics by category so the report can show both the full list and a summary.
  const counts: AnalysisCategoryCounts = {
    parser: 0,
    graph: 0,
    validation: 0,
    suppression: 0,
  };

  for (const diagnostic of diagnostics) {
    counts[diagnostic.category] += 1;
  }

  return counts;
}
