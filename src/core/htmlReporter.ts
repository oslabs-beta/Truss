import { TrussReport } from "./types";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function renderHtmlReport(report: TrussReport): string {
  const hasFailures =
    report.summary.unsuppressedCount > 0 ||
    report.analysis.diagnostics.some((d) => d.severity === "error");

  const status = hasFailures ? "FAIL" : "PASS";
  const generatedAt = new Date().toISOString();

  const violationRows = report.unsuppressed
    .map(
      (v) => `
<tr>
  <td>${escapeHtml(v.ruleName)}</td>
  <td>${escapeHtml(v.fromLayer ?? "unknown")}</td>
  <td>${escapeHtml(v.toLayer ?? "unknown")}</td>
  <td>${escapeHtml(v.edge.fromFile)}:${v.edge.line}</td>
  <td>${escapeHtml(v.reason)}</td>
</tr>`
    )
    .join("");

  const diagnosticRows = report.analysis.diagnostics
    .map(
      (d) => `
<tr>
  <td>${escapeHtml(d.severity)}</td>
  <td>${escapeHtml(d.category)}</td>
  <td>${escapeHtml(d.code)}</td>
  <td>${escapeHtml(d.file ?? "unknown")}</td>
  <td>${escapeHtml(d.message)}</td>
</tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Truss Report</title>
<style>
body {
  font-family: Arial, sans-serif;
  margin: 40px;
  background: #f8fafc;
  color: #0f172a;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.badge {
  padding: 8px 14px;
  border-radius: 999px;
  font-weight: 700;
  color: white;
  background: ${hasFailures ? "#dc2626" : "#16a34a"};
}

.meta {
  color: #64748b;
  font-size: 14px;
}

.cards {
  display: grid;
  grid-template-columns: repeat(4, minmax(140px, 1fr));
  gap: 16px;
  margin-bottom: 32px;
}

.card {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 18px;
}

.card .label {
  color: #64748b;
  font-size: 13px;
  margin-bottom: 8px;
}

.card .value {
  font-size: 28px;
  font-weight: 700;
}

section {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 24px;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th, td {
  border-bottom: 1px solid #e2e8f0;
  padding: 10px;
  text-align: left;
  vertical-align: top;
}

th {
  color: #475569;
  font-size: 13px;
}

.empty {
  color: #64748b;
}
</style>
</head>

<body>
  <div class="header">
    <div>
      <h1>Truss Analysis Report</h1>
      <div class="meta">Generated at ${escapeHtml(generatedAt)}</div>
    </div>
    <div class="badge">${status}</div>
  </div>

  <div class="cards">
    <div class="card">
      <div class="label">Checked files</div>
      <div class="value">${report.checkedFiles}</div>
    </div>

    <div class="card">
      <div class="label">Dependency edges</div>
      <div class="value">${report.edges}</div>
    </div>

    <div class="card">
      <div class="label">Violations</div>
      <div class="value">${report.summary.unsuppressedCount}</div>
    </div>

    <div class="card">
      <div class="label">Diagnostics</div>
      <div class="value">${report.summary.diagnosticCount}</div>
    </div>
  </div>

  <section>
    <h2>Violations</h2>
    ${
      violationRows
        ? `<table>
<thead>
<tr>
  <th>Rule</th>
  <th>From layer</th>
  <th>To layer</th>
  <th>Source</th>
  <th>Reason</th>
</tr>
</thead>
<tbody>${violationRows}</tbody>
</table>`
        : `<p class="empty">No unsuppressed architecture violations found.</p>`
    }
  </section>

  <section>
    <h2>Diagnostics</h2>
    ${
      diagnosticRows
        ? `<table>
<thead>
<tr>
  <th>Severity</th>
  <th>Category</th>
  <th>Code</th>
  <th>File</th>
  <th>Message</th>
</tr>
</thead>
<tbody>${diagnosticRows}</tbody>
</table>`
        : `<p class="empty">No diagnostics found.</p>`
    }
  </section>
</body>
</html>`;
}