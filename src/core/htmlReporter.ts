import { TrussReport } from "./types";

export function renderHtmlReport(report: TrussReport): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Truss Report</title>

<style>
body{
    font-family:Arial,sans-serif;
    margin:40px;
    background:#f8fafc;
}

h1{
    margin-bottom:10px;
}

table{
    border-collapse:collapse;
    width:500px;
}

td,th{
    border:1px solid #ddd;
    padding:10px;
}

th{
    background:#2563eb;
    color:white;
    text-align:left;
}
</style>

</head>

<body>

<h1>Truss Analysis Report</h1>

<table>

<tr>
<th>Metric</th>
<th>Value</th>
</tr>

<tr>
<td>Checked files</td>
<td>${report.checkedFiles}</td>
</tr>

<tr>
<td>Dependency edges</td>
<td>${report.edges}</td>
</tr>

<tr>
<td>Unsuppressed violations</td>
<td>${report.summary.unsuppressedCount}</td>
</tr>

<tr>
<td>Suppressed violations</td>
<td>${report.summary.suppressedCount}</td>
</tr>

<tr>
<td>Diagnostics</td>
<td>${report.summary.diagnosticCount}</td>
</tr>

</table>

</body>
</html>`;
}