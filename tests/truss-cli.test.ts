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

test("exit code 0 and json snapshot for suppressed-only violations", () => {
  const result = runTruss(["--repo", fixturePath("suppressed-repo"), "--format", "json"]);

  assert.strictEqual(result.status, 0);
  assert.strictEqual(result.stderr, "");
  assertSnapshot("suppressed-json.json", result.stdout);
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
