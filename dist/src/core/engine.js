"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runCheck = runCheck;
const path = require("node:path");
const configLoader_1 = require("../config/configLoader");
const fileScanner_1 = require("../parser/fileScanner");
const dependencyGraph_1 = require("../graph/dependencyGraph");
const validator_1 = require("./validator");
const types_1 = require("./types");
const errors_1 = require("../utils/errors");
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
async function runCheck(opts) {
    try {
        // Make repoRoot an absolute path (safe and consistent).
        const repoRoot = path.resolve(opts.repoRoot);
        // Load and validate Truss config from file
        const config = (0, configLoader_1.loadTrussConfig)(path.resolve(repoRoot, opts.configPath), opts.configPath);
        // Find all source files in the repo (ts/tsx/js/jsx), respecting ignore rules.
        const files = (0, fileScanner_1.discoverSourceFiles)({
            repoRoot,
            extraIgnores: config.ignore,
        });
        // If we found nothing, config/paths are probably wrong.
        if (files.length === 0) {
            throw new errors_1.ConfigError("No source files found (.ts/.tsx/.js/.jsx). Check repoRoot/ignore settings.");
        }
        // Build a dependency graph and collect parser-level issues per file.
        const graph = (0, dependencyGraph_1.buildDependencyEdges)({ repoRoot, files });
        const edges = graph.edges;
        const parserIssues = graph.parserIssues;
        // Check edges against architecture rules and collect all violations.
        const { violations } = (0, validator_1.evaluateRules)({ config, edges });
        // Split violations into:
        // - unsuppressed (real failures)
        // - suppressed (allowed with reason)
        const { unsuppressed, suppressed } = (0, validator_1.applySuppressions)({ config, violations });
        const diagnostics = buildDiagnostics(parserIssues);
        const categories = countDiagnosticCategories(diagnostics);
        // Create final report object for rendering (human or JSON).
        const report = {
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
        // Exit code depends only on unsuppressed violations.
        const exitCode = report.summary.unsuppressedCount > 0 ? types_1.ExitCode.VIOLATIONS : types_1.ExitCode.OK;
        return { exitCode, report, analysis: report.analysis };
    }
    catch (e) {
        // If config is invalid or missing, return config error code.
        if (e instanceof errors_1.ConfigError) {
            return { exitCode: types_1.ExitCode.CONFIG_ERROR, error: e.message };
        }
        // Any other error is treated as internal error.
        return {
            exitCode: types_1.ExitCode.INTERNAL_ERROR,
            error: `Internal error: ${e.message}`,
        };
    }
}
function buildDiagnostics(parserIssues) {
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
function countDiagnosticCategories(diagnostics) {
    const counts = {
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
