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
const logger_1 = require("../utils/logger");
async function runCheck(opts) {
    try {
        const repoRoot = path.resolve(opts.repoRoot);
        logger_1.logger.debug(`Starting Truss check in ${repoRoot}`);
        // Load config
        logger_1.logger.debug("Loading config...");
        const config = (0, configLoader_1.loadTrussConfig)(path.resolve(repoRoot, opts.configPath), opts.configPath);
        // Discover files
        logger_1.logger.debug("Scanning source files...");
        const files = (0, fileScanner_1.discoverSourceFiles)({
            repoRoot,
            extraIgnores: config.ignore,
        });
        logger_1.logger.debug(`Found ${files.length} source files`);
        if (files.length === 0) {
            throw new errors_1.ConfigError("No source files found (.ts/.tsx/.js/.jsx). Check repoRoot/ignore settings.");
        }
        // Build dependency graph (NEW API)
        logger_1.logger.debug("Building dependency graph...");
        const graph = (0, dependencyGraph_1.buildDependencyEdges)({ repoRoot, files });
        const edges = graph.edges;
        const parserIssues = graph.parserIssues;
        logger_1.logger.debug(`Built ${edges.length} dependency edges`);
        logger_1.logger.debug(`Collected ${parserIssues.length} parser issues`);
        // Evaluate rules
        logger_1.logger.debug("Evaluating architecture rules...");
        const { violations } = (0, validator_1.evaluateRules)({ config, edges });
        logger_1.logger.debug(`Found ${violations.length} total violations before suppressions`);
        // Apply suppressions
        logger_1.logger.debug("Applying suppressions...");
        const { unsuppressed, suppressed } = (0, validator_1.applySuppressions)({
            config,
            violations,
        });
        logger_1.logger.debug(`Unsuppressed: ${unsuppressed.length}, suppressed: ${suppressed.length}`);
        // Build diagnostics
        const diagnostics = buildDiagnostics(parserIssues);
        const categories = countDiagnosticCategories(diagnostics);
        // Final report
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
        const exitCode = report.summary.unsuppressedCount > 0
            ? types_1.ExitCode.VIOLATIONS
            : types_1.ExitCode.OK;
        logger_1.logger.debug(`Check completed with exit code ${exitCode}`);
        return { exitCode, report };
    }
    catch (e) {
        if (e instanceof errors_1.ConfigError) {
            logger_1.logger.error(`Config error: ${e.message}`);
            return { exitCode: types_1.ExitCode.CONFIG_ERROR, error: e.message };
        }
        logger_1.logger.error(`Internal error: ${e.message}`);
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
