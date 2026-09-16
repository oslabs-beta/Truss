import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";

const root = path.resolve(__dirname, "..");
const fixture = (name: string) => path.join(root, "tests/fixtures", name);
function run(args: string[], cwd = root) {
  const result = spawnSync(process.execPath, ["--enable-source-maps", "--import", path.join(root, "node_modules/tsx/dist/loader.mjs"), path.join(root, "bin/truss.ts"), ...args], {
    cwd, encoding: "utf8", timeout: 30_000,
    env: { ...process.env, TRUSS_OTEL_CONSOLE: "0", TRUSS_S3_BUCKET: "", NO_COLOR: "1", FORCE_COLOR: "0" },
  });
  if (result.error) throw result.error;
  assert.equal(result.signal, null);
  return result;
}
function temp(t: TestContext) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "truss-tests-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test("CLI version matches package.json even outside the package directory", (t) => {
  const expected = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).version;
  const dir = temp(t);
  fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({ version: "unrelated" }));
  const result = run(["--version"], dir);
  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  assert.equal(result.stdout, `${expected}\n`);
});

test("init creates a usable starter, preserves existing configuration, and overwrites only with force", (t) => {
  const dir = temp(t);
  const first = run(["init"], dir);
  assert.equal(first.status, 0);
  assert.match(first.stdout, /Created truss.yml/);
  const config = path.join(dir, "truss.yml");
  const starter = fs.readFileSync(config, "utf8");
  fs.writeFileSync(path.join(dir, "app.ts"), "export const value = 1;\n");
  assert.equal(run(["check", "--repo", dir]).status, 0);
  fs.writeFileSync(config, "# existing custom configuration\n");
  const refused = run(["init"], dir);
  assert.equal(refused.status, 2);
  assert.equal(refused.stdout, "");
  assert.match(refused.stderr, /already exists.*--force/);
  assert.equal(fs.readFileSync(config, "utf8"), "# existing custom configuration\n");
  assert.equal(run(["init", "--force"], dir).status, 0);
  assert.equal(fs.readFileSync(config, "utf8"), starter);
});

test("init reports a write failure when the config path is a directory", (t) => {
  const dir = temp(t);
  fs.mkdirSync(path.join(dir, "truss.yml"));
  const result = run(["init", "--force"], dir);
  assert.equal(result.status, 3);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /Truss: Internal error/);
  assert.match(result.stderr, /EISDIR/);
});

for (const [repo, status] of [["ok-repo", 0], ["violations-repo", 1]] as const) {
  for (const format of ["human", "json"]) {
    test(`check writes nested HTML and JSON artifacts for ${repo} in ${format} mode`, (t) => {
      const dir = temp(t);
      fs.cpSync(fixture(repo), dir, { recursive: true });
      const result = run(["check", "--repo", dir, "--format", format, "--report-dir", "reports/nested"]);
      assert.equal(result.status, status);
      const report = JSON.parse(fs.readFileSync(path.join(dir, "reports/nested/truss-report.json"), "utf8"));
      assert.equal(report.kind, "report");
      assert.equal(report.exitCode, status);
      assert.equal(report.summary.unsuppressedCount, status);
      const html = fs.readFileSync(path.join(dir, "reports/nested/truss-report.html"), "utf8");
      assert.ok(html.includes(`class="badge">${status ? "FAIL" : "PASS"}`));
      if (status) assert.match(html, /no-api-to-db/);
      if (format === "json") {
        assert.deepEqual(JSON.parse(result.stdout), report);
      } else {
        assert.match(result.stdout, /JSON report written to reports\/nested\/truss-report.json/);
        assert.match(result.stdout, /HTML report written to reports\/nested\/truss-report.html/);
      }
      assert.equal(result.stderr, "");
    });
  }
}

for (const format of ["human", "json"]) {
  test(`report output failures return an internal error in ${format} mode`, (t) => {
    const dir = temp(t);
    const blocked = path.join(dir, "file");
    fs.writeFileSync(blocked, "keep");
    const result = run(["check", "--repo", fixture("ok-repo"), "--format", format, "--report-dir", blocked]);
    assert.equal(result.status, 3);
    if (format === "human") {
      assert.match(result.stderr, /Truss: Internal error/);
      assert.match(result.stderr, /EEXIST/);
    } else {
      // The CLI prints the analysis before attempting artifact writes.
      const error = JSON.parse(result.stdout.slice(result.stdout.indexOf('\n{') + 1));
      assert.equal(error.kind, "error");
      assert.equal(error.exitCode, 3);
      assert.match(error.error, /Internal error:.*EEXIST/);
      assert.equal(result.stderr, "");
    }
    assert.equal(fs.readFileSync(blocked, "utf8"), "keep");
  });
}

test("S3 upload without a bucket fails locally after writing report artifacts", (t) => {
  const dir = temp(t);
  const result = run(["check", "--repo", fixture("ok-repo"), "--report-dir", dir, "--upload-s3"]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /TRUSS_S3_BUCKET is required when using --upload-s3/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, "truss-report.json"), "utf8")).exitCode, 0);
  assert.ok(fs.existsSync(path.join(dir, "truss-report.html")));
});

for (const repo of ["ok-repo", "violations-repo", "suppressed-repo"]) {
  test(`graph renders ${repo} with only unsuppressed internal violations highlighted`, () => {
    const result = run(["graph", "--repo", fixture(repo)]);
    assert.equal(result.status, 0);
    assert.equal(result.stderr, "");
    assert.ok(result.stdout.startsWith("digraph G {\n"));
    assert.ok(result.stdout.endsWith("}\n"));
    if (repo === "violations-repo") {
      assert.match(result.stdout, /"src\/api\/user.ts" -> "src\/db\/client.ts" \[color="red", penwidth=2.5\]/);
    } else {
      assert.match(result.stdout, / -> /);
      assert.doesNotMatch(result.stdout, /color="red"/);
    }
  });
}

test("graph rejects unsupported formats and reports analysis failures", () => {
  const invalid = run(["graph", "--format", "json"]);
  assert.equal(invalid.status, 2);
  assert.equal(invalid.stdout, "");
  assert.match(invalid.stderr, /Expected "dot"/);
  const missing = run(["graph", "--repo", fixture("missing-config-repo")]);
  assert.equal(missing.status, 3);
  assert.equal(missing.stdout, "");
  assert.match(missing.stderr, /Truss: Internal error/);
  assert.match(missing.stderr, /truss.yml/);
});

test("custom missing config paths receive actionable JSON errors and create no artifacts", (t) => {
  const dir = temp(t);
  const result = run(["check", "--repo", dir, "--config", "custom.yml", "--format", "json", "--report-dir", "reports"]);
  assert.equal(result.status, 2);
  assert.equal(result.stderr, "");
  const error = JSON.parse(result.stdout);
  assert.equal(error.kind, "error");
  assert.equal(error.exitCode, 2);
  assert.match(error.error, /Config file not found: custom.yml.*fix --config/);
  assert.equal(fs.existsSync(path.join(dir, "reports")), false);
});

for (const [config, message] of [
  ["null", /expected a YAML object/],
  ['{"layers":{}}', /must define at least one layer/],
  ['{"layers":{"app":["src/**"]}}', /"rules" must be an array/],
  ['{"layers":{"app":["src/**"]},"rules":[{"name":"boundary","from":"missing","disallow":["app"]}]}', /unknown layer in "from": "missing"/],
] as const) {
  test(`invalid config reports ${message.source} through the CLI`, (t) => {
    const dir = temp(t);
    fs.writeFileSync(path.join(dir, "truss.yml"), config);
    const result = run(["check", "--repo", dir, "--format", "json"]);
    assert.equal(result.status, 2);
    assert.equal(result.stderr, "");
    const error = JSON.parse(result.stdout);
    assert.equal(error.kind, "error");
    assert.equal(error.exitCode, 2);
    assert.match(error.error, message);
  });
}
