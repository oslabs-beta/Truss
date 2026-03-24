//Represents a single dependency between two source files

export type DependencyEdge =
  | {
      importKind: "internal";
      fromFile: string;
      toFile: string;
      importText: string;
      line: number;
    }
  | {
      importKind: "external";
      fromFile: string;
      packageName: string; // normalized (root package)
      importText: string;
      line: number;
    };

//Represents a rule violation detected during validation
export type Violation = {
  ruleName: string;
  fromLayer: string | null;
  toLayer: string | null;
  edge: DependencyEdge;
  reason: string;
};

//A violation that was detected but intentionally suppressed
export type SuppressedViolation = Violation & {
  suppressionReason: string;
};

// Categories allow diagnostics to be grouped and counted consistently.
export type AnalysisDiagnosticCategory =
  | "parser"
  | "graph"
  | "validation"
  | "suppression";

export type AnalysisDiagnosticSeverity = "warning" | "error";

// Structured diagnostic emitted while running analysis.
export type AnalysisDiagnostic = {
  category: AnalysisDiagnosticCategory;
  code: string;
  severity: AnalysisDiagnosticSeverity;
  message: string;
  file?: string;
  line?: number;
  importText?: string;
};

// Parser-specific issue shape used for unresolved/bad import statements.
export type ParserIssue = {
  code: "UNRESOLVABLE_RELATIVE_IMPORT";
  severity: AnalysisDiagnosticSeverity;
  message: string;
  fromFile: string;
  line: number;
  specifier: string;
  importText: string;
};

export type AnalysisCategoryCounts = Record<AnalysisDiagnosticCategory, number>;

//Final report produced after running Truss validation
export type TrussReport = {
  checkedFiles: number;
  edges: number;
  unsuppressed: Violation[];
  suppressed: SuppressedViolation[];
  parserIssues: ParserIssue[];
  analysis: {
    diagnostics: AnalysisDiagnostic[];
    categories: AnalysisCategoryCounts;
  };
  summary: {
    unsuppressedCount: number;
    suppressedCount: number;
    parserIssueCount: number;
    diagnosticCount: number;
    totalCount: number;
  };
};

export const REPORT_SCHEMA_VERSION = "1.1.0" as const;

export interface JsonReportV1 {
  schemaVersion: typeof REPORT_SCHEMA_VERSION;
  kind: "report";
  exitCode: number;
  checkedFiles: number;
  edges: number;
  unsuppressed: Violation[];
  suppressed: SuppressedViolation[];
  parserIssues: ParserIssue[];
  analysis: {
    diagnostics: AnalysisDiagnostic[];
    categories: AnalysisCategoryCounts;
  };
  summary: {
    unsuppressedCount: number;
    suppressedCount: number;
    parserIssueCount: number;
    diagnosticCount: number;
    totalCount: number;
  };
}

export interface JsonErrorV1 {
  schemaVersion: typeof REPORT_SCHEMA_VERSION;
  kind: "error";
  exitCode: number;
  error: string;
}

export type JsonOutputV1 = JsonReportV1 | JsonErrorV1;

//Exit codes used by the CLI process
export const ExitCode = {
  OK: 0,
  VIOLATIONS: 1,
  CONFIG_ERROR: 2,
  INTERNAL_ERROR: 3,
} as const;

//Union type of all possible exit code values
export type ExitCode = (typeof ExitCode)[keyof typeof ExitCode];

export type CheckRunResult =
  | {
      exitCode: typeof ExitCode.OK | typeof ExitCode.VIOLATIONS;
      report: TrussReport;
      analysis: TrussReport["analysis"];
    }
  | {
      exitCode: typeof ExitCode.CONFIG_ERROR | typeof ExitCode.INTERNAL_ERROR;
      error: string;
    };

//Options passed to the Truss check command
export type CheckOptions = {
  repoRoot: string;
  configPath: string;
  format: "human" | "json";
  showSuppressed: boolean;
};
