import * as path from "node:path";
import { loadTrussConfig } from "../config/configLoader";
import { discoverSourceFiles } from "../parser/fileScanner";
import { buildDependencyEdges } from "../graph/dependencyGraph";
import { applySuppressions, evaluateRules } from "./validator";
import { CheckOptions, ExitCode, TrussReport } from "./types";
import { ConfigError } from "../utils/errors";
import { logger } from "../utils/logger";

export type CheckRunResult =
  | {
      exitCode: typeof ExitCode.OK | typeof ExitCode.VIOLATIONS;
      report: TrussReport;
    }
  | {
      exitCode: typeof ExitCode.CONFIG_ERROR | typeof ExitCode.INTERNAL_ERROR;
      error: string;
    };

/**
 * runCheck()
 * Purpose: Main orchestration function for "truss check".
 * It runs the full pipeline:
 *   1) Load config
 *   2) Scan repo for source files
 *   3) Build dependency edges (imports)
 *   4) Evaluate rules (create violations)
 *   5) Apply suppressions (split violations)
 *   6) Build final report + choose exit code
 *
 * Input:
 *  - opts: CheckOptions object (repoRoot, configPath, format, showSuppressed)
 * Output:
 *  - Promise that resolves to:
 *      { exitCode, report } on completed analysis
 *      { exitCode, error } on config/internal failure
 */
export async function runCheck(
  opts: CheckOptions
): Promise<CheckRunResult> {
  try {
    // Make repoRoot an absolute path (safe and consistent).
    const repoRoot = path.resolve(opts.repoRoot);

    logger.debug(`Starting Truss check in ${repoRoot}`)

    // Load and validate Truss config from file
    logger.debug("Loading config...")
    const config = loadTrussConfig(
      path.resolve(repoRoot, opts.configPath),
      opts.configPath,
    );

    // Find all source files in the repo (ts/tsx/js/jsx), respecting ignore rules.
    logger.debug("Scanning source files...")
    const files = discoverSourceFiles({
      repoRoot,
      extraIgnores: config.ignore,
    });
    logger.debug(`Found ${files.length} source files`)

    // If we found nothing, config/paths are probably wrong.
    if (files.length === 0) {
      throw new ConfigError(
        "No source files found (.ts/.tsx/.js/.jsx). Check repoRoot/ignore settings."
      );
    }

    // Build a dependency graph as edges: fromFile -> toFile for every import.
    logger.debug("Building dependency edges...");
    const edges = buildDependencyEdges({ repoRoot, files });
    logger.debug(`Built ${edges.length} dependency edges`);

    // Check edges against architecture rules and collect all violations.
    logger.debug("Evaluating architecture rules...");
    const { violations } = evaluateRules({ config, edges });
    logger.debug(`Found ${violations.length} total violations before suppressions`);

    // Split violations into:
    // - unsuppressed (real failures)
    // - suppressed (allowed with reason)
    logger.debug("Applying suppressions...");
    const { unsuppressed, suppressed } = applySuppressions({ config, violations });
    logger.debug( `Unsuppressed: ${unsuppressed.length}, suppressed: ${suppressed.length}`,
);

    // Create final report object for rendering (human or JSON).
    const report: TrussReport = {
      checkedFiles: files.length,
      edges: edges.length,
      unsuppressed,
      suppressed,
      summary: {
        unsuppressedCount: unsuppressed.length,
        suppressedCount: suppressed.length,
        totalCount: unsuppressed.length + suppressed.length,
      },
    };

    // Exit code depends only on unsuppressed violations.
    const exitCode =
      report.summary.unsuppressedCount > 0 ? ExitCode.VIOLATIONS : ExitCode.OK;

      logger.debug(`Check completed with exit code ${exitCode}`);

    return { exitCode, report };
  } catch (e) {
    // If config is invalid or missing, return config error code.
    if (e instanceof ConfigError) {
      logger.error(`Config error: ${e.message}`);
      return { exitCode: ExitCode.CONFIG_ERROR, error: e.message };
    }

    // Any other error is treated as internal error.
    logger.error(`Internal error: ${(e as Error).message}`);
    return {
      exitCode: ExitCode.INTERNAL_ERROR,
      error: `Internal error: ${(e as Error).message}`,
    };
  }
}
