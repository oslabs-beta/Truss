import * as path from "node:path";
import { loadTrussConfig } from "../config/configLoader";
import { discoverSourceFiles } from "../parser/fileScanner";
import { buildDependencyEdges } from "../graph/dependencyGraph";
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

export async function runCheck(
  opts: CheckOptions
): Promise<CheckRunResult> {
  try {
    const repoRoot = path.resolve(opts.repoRoot);

    logger.debug(`Starting Truss check in ${repoRoot}`);

    // Loads and validates the config before any filesystem or analysis work begins.
    logger.debug("Loading config...");
    const config = loadTrussConfig(
      path.resolve(repoRoot, opts.configPath),
      opts.configPath
    );

    // Scans the repo for supported source files after config ignores are applied.
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

    // Parses every discovered file and combines the dependency edges and parser warnings.
    logger.debug("Building dependency graph...");
    const graph = buildDependencyEdges({ repoRoot, files });

    const edges = graph.edges;
    const parserIssues = graph.parserIssues;

    logger.debug(`Built ${edges.length} dependency edges`);
    logger.debug(`Collected ${parserIssues.length} parser issues`);

    // Converts dependency edges into violations by comparing layer relationships to the rules.
    logger.debug("Evaluating architecture rules...");
    const { violations } = evaluateRules({ config, edges });
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

    // Exposes parser warnings through the structured diagnostics section of the report.
    const diagnostics = buildDiagnostics(parserIssues);
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

    const exitCode =
      report.summary.unsuppressedCount > 0
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
