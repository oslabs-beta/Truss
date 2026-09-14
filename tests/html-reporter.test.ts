import test from "node:test";
import assert from "node:assert/strict";
import { renderHtmlReport } from "../src/reporting/htmlReporter";
import type { TrussReport, Violation } from "../src/core/types";

function emptyReport(): TrussReport {
  return {
    checkedFiles: 0, edges: 0, unsuppressed: [], suppressed: [], parserIssues: [],
    analysis: { diagnostics: [], categories: { parser: 0, graph: 0, validation: 0, suppression: 0 } },
    summary: { unsuppressedCount: 0, suppressedCount: 0, parserIssueCount: 0, diagnosticCount: 0, totalCount: 0 },
  };
}

const special = '<script title="x">&\'雪</script>';
const escaped = '&lt;script title=&quot;x&quot;&gt;&amp;\'雪&lt;/script&gt;';
function violation(): Violation {
  return { ruleName: special, fromLayer: special, toLayer: special, reason: special,
    edge: { importKind: "internal", fromFile: special, toFile: "target.ts", line: 17, importText: "" } };
}

test("empty HTML report has a passing status, zero counters and no tables", (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2025-01-02T03:04:05Z") });
  const html = renderHtmlReport(emptyReport());
  assert.ok(html.startsWith("<!DOCTYPE html>"));
  assert.match(html, /Generated at 2025-01-02T03:04:05.000Z/);
  assert.match(html, /class="badge">PASS/);
  assert.match(html, /background: #16a34a/);
  assert.equal((html.match(/class="value">0</g) ?? []).length, 4);
  assert.match(html, /No unsuppressed architecture violations found/);
  assert.match(html, /No diagnostics found/);
  assert.doesNotMatch(html, /<table>/);
});

test("violations fail the report and escape every textual cell with null layer fallbacks", () => {
  const report = emptyReport();
  report.checkedFiles = 12;
  report.edges = 23;
  report.unsuppressed = [violation(), { ...violation(), fromLayer: null, toLayer: null }];
  report.summary.unsuppressedCount = 2;
  const html = renderHtmlReport(report);
  assert.match(html, /class="badge">FAIL/);
  assert.match(html, /background: #dc2626/);
  assert.ok(html.includes(`<td>${escaped}:17</td>`));
  assert.equal(html.split(`<td>${escaped}</td>`).length - 1, 6);
  assert.equal(html.split("<td>unknown</td>").length - 1, 2);
  for (const count of [12, 23, 2]) assert.ok(html.includes(`class="value">${count}</div>`));
  assert.doesNotMatch(html, /<script/);
  assert.doesNotMatch(html, /No unsuppressed architecture violations found/);
});

for (const severity of ["warning", "error"] as const) {
  test(`${severity} diagnostics render escaped details and determine status without violations`, () => {
    const report = emptyReport();
    report.analysis.diagnostics = [
      { severity, category: "parser", code: special, message: special, file: special },
      { severity, category: "graph", code: "CYCLE", message: "Cycle detected" },
    ];
    report.summary.diagnosticCount = 2;
    const html = renderHtmlReport(report);
    assert.ok(html.includes(`class="badge">${severity === "error" ? "FAIL" : "PASS"}`));
    assert.equal(html.split(`<td>${escaped}</td>`).length - 1, 3);
    assert.match(html, /<td>unknown<\/td>/);
    assert.ok(html.includes(`<td>${severity}</td>`));
    assert.match(html, /class="value">2<\/div>/);
    assert.doesNotMatch(html, /No diagnostics found|<script/);
  });
}

test("suppressed violations do not appear in the HTML violation table or fail the report", () => {
  const report = emptyReport();
  report.suppressed = [{ ...violation(), suppressionReason: "accepted" }];
  report.summary.suppressedCount = report.summary.totalCount = 1;
  const html = renderHtmlReport(report);
  assert.match(html, /class="badge">PASS/);
  assert.match(html, /No unsuppressed architecture violations found/);
  assert.doesNotMatch(html, /<table>|&lt;script/);
});
