import * as path from "node:path";
import { loadTrussConfig, ConfigError } from "../config/configLoader";
import { discoverSourceFiles } from "../parser/fileScanner";
import { buildDependencyEdges } from "../graph/dependencyGraph";
import { applySuppressions, evaluateRules } from "./validator";
import { CheckOptions, ExitCode, TrussReport } from "./types";

/**
 * emptyReport()
 * Purpose: Create a default (empty) report object.
 * We use it when an error happens, so CLI still returns valid JSON/report shape.
 * Input: none
 * Output: TrussReport with zero counts and empty arrays
 */
function emptyReport(): TrussReport {
  return {
    checkedFiles: 0,
    edges: 0,
    unsuppressed: [],
    suppressed: [],
    summary: { unsuppressedCount: 0, suppressedCount: 0, totalCount: 0 },
  };
}

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
 *      { exitCode: number, report: TrussReport }
 */
export async function runCheck(
  opts: CheckOptions
): Promise<{ exitCode: number; report: TrussReport }> {
  try {
    // Make repoRoot an absolute path (safe and consistent).
    const repoRoot = path.resolve(opts.repoRoot);

    // Load and validate Truss config from file
    const config = loadTrussConfig(path.resolve(repoRoot, opts.configPath));

    // Find all source files in the repo (ts/tsx/js/jsx), respecting ignore rules.
    const files = discoverSourceFiles({
      repoRoot,
      extraIgnores: config.ignore,
    });

    // If we found nothing, config/paths are probably wrong.
    if (files.length === 0) {
      throw new ConfigError(
        "No source files found (.ts/.tsx/.js/.jsx). Check repoRoot/ignore settings."
      );
    }

    // Build a dependency graph as edges: fromFile -> toFile for every import.
    const edges = buildDependencyEdges({ repoRoot, files });

    // Check edges against architecture rules and collect all violations.
    const { violations } = evaluateRules({ config, edges });

    // Split violations into:
    // - unsuppressed (real failures)
    // - suppressed (allowed with reason)
    const { unsuppressed, suppressed } = applySuppressions({ config, violations });

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

    return { exitCode, report };
  } catch (e) {
    // If config is invalid or missing, return config error code.
    if (e instanceof ConfigError) {
      return { exitCode: ExitCode.CONFIG_ERROR, report: emptyReport() };
    }

    // Any other error is treated as internal error.
    return { exitCode: ExitCode.INTERNAL_ERROR, report: emptyReport() };
  }
}
