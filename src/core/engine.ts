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

    // Load config
    logger.debug("Loading config...");
    const config = loadTrussConfig(
      path.resolve(repoRoot, opts.configPath),
      opts.configPath
    );

    // Discover files
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

    // Build dependency graph (NEW API)
    logger.debug("Building dependency graph...");
    const graph = buildDependencyEdges({ repoRoot, files });

    const edges = graph.edges;
    const parserIssues = graph.parserIssues;

    logger.debug(`Built ${edges.length} dependency edges`);
    logger.debug(`Collected ${parserIssues.length} parser issues`);

    // Evaluate rules
    logger.debug("Evaluating architecture rules...");
    const { violations } = evaluateRules({ config, edges });
    logger.debug(
      `Found ${violations.length} total violations before suppressions`
    );

    // Apply suppressions
    logger.debug("Applying suppressions...");
    const { unsuppressed, suppressed } = applySuppressions({
      config,
      violations,
    });

    logger.debug(
      `Unsuppressed: ${unsuppressed.length}, suppressed: ${suppressed.length}`
    );

    // Build diagnostics
    const diagnostics = buildDiagnostics(parserIssues);
    const categories = countDiagnosticCategories(diagnostics);

    // Final report
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

    return { exitCode, report, analysis: report.analysis };
  } catch (e) {
    if (e instanceof ConfigError) {
      logger.error(`Config error: ${e.message}`);
      return { exitCode: ExitCode.CONFIG_ERROR, error: e.message };
    }

    logger.error(`Internal error: ${(e as Error).message}`);
    return {
      exitCode: ExitCode.INTERNAL_ERROR,
      error: `Internal error: ${(e as Error).message}`,
    };
  }
}

// shuangfei below ruleEngine.js

const NoCrossLayerRule = require("../rules/NoCrossLayerRule")
const SuppressionEngine = require("../rules/SuppressionEngine")
const { parseInlineSuppressions } = require("../rules/InlineSuppressionParser")

function getLayerFromPath(path) {
  if (path.includes("api")) return "api"
  if (path.includes("db")) return "db"
  if (path.includes("service")) return "service"
  return "unknown"
}

function runEngine(filePath, fileContent) {
  // Step 1: Parse imports
  const imports = parseImports(fileContent)

  // Step 2: Parse inline suppressions
  const inlineSuppressions = parseInlineSuppressions(fileContent)

  // Step 3: Create rule instances (pretend parsed from YAML)
  const rules = [
    new NoCrossLayerRule({
      id: "no-cross-layer",
      from: "api",
      to: "db"
    })
  ]

  // Step 4: Evaluate rules
  let violations = []

  for (const rule of rules) {
    violations.push(
      ...rule.evaluate({
        filePath,
        imports,
        getLayerFromPath
      })
    )
  }

  return counts;
}
