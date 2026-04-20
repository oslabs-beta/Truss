"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderHumanReport = renderHumanReport;
exports.buildJsonReport = buildJsonReport;
exports.buildJsonError = buildJsonError;
exports.renderJsonReport = renderJsonReport;
exports.renderJsonError = renderJsonError;
const types_1 = require("./types");
const chalk_1 = __importDefault(require("chalk"));
function renderHumanReport(report, opts) {
    const lines = [];
    const uns = report.unsuppressed.length;
    const sup = report.suppressed.length;
    const parserIssueCount = report.parserIssues.length;
    if (uns > 0) {
        // The failure path prints unsuppressed violations first, then optional suppressed
        // details, followed by parser diagnostics and the final summary counts.
        lines.push(`Truss: Architectural violations found (${uns})`);
        lines.push("");
        const direct = report.unsuppressed.filter((v) => !v.path || v.path.length <= 1);
        const transitive = report.unsuppressed.filter((v) => v.path && v.path.length > 1);
        const useColor = process.stdout.isTTY;
        const red = (text) => (useColor ? chalk_1.default.red(text) : text);
        const yellow = (text) => (useColor ? chalk_1.default.yellow(text) : text);
        if (direct.length > 0) {
            lines.push(red(`Direct Violations (${direct.length})`));
            lines.push("--------------------------------");
            for (const v of direct) {
                lines.push(`${red("[VIOLATION]")} ${v.ruleName}`);
                lines.push(`Layers: ${v.fromLayer} -> ${v.toLayer}`);
                lines.push(`${v.edge.fromFile}:${v.edge.line}`);
                lines.push(`${v.edge.importText}`);
                lines.push(`Reason: ${v.reason}`);
                lines.push("");
            }
        }
        if (transitive.length > 0) {
            lines.push(yellow(`Transitive Violations (${transitive.length})`));
            lines.push("--------------------------------");
            for (const v of transitive) {
                lines.push(`${yellow("[TRANSITIVE VIOLATION]")} ${v.ruleName}`);
                lines.push(`Layers: ${v.fromLayer} -> ${v.toLayer}`);
                lines.push(`${v.edge.fromFile}:${v.edge.line}`);
                lines.push(`${v.edge.importText}`);
                lines.push(`Path: ${v.path.join(" -> ")}`);
                lines.push(`Reason: ${v.reason}`);
                lines.push("");
            }
        }
        if (sup > 0) {
            lines.push(`Suppressed violations: ${sup} (intentional, still reported)`);
            if (opts?.showSuppressed) {
                lines.push("");
                report.suppressed.forEach((v, index) => {
                    lines.push(`${v.ruleName} (suppressed)`);
                    lines.push(`Layers: ${v.fromLayer} -> ${v.toLayer}`);
                    lines.push(`${v.edge.fromFile}:${v.edge.line}`);
                    lines.push(`${v.edge.importText}`);
                    if (v.path && v.path.length > 1) {
                        lines.push(`Path: ${v.path.join(" -> ")}`);
                    }
                    lines.push(`Reason: ${v.reason}`);
                    lines.push(`Suppression: ${v.suppressionReason}`);
                    if (index < report.suppressed.length - 1)
                        lines.push("");
                });
            }
        }
        if (parserIssueCount > 0) {
            lines.push("");
            lines.push(...renderDiagnosticsSection(report.analysis.diagnostics, parserIssueCount));
        }
        lines.push("Summary:");
        lines.push(`Unsuppressed: ${report.summary.unsuppressedCount}`);
        lines.push(`Suppressed: ${report.summary.suppressedCount}`);
        if (report.summary.parserIssueCount > 0) {
            lines.push(`Parser issues: ${report.summary.parserIssueCount}`);
        }
        if (report.summary.diagnosticCount > 0) {
            lines.push(`Diagnostics: ${report.summary.diagnosticCount}`);
        }
        lines.push(`Total: ${report.summary.totalCount}`);
        return lines.join("\n");
    }
    lines.push("Truss: No Architectural violations found");
    lines.push(`Checked ${report.checkedFiles} files`);
    if (sup > 0) {
        lines.push(`Suppressed violations: ${sup} (intentional, still reported)`);
        if (opts?.showSuppressed) {
            lines.push("");
            report.suppressed.forEach((v, index) => {
                lines.push(`${v.ruleName} (suppressed)`);
                lines.push(`Layers: ${v.fromLayer} -> ${v.toLayer}`);
                lines.push(`${v.edge.fromFile}:${v.edge.line}`);
                lines.push(`${v.edge.importText}`);
                lines.push(`Reason: ${v.reason}`);
                lines.push(`Suppression: ${v.suppressionReason}`);
                if (index < report.suppressed.length - 1)
                    lines.push("");
            });
        }
    }
    if (parserIssueCount > 0) {
        lines.push(...renderDiagnosticsSection(report.analysis.diagnostics, parserIssueCount));
    }
    return lines.join("\n");
}
function renderDiagnosticsSection(diagnostics, parserIssueCount) {
    const lines = [];
    lines.push(`Parser issues: ${parserIssueCount} (analysis continued)`);
    diagnostics.forEach((diagnostic, index) => {
        const location = diagnostic.file && diagnostic.line !== undefined
            ? `${diagnostic.file}:${diagnostic.line}`
            : diagnostic.file ?? "unknown location";
        lines.push(`[${diagnostic.severity}] ${diagnostic.code} (${diagnostic.category}) at ${location}`);
        lines.push(diagnostic.message);
        if (diagnostic.importText) {
            lines.push(`Import: ${diagnostic.importText}`);
        }
        if (index < diagnostics.length - 1)
            lines.push("");
    });
    return lines;
}
function compareViolations(a, b) {
    // Keeps JSON output stable by sorting on rule, file, line, then import text.
    if (a.ruleName !== b.ruleName)
        return a.ruleName.localeCompare(b.ruleName);
    if (a.edge.fromFile !== b.edge.fromFile) {
        return a.edge.fromFile.localeCompare(b.edge.fromFile);
    }
    if (a.edge.line !== b.edge.line)
        return a.edge.line - b.edge.line;
    return a.edge.importText.localeCompare(b.edge.importText);
}
function buildJsonReport(report, exitCode) {
    // Copies and sorts violations so JSON output stays deterministic without mutating the report.
    const unsuppressed = [...report.unsuppressed].sort(compareViolations);
    const suppressed = [...report.suppressed].sort(compareViolations);
    return {
        schemaVersion: types_1.REPORT_SCHEMA_VERSION,
        kind: "report",
        exitCode,
        checkedFiles: report.checkedFiles,
        edges: report.edges,
        unsuppressed,
        suppressed,
        parserIssues: report.parserIssues,
        analysis: report.analysis,
        summary: {
            unsuppressedCount: report.summary.unsuppressedCount,
            suppressedCount: report.summary.suppressedCount,
            parserIssueCount: report.summary.parserIssueCount,
            diagnosticCount: report.summary.diagnosticCount,
            totalCount: report.summary.totalCount,
        },
    };
}
function buildJsonError(error, exitCode) {
    return {
        schemaVersion: types_1.REPORT_SCHEMA_VERSION,
        kind: "error",
        exitCode,
        error,
    };
}
function renderJsonReport(report, exitCode) {
    // Serializes the shared versioned report envelope used by machine-readable output.
    return JSON.stringify(buildJsonReport(report, exitCode), null, 2);
}
function renderJsonError(error, exitCode) {
    // Serializes non-report failures with the same envelope shape as successful JSON output.
    return JSON.stringify(buildJsonError(error, exitCode), null, 2);
}
