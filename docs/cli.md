# Truss CLI Guide

This document explains what the Truss CLI does, how to run it, what configuration it expects, what output it produces, and how to use it in local development and CI.

## What The CLI Does

`truss check` analyzes a repository without executing application code. It reads supported source files, extracts static imports, maps files to architectural layers, checks those imports against configured rules, applies suppressions, and returns a report plus a deterministic exit code.

At a high level, the CLI:

1. Loads and validates `truss.yml`
2. Discovers supported source files
3. Parses static imports
4. Builds dependency edges
5. Assigns files to layers
6. Evaluates architectural rules
7. Applies suppressions
8. Prints human or JSON output
9. Exits with a CI-friendly status code

## Supported Source Files

The CLI scans these file types:

- `.ts`
- `.tsx`
- `.js`
- `.jsx`

It ignores common build and cache directories by default, including:

- `node_modules`
- `.git`
- `dist`
- `build`
- `out`
- `.next`
- `.turbo`
- `coverage`
- `.cache`
- `.yarn`

You can add more ignored directory names through the config file.

## Main Command

From this repo:

```bash
npm run truss:check -- --repo /path/to/project --config truss.yml
```

The package also exposes a binary entrypoint:

```bash
truss check --repo /path/to/project --config truss.yml
```

## CLI Options

`truss check` supports these options:

- `--repo <path>`: repository root to analyze. Defaults to `.`
- `--config <path>`: config file path. Defaults to `truss.yml`
- `--format <human|json>`: output mode. Defaults to `human`
- `--show-suppressed`: include full suppressed-violation details in human output

Notes:

- `--config` is resolved relative to `--repo` unless you pass an absolute path.
- `--show-suppressed` is only valid with human output.

## NPM Scripts

The current repo defines these scripts:

```bash
npm run truss:check
npm run truss:check:json
```

They expand to:

- `npm run truss:check`: `tsx bin/truss.ts check`
- `npm run truss:check:json`: `tsx bin/truss.ts check --format json`

## Configuration File

The CLI expects a YAML file, usually named `truss.yml`.

Current supported config shape:

```yaml
version: "1"

layers:
  api:
    - "src/api/**"
  db:
    - "src/db/**"
  shared:
    - "src/shared/**"

rules:
  - name: no-api-to-db
    from: api
    disallow: [db]
    message: API layer must not depend directly on DB layer.

suppressions:
  - file: src/api/user.ts
    rule: no-api-to-db
    reason: Temporary exception during refactor.

ignore:
  - generated
```

### Config Fields

- `version?: string`
- `layers: Record<string, string[]>`
- `rules: Array<{ name: string; from: string; disallow: string[]; message?: string }>`
- `suppressions?: Array<{ file: string; rule: string; reason: string }>`
- `ignore?: string[]`

### Layer Pattern Behavior

Layer matching is currently path-prefix based.

Safe examples:

- `"src/api"`
- `"src/api/"`
- `"src/api/**"`

Important limitation:

- Truss does not currently implement full glob semantics for layer matching.
- If you want predictable results, use prefix-style patterns rooted at repo-relative paths.

### Rule Behavior

Each rule says:

- which source layer it applies to via `from`
- which target layers are forbidden via `disallow`
- an optional human-readable `message`

If a file in layer `api` imports a file in layer `db`, and `db` appears in `disallow`, Truss reports a violation.

### Suppression Behavior

Suppressions are config-based.

Each suppression matches by:

- `file`: the importing file path
- `rule`: the rule name

If both match, the violation is moved from `unsuppressed` to `suppressed` and still appears in the report.

Current suppression behavior:

- suppressions are reported, not hidden
- suppressed violations do not change a clean run into exit code `1`
- suppressed violations can be shown in full with `--show-suppressed`

Not currently supported:

- inline source-code suppression comments
- suppression expiration
- suppression policy thresholds

## What Counts As A Dependency

The CLI extracts static imports from source files. It currently handles:

- `import ... from "..."`
- `export ... from "..."`
- `require("...")`
- `import("...")`

Only internal imports that resolve to files inside the repository become dependency edges.

Current behavior:

- relative imports are resolved
- repo-root absolute-style imports starting with `/` are attempted
- external package imports are ignored for rule evaluation
- unresolved imports are skipped

## How The CLI Evaluates A Repo

When you run `truss check`, the engine performs this flow:

1. Resolve `repoRoot` and config path
2. Validate the config file
3. Discover source files in deterministic sorted order
4. Parse each file and extract dependency edges
5. Sort edges for deterministic output
6. Match files to configured layers
7. Evaluate every edge against every rule
8. Split violations into `unsuppressed` and `suppressed`
9. Build the final report
10. Print the report in human or JSON format
11. Set the exit code

## Human Output

Human output is optimized for developer use.

### Success

```text
Truss: No Architectural violations found
Checked 2 files
```

### Success With Suppressed Violations

```text
Truss: No Architectural violations found
Checked 2 files
Suppressed violations: 1 (intentional, still reported)
```

### Unsuppressed Violations

```text
Truss: Architectural violations found (1)

no-api-to-db
Layers: api -> db
src/api/user.ts:1
import { db } from "../db/client";
Reason: API layer must not depend directly on DB layer.

Summary:
Unsuppressed: 1
Suppressed: 0
Total: 1
```

### `--show-suppressed`

With `--show-suppressed`, human output also prints full suppressed violation details instead of only the suppressed count summary.

Example:

```bash
npm run truss:check -- --repo /path/to/project --show-suppressed
```

## JSON Output

Use JSON mode when integrating with CI or other tooling:

```bash
npm run truss:check -- --repo /path/to/project --format json
```

JSON mode prints exactly one JSON object to stdout.

### Error Shape

```json
{
  "schemaVersion": "1.0.0",
  "kind": "error",
  "exitCode": 2,
  "error": "Config file not found: truss.yml. Add a truss.yml at the repo root or pass --config <path>."
}
```

### Report Shape

```json
{
  "schemaVersion": "1.0.0",
  "kind": "report",
  "exitCode": 0,
  "checkedFiles": 2,
  "edges": 1,
  "unsuppressed": [],
  "suppressed": [],
  "summary": {
    "unsuppressedCount": 0,
    "suppressedCount": 0,
    "totalCount": 0
  }
}
```

### JSON Field Meanings

- `schemaVersion`: version of the JSON contract
- `kind`: `"report"` or `"error"`
- `exitCode`: final process status code
- `checkedFiles`: number of discovered source files
- `edges`: number of resolved internal dependency edges
- `unsuppressed`: violations that fail the check
- `suppressed`: violations allowed by config suppressions
- `summary`: aggregate counts
- `error`: top-level error message for non-report runs

## Exit Codes

The CLI uses deterministic exit codes:

- `0`: no unsuppressed violations
- `1`: one or more unsuppressed violations found
- `2`: configuration or CLI usage error
- `3`: internal/runtime error

### What Causes Exit Code `2`

Examples:

- missing config file
- invalid YAML
- invalid config shape
- no rules defined
- invalid layer configuration
- rule references unknown layers
- invalid `--format` value
- `--show-suppressed` used with `--format json`
- no source files found

### What Causes Exit Code `3`

Any unexpected runtime failure not classified as a config error.

## Error Messages

The CLI keeps config and usage errors short and actionable.

Examples:

- `Config file not found: truss.yml. Add a truss.yml at the repo root or pass --config <path>.`
- `Invalid YAML in truss.yml at line 5, column 1. Fix the syntax and try again.`
- `No rules defined in truss.yml. Add at least one rule under "rules".`
- `Invalid layer "api" in truss.yml. Expected a non-empty list of path patterns, for example: ["src/api"].`

Human config errors are printed as:

```text
Truss: Configuration error
<message>
```

Internal runtime failures are printed as:

```text
Truss: Internal error
<message>
```

## Typical Usage

### Run Against The Current Repo

```bash
npm run truss:check
```

### Run Against Another Repo

```bash
npm run truss:check -- --repo /path/to/project --config truss.yml
```

### Write JSON Output To A File

```bash
npm run truss:check -- --repo /path/to/project --format json > truss-report.json
```

### Show Suppressed Details

```bash
npm run truss:check -- --repo /path/to/project --show-suppressed
```

## CI Usage

### GitHub Actions

Human output:

```yaml
name: Truss
on:
  pull_request:
  push:
    branches: [main]

jobs:
  truss:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run truss:check
```

JSON artifact:

```yaml
name: Truss (JSON Report)
on: [pull_request]

jobs:
  truss:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run truss:check:json > truss-report.json
      - uses: actions/upload-artifact@v4
        with:
          name: truss-report
          path: truss-report.json
```

## Determinism And Noise Control

The CLI is designed for stable output and low-noise CI logs.

Current guarantees:

- source files are sorted before processing
- dependency edges are sorted before reporting
- violations are sorted before JSON serialization
- JSON field order is stable
- one JSON object is emitted in JSON mode
- all unsuppressed violations are reported in a single run
- suppressed violations are summarized by default, expanded only on request

## Testing Coverage

The CLI contract is covered by integration tests and committed snapshots.

Current coverage includes:

- clean repo
- unsuppressed violations
- suppressed-only runs
- config errors
- internal runtime errors
- human output snapshots
- JSON output snapshots
- exit codes `0`, `1`, `2`, and `3`

## Current Limitations

These are important when using the CLI today:

- layer matching is not full glob matching; use prefix-style patterns
- external package imports are not included in rule evaluation
- only resolved internal imports become dependency edges
- suppressions come from config, not source comments
- policy fields such as suppression thresholds are not implemented

## Quick Reference

```bash
# human output
npm run truss:check -- --repo /path/to/project --config truss.yml

# JSON output
npm run truss:check -- --repo /path/to/project --config truss.yml --format json

# show suppressed details
npm run truss:check -- --repo /path/to/project --config truss.yml --show-suppressed
```
