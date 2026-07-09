import * as fs from "node:fs";
import * as path from "node:path";

import { TrussReport } from "./types";
import { renderJsonReport } from "./reporter";
import { renderHtmlReport } from "./htmlReporter";

export function writeReports(
  report: TrussReport,
  exitCode: number,
  repoRoot: string,
  reportDir: string
): { jsonPath: string; htmlPath: string } {
  const outputDir = path.resolve(repoRoot, reportDir);

  fs.mkdirSync(outputDir, { recursive: true });

  const jsonPath = path.join(outputDir, "truss-report.json");
  const htmlPath = path.join(outputDir, "truss-report.html");

  fs.writeFileSync(
    jsonPath,
    renderJsonReport(report, exitCode),
    "utf8"
  );

  fs.writeFileSync(
    htmlPath,
    renderHtmlReport(report),
    "utf8"
  );

  return {
    jsonPath,
    htmlPath,
  };
}