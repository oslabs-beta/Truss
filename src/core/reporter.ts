import {
  JsonErrorV1,
  JsonReportV1,
  REPORT_SCHEMA_VERSION,
  TrussReport,
  Violation,
} from "./types";

/**
 * renderHumanReport()
 * Purpose: Format TrussReport into readable CLI text output.
 *
 * Input:
 *  - report: final TrussReport object (contains violations and summary)
 *  - opts.showSuppressed: optional flag to show suppressed violation details
 *
 * Output:
 *  - string (formatted text for terminal)
 */
export function renderHumanReport(
  report: TrussReport,
  opts?: { showSuppressed?: boolean }
): string {

  const lines: string[] = [];
  const uns = report.unsuppressed.length;
  const sup = report.suppressed.length;
  const parserIssueCount = report.parserIssues.length;

  if (uns > 0) {
    lines.push(`Truss: Architectural violations found (${uns})`);
    lines.push("");

    for (const v of report.unsuppressed) {
      lines.push(`${v.ruleName}`);
      lines.push(`Layers: ${v.fromLayer} -> ${v.toLayer}`);
      lines.push(`${v.edge.fromFile}:${v.edge.line}`);
      lines.push(`${v.edge.importText}`);
      lines.push(`Reason: ${v.reason}`);
      lines.push("");
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
          lines.push(`Reason: ${v.reason}`);
          lines.push(`Suppression: ${v.suppressionReason}`);
          if (index < report.suppressed.length - 1) lines.push("");
        });
      }
    }

    if (parserIssueCount > 0) {
      lines.push("");
      lines.push(`Parser issues: ${parserIssueCount} (analysis continued)`);
      lines.push("Diagnostics by category:");
      lines.push(`- parser: ${report.analysis.categories.parser}`);
      lines.push(`- graph: ${report.analysis.categories.graph}`);
      lines.push(`- validation: ${report.analysis.categories.validation}`);
      lines.push(`- suppression: ${report.analysis.categories.suppression}`);
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
        if (index < report.suppressed.length - 1) lines.push("");
      });
    }
  }

  if (parserIssueCount > 0) {
    lines.push(`Parser issues: ${parserIssueCount} (analysis continued)`);
  }

  return lines.join("\n");
}

function compareViolations(a: Violation, b: Violation): number {
  if (a.ruleName !== b.ruleName) return a.ruleName.localeCompare(b.ruleName);
  if (a.edge.fromFile !== b.edge.fromFile) {
    return a.edge.fromFile.localeCompare(b.edge.fromFile);
  }
  if (a.edge.line !== b.edge.line) return a.edge.line - b.edge.line;
  return a.edge.importText.localeCompare(b.edge.importText);
}

export function buildJsonReport(report: TrussReport, exitCode: number): JsonReportV1 {
  const unsuppressed = [...report.unsuppressed].sort(compareViolations);
  const suppressed = [...report.suppressed].sort(compareViolations);

  return {
    schemaVersion: REPORT_SCHEMA_VERSION,
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

export function buildJsonError(error: string, exitCode: number): JsonErrorV1 {
  return {
    schemaVersion: REPORT_SCHEMA_VERSION,
    kind: "error",
    exitCode,
    error,
  };
}

/**
 * renderJsonReport()
 * Purpose: Format TrussReport into machine-readable JSON.
 *
 * Input:
 *  - report: final TrussReport object
 *
 * Output:
 *  - string (JSON format with indentation)
 */
export function renderJsonReport(report: TrussReport, exitCode: number): string {
  return JSON.stringify(buildJsonReport(report, exitCode), null, 2);
}

export function renderJsonError(error: string, exitCode: number): string {
  return JSON.stringify(buildJsonError(error, exitCode), null, 2);
}
