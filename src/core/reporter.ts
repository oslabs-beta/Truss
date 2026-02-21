import { TrussReport } from "./types";

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
        for (const v of report.suppressed) {
          lines.push(`${v.ruleName} (suppressed)`);
          lines.push(`Layers: ${v.fromLayer} -> ${v.toLayer}`);
          lines.push(`${v.edge.fromFile}:${v.edge.line}`);
          lines.push(`${v.edge.importText}`);
          lines.push(`Reason: ${v.reason}`);
          lines.push(`Suppression: ${v.suppressionReason}`);
          lines.push("");
        }
      }
    }

    lines.push("Summary:");
    lines.push(`Unsuppressed: ${report.summary.unsuppressedCount}`);
    lines.push(`Suppressed: ${report.summary.suppressedCount}`);
    lines.push(`Total: ${report.summary.totalCount}`);

    return lines.join("\n");
  }

  lines.push("Truss: No Architectural violations found");
  lines.push(`Checked ${report.checkedFiles} files`);
  return lines.join("\n");
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
export function renderJsonReport(report: TrussReport): string {
  return JSON.stringify(report, null, 2);
}
