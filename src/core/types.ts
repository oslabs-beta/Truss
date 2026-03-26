//Represents a single dependency between two source files
export type DependencyEdge = {
  fromFile: string;
  toFile: string;
  importText: string;
  line: number;
  importKind: "internal" | "external";
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

//Final report produced after running Truss validation
export type TrussReport = {
  checkedFiles: number;
  edges: number;
  unsuppressed: Violation[];
  suppressed: SuppressedViolation[];
  summary: {
    unsuppressedCount: number;
    suppressedCount: number;
    totalCount: number;
  };
};

export const REPORT_SCHEMA_VERSION = "1.0.0" as const;

export interface JsonReportV1 {
  schemaVersion: typeof REPORT_SCHEMA_VERSION;
  kind: "report";
  exitCode: number;
  checkedFiles: number;
  edges: number;
  unsuppressed: Violation[];
  suppressed: SuppressedViolation[];
  summary: {
    unsuppressedCount: number;
    suppressedCount: number;
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

//Options passed to the Truss check command
export type CheckOptions = {
  repoRoot: string;
  configPath: string;
  format: "human" | "json";
  showSuppressed: boolean;
};

// shuangfei below rules

export interface ImportStatement {
  source: string
  line: number
}

export interface InlineSuppression {
  line: number
  ruleId?: string
  expiresAt?: Date
}

export interface EvaluationContext {
  filePath: string
  imports: ImportStatement[]
  getLayerFromPath(path: string): string
}

// export interface Violation {
//   ruleId: string
//   message: string
//   file: string
//   line: number
//   fromLayer: string
//   toLayer: string
// }