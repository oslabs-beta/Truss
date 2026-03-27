import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";

const packageRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const fixturesRoot = path.join(packageRoot, "tests", "fixtures");
const snapshotsRoot = path.join(packageRoot, "tests", "__snapshots__");

type CliResult = {
  status: number | null;
  stdout: string;
  stderr: string;
};

function runTruss(args: string[]): CliResult {
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", "bin/truss.ts", "check", ...args],
    {
      cwd: packageRoot,
      encoding: "utf8",
    },
  );

  if (result.error) throw result.error;

  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

function fixturePath(name: string): string {
  return path.join(fixturesRoot, name);
}

function assertSnapshot(snapshotFile: string, actual: string): void {
  const expected = fs.readFileSync(path.join(snapshotsRoot, snapshotFile), "utf8");
  assert.strictEqual(actual, expected);
}

function assertConfigErrorSnapshots(fixtureName: string, snapshotPrefix: string): void {
  const human = runTruss(["--repo", fixturePath(fixtureName)]);

  assert.strictEqual(human.status, 2);
  assert.strictEqual(human.stdout, "");
  assertSnapshot(`${snapshotPrefix}-human.txt`, human.stderr);

  const json = runTruss([
    "--repo",
    fixturePath(fixtureName),
    "--format",
    "json",
  ]);

  assert.strictEqual(json.status, 2);
  assert.strictEqual(json.stderr, "");
  assertSnapshot(`${snapshotPrefix}-json.json`, json.stdout);
}

test("exit code 0 and human snapshot for clean repo", () => {
  const result = runTruss(["--repo", fixturePath("ok-repo")]);

  assert.strictEqual(result.status, 0);
  assert.strictEqual(result.stderr, "");
  assertSnapshot("ok-human.txt", result.stdout);
});

test("exit code 1 and human snapshot for unsuppressed violations", () => {
  const result = runTruss(["--repo", fixturePath("violations-repo")]);

  assert.strictEqual(result.status, 1);
  assert.strictEqual(result.stderr, "");
  assertSnapshot("violations-human.txt", result.stdout);
});

test("json snapshot for clean repo", () => {
  const result = runTruss(["--repo", fixturePath("ok-repo"), "--format", "json"]);

  assert.strictEqual(result.status, 0);
  assert.strictEqual(result.stderr, "");
  assertSnapshot("ok-json.json", result.stdout);
});

test("json snapshot for unsuppressed violations", () => {
  const result = runTruss(["--repo", fixturePath("violations-repo"), "--format", "json"]);

  assert.strictEqual(result.status, 1);
  assert.strictEqual(result.stderr, "");
  assertSnapshot("violations-json.json", result.stdout);
});

test("transitive violations are detected in human output", () => {
  const result = runTruss(["--repo", fixturePath("transitive-violation-repo")]);

  assert.strictEqual(result.status, 1);
  assert.strictEqual(result.stderr, "");
  assertSnapshot("transitive-violations-human.txt", result.stdout);
});

test("transitive violations are detected in json output", () => {
  const result = runTruss([
    "--repo",
    fixturePath("transitive-violation-repo"),
    "--format",
    "json",
  ]);

  assert.strictEqual(result.status, 1);
  assert.strictEqual(result.stderr, "");
  assertSnapshot("transitive-violations-json.json", result.stdout);
});

test("cycle fixture terminates with deterministic human and json output", () => {
  const firstHuman = runTruss(["--repo", fixturePath("cycle-repo")]);
  const secondHuman = runTruss(["--repo", fixturePath("cycle-repo")]);
  const firstJson = runTruss([
    "--repo",
    fixturePath("cycle-repo"),
    "--format",
    "json",
  ]);
  const secondJson = runTruss([
    "--repo",
    fixturePath("cycle-repo"),
    "--format",
    "json",
  ]);

  assert.strictEqual(firstHuman.status, 0);
  assert.strictEqual(firstHuman.stderr, "");
  assert.strictEqual(secondHuman.status, 0);
  assert.strictEqual(secondHuman.stderr, "");
  assert.strictEqual(firstJson.status, 0);
  assert.strictEqual(firstJson.stderr, "");
  assert.strictEqual(secondJson.status, 0);
  assert.strictEqual(secondJson.stderr, "");

  assert.strictEqual(firstHuman.stdout, secondHuman.stdout);
  assert.strictEqual(firstJson.stdout, secondJson.stdout);

  assertSnapshot("cycle-human.txt", firstHuman.stdout);
  assertSnapshot("cycle-json.json", firstJson.stdout);
});

test("exit code 0 and json snapshot for suppressed-only violations", () => {
  const result = runTruss(["--repo", fixturePath("suppressed-repo"), "--format", "json"]);

  assert.strictEqual(result.status, 0);
  assert.strictEqual(result.stderr, "");
  assertSnapshot("suppressed-json.json", result.stdout);
});

test("json includes parser diagnostics and category counts", () => {
  const result = runTruss([
    "--repo",
    fixturePath("parser-issue-repo"),
    "--format",
    "json",
  ]);

  assert.strictEqual(result.status, 0);
  assert.strictEqual(result.stderr, "");

  const parsed = JSON.parse(result.stdout) as {
    parserIssues: Array<{ code: string }>;
    analysis: { diagnostics: Array<{ category: string }>; categories: Record<string, number> };
    summary: { parserIssueCount: number; diagnosticCount: number };
  };

  assert.strictEqual(parsed.parserIssues.length, 1);
  assert.strictEqual(parsed.parserIssues[0]?.code, "UNRESOLVABLE_RELATIVE_IMPORT");
  assert.strictEqual(parsed.analysis.diagnostics.length, 1);
  assert.strictEqual(parsed.analysis.diagnostics[0]?.category, "parser");
  assert.strictEqual(parsed.analysis.categories.parser, 1);
  assert.strictEqual(parsed.summary.parserIssueCount, 1);
  assert.strictEqual(parsed.summary.diagnosticCount, 1);
});

test("human output renders parser diagnostics for unresolved imports", () => {
  const result = runTruss(["--repo", fixturePath("parser-issue-repo")]);

  assert.strictEqual(result.status, 0);
  assert.strictEqual(result.stderr, "");
  assert.match(result.stdout, /Parser issues: 1 \(analysis continued\)/);
  assert.match(result.stdout, /\[warning\] UNRESOLVABLE_RELATIVE_IMPORT \(parser\)/);
  assert.match(result.stdout, /Import: import \{ missingValue \} from "\.\/missing";/);
});

test("syntax errors do not stop analysis of other files", () => {
  const result = runTruss([
    "--repo",
    fixturePath("syntax-error-repo"),
    "--format",
    "json",
  ]);

  assert.strictEqual(result.status, 1);
  assert.strictEqual(result.stderr, "");

  const parsed = JSON.parse(result.stdout) as {
    unsuppressed: Array<{ ruleName: string; edge: { fromFile: string } }>;
    parserIssues: Array<{ code: string; fromFile: string }>;
    analysis: { diagnostics: Array<{ category: string; code: string; file?: string }>; categories: Record<string, number> };
    summary: { parserIssueCount: number; diagnosticCount: number };
  };

  assert.strictEqual(parsed.unsuppressed.length, 1);
  assert.strictEqual(parsed.unsuppressed[0]?.ruleName, "no-api-to-db");
  assert.strictEqual(parsed.unsuppressed[0]?.edge.fromFile, "src/api/user.ts");
  assert.ok(
    parsed.parserIssues.some(
      (issue) =>
        issue.code === "TYPESCRIPT_SYNTAX_DIAGNOSTIC" &&
        issue.fromFile === "src/bad.ts",
    ),
  );
  assert.ok(
    parsed.analysis.diagnostics.some(
      (diagnostic) =>
        diagnostic.category === "parser" &&
        diagnostic.code === "TYPESCRIPT_SYNTAX_DIAGNOSTIC" &&
        diagnostic.file === "src/bad.ts",
    ),
  );
  assert.strictEqual(parsed.analysis.categories.parser, parsed.summary.parserIssueCount);
  assert.strictEqual(parsed.summary.diagnosticCount, parsed.analysis.diagnostics.length);
});

test("human snapshot for suppressed-only violations", () => {
  const result = runTruss(["--repo", fixturePath("suppressed-repo")]);

  assert.strictEqual(result.status, 0);
  assert.strictEqual(result.stderr, "");
  assertSnapshot("suppressed-default-human.txt", result.stdout);
});

test("human snapshot for suppressed-only violations with details", () => {
  const result = runTruss([
    "--repo",
    fixturePath("suppressed-repo"),
    "--show-suppressed",
  ]);

  assert.strictEqual(result.status, 0);
  assert.strictEqual(result.stderr, "");
  assertSnapshot("suppressed-human.txt", result.stdout);
});

test("exit code 2 and snapshots for missing truss.yml", () => {
  assertConfigErrorSnapshots("missing-config-repo", "missing-config");
});

test("exit code 2 and snapshots for invalid YAML", () => {
  assertConfigErrorSnapshots("invalid-yaml-repo", "invalid-yaml");
});

test("invalid YAML remains a config error in json output", () => {
  const result = runTruss([
    "--repo",
    fixturePath("invalid-yaml-repo"),
    "--format",
    "json",
  ]);

  assert.strictEqual(result.status, 2);
  assert.strictEqual(result.stderr, "");
  const parsed = JSON.parse(result.stdout) as {
    kind: string;
    exitCode: number;
    error: string;
  };
  assert.strictEqual(parsed.kind, "error");
  assert.strictEqual(parsed.exitCode, 2);
  assert.match(parsed.error, /^Invalid YAML in/);
  assert.doesNotMatch(parsed.error, /^Internal error:/);
});

test("exit code 2 and snapshots for no rules defined", () => {
  assertConfigErrorSnapshots("no-rules-repo", "no-rules");
});

test("exit code 2 and snapshots for invalid layer configuration", () => {
  assertConfigErrorSnapshots("invalid-layer-repo", "invalid-layer");
});

test("exit code 2 for invalid --format input", () => {
  const result = runTruss(["--repo", fixturePath("ok-repo"), "--format", "xml"]);

  assert.strictEqual(result.status, 2);
  assert.strictEqual(result.stdout, "");
  assertSnapshot("invalid-format-human.txt", result.stderr);
});

test("exit code 2 for --show-suppressed with json format", () => {
  const result = runTruss([
    "--repo",
    fixturePath("suppressed-repo"),
    "--format",
    "json",
    "--show-suppressed",
  ]);

  assert.strictEqual(result.status, 2);
  assert.strictEqual(result.stderr, "");
  assertSnapshot("show-suppressed-json.json", result.stdout);
});

test("exit code 3 for internal runtime failures", () => {
  const fileRepo = path.join(fixturePath("ok-repo"), "truss.yml");
  const validConfig = path.join(fixturePath("ok-repo"), "truss.yml");
  const result = runTruss([
    "--repo",
    fileRepo,
    "--config",
    validConfig,
    "--format",
    "json",
  ]);

  assert.strictEqual(result.status, 3);
  assert.strictEqual(result.stderr, "");
  assertSnapshot("internal-error-json.json", result.stdout);
});

test("unexpected failures remain internal errors in json output", () => {
  const fileRepo = path.join(fixturePath("ok-repo"), "truss.yml");
  const validConfig = path.join(fixturePath("ok-repo"), "truss.yml");
  const result = runTruss([
    "--repo",
    fileRepo,
    "--config",
    validConfig,
    "--format",
    "json",
  ]);

  assert.strictEqual(result.status, 3);
  assert.strictEqual(result.stderr, "");
  const parsed = JSON.parse(result.stdout) as {
    kind: string;
    exitCode: number;
    error: string;
  };
  assert.strictEqual(parsed.kind, "error");
  assert.strictEqual(parsed.exitCode, 3);
  assert.match(parsed.error, /^Internal error:/);
});

test("human snapshot for internal runtime failures", () => {
  const fileRepo = path.join(fixturePath("ok-repo"), "truss.yml");
  const validConfig = path.join(fixturePath("ok-repo"), "truss.yml");
  const result = runTruss([
    "--repo",
    fileRepo,
    "--config",
    validConfig,
  ]);

  assert.strictEqual(result.status, 3);
  assert.strictEqual(result.stdout, "");
  assertSnapshot("internal-error-human.txt", result.stderr);
});
