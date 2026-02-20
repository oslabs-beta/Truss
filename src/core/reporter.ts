import { TrussReport } from "./types";

// this fn creates a readable text report for CLI. It shows detailed info about violations.
//Human formatter: detailed unsuppressed violations + compact summary.
export function renderHumanReport(
report: TrussReport, 
opts?: { showSuppressed?: boolean }
): string {

  //store all output lines in arr
  const lines: string[] = [];

  //number of unsuppressed violations
  const uns = report.unsuppressed.length;
  //number of suppressed violations
  const sup = report.suppressed.length;

//if we have real violat.
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

      //show details only if user wants to suppressed
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

    //summary section
    lines.push("Summary:");
    lines.push(`Unsuppressed: ${report.summary.unsuppressedCount}`);
    lines.push(`Suppressed: ${report.summary.suppressedCount}`);
    lines.push(`Total: ${report.summary.totalCount}`);
    
    //join all lones into one sttring with new lines
    return lines.join("\n");
  }

  //if no violations
  lines.push("Truss: No Architectural violations found");
  lines.push(`Checked ${report.checkedFiles} files`);
  return lines.join("\n");
}

//this fn creates JSON output
//used when user wants mashine-readable format
export function renderJsonReport(report: TrussReport): string {
  return JSON.stringify(report, null, 2);
}
