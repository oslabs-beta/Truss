"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const node_child_process_1 = require("node:child_process");
const packageRoot = path.resolve(__dirname, "..");
const fixturesRoot = path.join(packageRoot, "tests", "fixtures");
const snapshotsRoot = path.join(packageRoot, "tests", "__snapshots__");
function runTruss(args) {
    const result = (0, node_child_process_1.spawnSync)(process.execPath, ["--import", "tsx", "bin/truss.ts", "check", ...args], {
        cwd: packageRoot,
        encoding: "utf8",
    });
    if (result.error)
        throw result.error;
    return {
        status: result.status,
        stdout: result.stdout,
        stderr: result.stderr,
    };
}
function fixturePath(name) {
    return path.join(fixturesRoot, name);
}
function assertSnapshot(snapshotFile, actual) {
    const expected = fs.readFileSync(path.join(snapshotsRoot, snapshotFile), "utf8");
    strict_1.default.strictEqual(actual, expected);
}
function assertConfigErrorSnapshots(fixtureName, snapshotPrefix) {
    const human = runTruss(["--repo", fixturePath(fixtureName)]);
    strict_1.default.strictEqual(human.status, 2);
    strict_1.default.strictEqual(human.stdout, "");
    assertSnapshot(`${snapshotPrefix}-human.txt`, human.stderr);
    const json = runTruss([
        "--repo",
        fixturePath(fixtureName),
        "--format",
        "json",
    ]);
    strict_1.default.strictEqual(json.status, 2);
    strict_1.default.strictEqual(json.stderr, "");
    assertSnapshot(`${snapshotPrefix}-json.json`, json.stdout);
}
(0, node_test_1.default)("exit code 0 and human snapshot for clean repo", () => {
    const result = runTruss(["--repo", fixturePath("ok-repo")]);
    strict_1.default.strictEqual(result.status, 0);
    strict_1.default.strictEqual(result.stderr, "");
    assertSnapshot("ok-human.txt", result.stdout);
});
(0, node_test_1.default)("exit code 1 and human snapshot for unsuppressed violations", () => {
    const result = runTruss(["--repo", fixturePath("violations-repo")]);
    strict_1.default.strictEqual(result.status, 1);
    strict_1.default.strictEqual(result.stderr, "");
    assertSnapshot("violations-human.txt", result.stdout);
});
(0, node_test_1.default)("json snapshot for clean repo", () => {
    const result = runTruss(["--repo", fixturePath("ok-repo"), "--format", "json"]);
    strict_1.default.strictEqual(result.status, 0);
    strict_1.default.strictEqual(result.stderr, "");
    assertSnapshot("ok-json.json", result.stdout);
});
(0, node_test_1.default)("json snapshot for unsuppressed violations", () => {
    const result = runTruss(["--repo", fixturePath("violations-repo"), "--format", "json"]);
    strict_1.default.strictEqual(result.status, 1);
    strict_1.default.strictEqual(result.stderr, "");
    assertSnapshot("violations-json.json", result.stdout);
});
(0, node_test_1.default)("transitive violations are detected in human output", () => {
    const result = runTruss(["--repo", fixturePath("transitive-violation-repo")]);
    strict_1.default.strictEqual(result.status, 1);
    strict_1.default.strictEqual(result.stderr, "");
    assertSnapshot("transitive-violations-human.txt", result.stdout);
});
(0, node_test_1.default)("transitive violations are detected in json output", () => {
    const result = runTruss([
        "--repo",
        fixturePath("transitive-violation-repo"),
        "--format",
        "json",
    ]);
    strict_1.default.strictEqual(result.status, 1);
    strict_1.default.strictEqual(result.stderr, "");
    assertSnapshot("transitive-violations-json.json", result.stdout);
});
(0, node_test_1.default)("cycle fixture terminates with deterministic human and json output", () => {
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
    strict_1.default.strictEqual(firstHuman.status, 1);
    strict_1.default.strictEqual(firstHuman.stderr, "");
    strict_1.default.strictEqual(secondHuman.status, 1);
    strict_1.default.strictEqual(secondHuman.stderr, "");
    strict_1.default.strictEqual(firstJson.status, 1);
    strict_1.default.strictEqual(firstJson.stderr, "");
    strict_1.default.strictEqual(secondJson.status, 1);
    strict_1.default.strictEqual(secondJson.stderr, "");
    strict_1.default.strictEqual(firstHuman.stdout, secondHuman.stdout);
    strict_1.default.strictEqual(firstJson.stdout, secondJson.stdout);
    assertSnapshot("cycle-human.txt", firstHuman.stdout);
    assertSnapshot("cycle-json.json", firstJson.stdout);
});
(0, node_test_1.default)("exit code 0 and json snapshot for suppressed-only violations", () => {
    const result = runTruss(["--repo", fixturePath("suppressed-repo"), "--format", "json"]);
    strict_1.default.strictEqual(result.status, 0);
    strict_1.default.strictEqual(result.stderr, "");
    assertSnapshot("suppressed-json.json", result.stdout);
});
(0, node_test_1.default)("json includes parser diagnostics and category counts", () => {
    const result = runTruss([
        "--repo",
        fixturePath("parser-issue-repo"),
        "--format",
        "json",
    ]);
    strict_1.default.strictEqual(result.status, 0);
    strict_1.default.strictEqual(result.stderr, "");
    const parsed = JSON.parse(result.stdout);
    strict_1.default.strictEqual(parsed.parserIssues.length, 1);
    strict_1.default.strictEqual(parsed.parserIssues[0]?.code, "UNRESOLVABLE_RELATIVE_IMPORT");
    strict_1.default.strictEqual(parsed.analysis.diagnostics.length, 1);
    strict_1.default.strictEqual(parsed.analysis.diagnostics[0]?.category, "parser");
    strict_1.default.strictEqual(parsed.analysis.categories.parser, 1);
    strict_1.default.strictEqual(parsed.summary.parserIssueCount, 1);
    strict_1.default.strictEqual(parsed.summary.diagnosticCount, 1);
});
(0, node_test_1.default)("human output renders parser diagnostics for unresolved imports", () => {
    const result = runTruss(["--repo", fixturePath("parser-issue-repo")]);
    strict_1.default.strictEqual(result.status, 0);
    strict_1.default.strictEqual(result.stderr, "");
    strict_1.default.match(result.stdout, /Parser issues: 1 \(analysis continued\)/);
    strict_1.default.match(result.stdout, /\[warning\] UNRESOLVABLE_RELATIVE_IMPORT \(parser\)/);
    strict_1.default.match(result.stdout, /Import: import \{ missingValue \} from "\.\/missing";/);
});
(0, node_test_1.default)("syntax errors do not stop analysis of other files", () => {
    const result = runTruss([
        "--repo",
        fixturePath("syntax-error-repo"),
        "--format",
        "json",
    ]);
    strict_1.default.strictEqual(result.status, 1);
    strict_1.default.strictEqual(result.stderr, "");
    const parsed = JSON.parse(result.stdout);
    strict_1.default.strictEqual(parsed.unsuppressed.length, 1);
    strict_1.default.strictEqual(parsed.unsuppressed[0]?.ruleName, "no-api-to-db");
    strict_1.default.strictEqual(parsed.unsuppressed[0]?.edge.fromFile, "src/api/user.ts");
    strict_1.default.ok(parsed.parserIssues.some((issue) => issue.code === "TYPESCRIPT_SYNTAX_DIAGNOSTIC" &&
        issue.fromFile === "src/bad.ts"));
    strict_1.default.ok(parsed.analysis.diagnostics.some((diagnostic) => diagnostic.category === "parser" &&
        diagnostic.code === "TYPESCRIPT_SYNTAX_DIAGNOSTIC" &&
        diagnostic.file === "src/bad.ts"));
    strict_1.default.strictEqual(parsed.analysis.categories.parser, parsed.summary.parserIssueCount);
    strict_1.default.strictEqual(parsed.summary.diagnosticCount, parsed.analysis.diagnostics.length);
});
(0, node_test_1.default)("human snapshot for suppressed-only violations", () => {
    const result = runTruss(["--repo", fixturePath("suppressed-repo")]);
    strict_1.default.strictEqual(result.status, 0);
    strict_1.default.strictEqual(result.stderr, "");
    assertSnapshot("suppressed-default-human.txt", result.stdout);
});
(0, node_test_1.default)("human snapshot for suppressed-only violations with details", () => {
    const result = runTruss([
        "--repo",
        fixturePath("suppressed-repo"),
        "--show-suppressed",
    ]);
    strict_1.default.strictEqual(result.status, 0);
    strict_1.default.strictEqual(result.stderr, "");
    assertSnapshot("suppressed-human.txt", result.stdout);
});
(0, node_test_1.default)("exit code 2 and snapshots for missing truss.yml", () => {
    assertConfigErrorSnapshots("missing-config-repo", "missing-config");
});
(0, node_test_1.default)("exit code 2 and snapshots for invalid YAML", () => {
    assertConfigErrorSnapshots("invalid-yaml-repo", "invalid-yaml");
});
(0, node_test_1.default)("invalid YAML remains a config error in json output", () => {
    const result = runTruss([
        "--repo",
        fixturePath("invalid-yaml-repo"),
        "--format",
        "json",
    ]);
    strict_1.default.strictEqual(result.status, 2);
    strict_1.default.strictEqual(result.stderr, "");
    const parsed = JSON.parse(result.stdout);
    strict_1.default.strictEqual(parsed.kind, "error");
    strict_1.default.strictEqual(parsed.exitCode, 2);
    strict_1.default.match(parsed.error, /^Invalid YAML in/);
    strict_1.default.doesNotMatch(parsed.error, /^Internal error:/);
});
(0, node_test_1.default)("exit code 2 and snapshots for no source files found", () => {
    assertConfigErrorSnapshots("no-rules-repo", "no-rules");
});
(0, node_test_1.default)("exit code 2 and snapshots for invalid layer configuration", () => {
    assertConfigErrorSnapshots("invalid-layer-repo", "invalid-layer");
});
(0, node_test_1.default)("exit code 2 for invalid --format input", () => {
    const result = runTruss(["--repo", fixturePath("ok-repo"), "--format", "xml"]);
    strict_1.default.strictEqual(result.status, 2);
    strict_1.default.strictEqual(result.stdout, "");
    assertSnapshot("invalid-format-human.txt", result.stderr);
});
(0, node_test_1.default)("exit code 2 for --show-suppressed with json format", () => {
    const result = runTruss([
        "--repo",
        fixturePath("suppressed-repo"),
        "--format",
        "json",
        "--show-suppressed",
    ]);
    strict_1.default.strictEqual(result.status, 2);
    strict_1.default.strictEqual(result.stderr, "");
    assertSnapshot("show-suppressed-json.json", result.stdout);
});
(0, node_test_1.default)("exit code 3 for internal runtime failures", () => {
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
    strict_1.default.strictEqual(result.status, 3);
    strict_1.default.strictEqual(result.stderr, "");
    assertSnapshot("internal-error-json.json", result.stdout);
});
(0, node_test_1.default)("unexpected failures remain internal errors in json output", () => {
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
    strict_1.default.strictEqual(result.status, 3);
    strict_1.default.strictEqual(result.stderr, "");
    const parsed = JSON.parse(result.stdout);
    strict_1.default.strictEqual(parsed.kind, "error");
    strict_1.default.strictEqual(parsed.exitCode, 3);
    strict_1.default.match(parsed.error, /^Internal error:/);
});
(0, node_test_1.default)("human snapshot for internal runtime failures", () => {
    const fileRepo = path.join(fixturePath("ok-repo"), "truss.yml");
    const validConfig = path.join(fixturePath("ok-repo"), "truss.yml");
    const result = runTruss([
        "--repo",
        fileRepo,
        "--config",
        validConfig,
    ]);
    strict_1.default.strictEqual(result.status, 3);
    strict_1.default.strictEqual(result.stdout, "");
    assertSnapshot("internal-error-human.txt", result.stderr);
});
