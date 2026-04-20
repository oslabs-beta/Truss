"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.runAnalysis = runAnalysis;
exports.runCheck = runCheck;
const path = __importStar(require("node:path"));
const configLoader_1 = require("../config/configLoader");
const fileScanner_1 = require("../parser/fileScanner");
const dependencyGraph_1 = require("../graph/dependencyGraph");
const graphBuilder_1 = require("../graph/graphBuilder");
const validator_1 = require("./validator");
const types_1 = require("./types");
const errors_1 = require("../utils/errors");
const logger_1 = require("../utils/logger");
const cycleDetector_1 = require("../graph/cycleDetector");
function runAnalysis(opts) {
    const repoRoot = path.resolve(opts.repoRoot);
    logger_1.logger.debug(`Starting Truss analysis in ${repoRoot}`);
    logger_1.logger.debug("Loading config...");
    const config = (0, configLoader_1.loadTrussConfig)(path.resolve(repoRoot, opts.configPath), opts.configPath);
    logger_1.logger.debug("Scanning source files...");
    const files = (0, fileScanner_1.discoverSourceFiles)({
        repoRoot,
        extraIgnores: config.ignore,
    });
    logger_1.logger.debug(`Found ${files.length} source files`);
    if (files.length === 0) {
        throw new errors_1.ConfigError("No source files found (.ts/.tsx/.js/.jsx). Check repoRoot/ignore settings.");
    }
    logger_1.logger.debug("Building dependency edges...");
    const dependencyResult = (0, dependencyGraph_1.buildDependencyEdges)({ repoRoot, files });
    const edges = dependencyResult.edges;
    const parserIssues = dependencyResult.parserIssues;
    logger_1.logger.debug(`Built ${edges.length} dependency edges`);
    logger_1.logger.debug(`Collected ${parserIssues.length} parser issues`);
    logger_1.logger.debug("Building internal dependency graph...");
    const graph = (0, graphBuilder_1.buildGraphFromEdges)(edges);
    logger_1.logger.debug(`Graph nodes: ${graph.nodes.size}`);
    logger_1.logger.debug("Detecting dependency cycles...");
    const cycles = (0, cycleDetector_1.detectCycles)(graph);
    logger_1.logger.debug(`Detected ${cycles.length} cycle(s)`);
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
async function runCheck(opts) {
    try {
        const { config, files, edges, parserIssues, graph, cycles, } = runAnalysis({
            repoRoot: opts.repoRoot,
            configPath: opts.configPath,
        });
        // Converts dependency edges into violations by comparing layer relationships to the rules.
        logger_1.logger.debug("Evaluating architecture rules...");
        const { violations } = (0, validator_1.evaluateRules)({ config, edges, graph });
        logger_1.logger.debug(`Found ${violations.length} total violations before suppressions`);
        // Moves matching violations into the suppressed bucket without removing them from the report.
        logger_1.logger.debug("Applying suppressions...");
        const { unsuppressed, suppressed } = (0, validator_1.applySuppressions)({
            config,
            violations,
        });
        logger_1.logger.debug(`Unsuppressed: ${unsuppressed.length}, suppressed: ${suppressed.length}`);
        const parserDiagnostics = buildDiagnostics(parserIssues);
        const graphDiagnostics = buildGraphDiagnostics(cycles);
        const diagnostics = [...parserDiagnostics, ...graphDiagnostics];
        const categories = countDiagnosticCategories(diagnostics);
        // Builds the final report shape consumed by both human and JSON formatters.
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
        const hasGraphErrors = diagnostics.some((d) => d.category === "graph" && d.severity === "error");
        const exitCode = report.summary.unsuppressedCount > 0 || hasGraphErrors
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
        const message = e instanceof Error ? e.message : String(e);
        logger_1.logger.error(`Internal error: ${message}`);
        return {
            exitCode: types_1.ExitCode.INTERNAL_ERROR,
            error: `Internal error: ${message}`,
        };
    }
}
function buildDiagnostics(parserIssues) {
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
function buildGraphDiagnostics(cycles) {
    return cycles.map((cycle) => ({
        category: "graph",
        code: "DEPENDENCY_CYCLE",
        severity: "error",
        message: `Dependency cycle detected: ${cycle.path.join(" -> ")}`,
        file: cycle.path[0],
    }));
}
function countDiagnosticCategories(diagnostics) {
    // Counts diagnostics by category so the report can show both the full list and a summary.
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
