# Truss — Architecture Boundary Enforcement Tool

Truss is a CLI tool that detects and enforces architectural boundaries in JavaScript and TypeScript projects, especially when integrated into CI pipelines.

It prevents unintended dependencies between layers, such as controllers importing database modules directly, by analyzing import/export declarations, CommonJS `require` calls, dynamic imports, and building a dependency graph.

Truss detects both direct and transitive violations and is designed for deterministic local runs and CI-based enforcement.

## Why Truss

As applications grow, architectural boundaries are often violated unintentionally:

- controllers start importing database modules directly
- routes bypass services
- dependencies become tangled and hard to reason about

Truss enforces these boundaries automatically when used in CI, helping prevent architectural drift before problematic code is merged.

## Quick Start

Run without installing:

```bash
npx truss-lint init
npx truss-lint check
```

Or install globally:

```bash
npm install -g truss-lint
truss-lint init
truss-lint check
```

## Dependency Graph Visualization

Truss can render a dependency graph of your project with layer grouping and highlighted architectural violations.

![Dependency Graph](./docs/graph.svg)

## Usage

### 1. Install

Install locally in your project:

```bash
npm install -D truss-lint
```

Or run directly with `npx`:

```bash
npx truss-lint init
npx truss-lint check
```

### 2. Initialize configuration

Create a starter configuration file in your project:

```bash
npx truss-lint init
```

This generates a `truss.yml` file in your project root.

### 3. Configure layers and rules

Edit the generated `truss.yml` to define your architecture:

```yaml
version: "1"

layers:
  client:
    - "client/**/*.ts"
    - "client/**/*.tsx"
  server:
    - "server/**/*.ts"

rules:
  - name: no-client-to-server
    from: client
    disallow: [server]
```

### 4. Run analysis

```bash
npx truss-lint check
```

### 5. Generate a dependency graph

```bash
npx truss-lint graph > graph.dot
dot -Tsvg graph.dot -o graph.svg
```

This helps visualize architectural structure and identify problematic dependencies.

## How It Works

Truss performs deterministic static analysis using a dependency graph pipeline:

1. Load and validate `truss.yml`
2. Discover source files (`.ts`, `.tsx`, `.js`, `.jsx`)
3. Parse import/export declarations, CommonJS require calls, and dynamic imports
4. Build dependency edges
5. Assign files to layers
6. Evaluate architectural rules
7. Apply suppressions
8. Render human-readable or JSON output
9. Exit with a CI-friendly status code

Type-only imports are excluded from runtime dependency analysis to avoid false-positive cycles from TypeScript import type declarations.

## Key Features

- Graph-based dependency analysis
-	Detection of direct and transitive architectural violations via graph traversal
-	Dependency cycle detection integrated into analysis diagnostics
-	Layer-based architecture enforcement via configuration
-	Deterministic CLI and JSON outputs
-	CI integration for automated architectural checks
-	Visual graph rendering with violation highlighting
-	Suppression support for intentional exceptions

## Exit Code Matrix

- `0` No unsuppressed violations
- `1` One or more unsuppressed architectural violations or blocking graph diagnostics
- `2` Configuration or CLI usage error
- `3` Internal error

## Sample Output (Violation)

```text
Truss: Architectural violations found (2)

Direct Violations (1)
--------------------------------
[VIOLATION] no-api-to-db
Layers: api -> db
src/api/user.ts:15
import { db } from "../db/client";
Reason: API layer must not depend directly on DB layer.

Transitive Violations (1)
--------------------------------
[TRANSITIVE VIOLATION] no-api-to-db
Layers: api -> db
src/api/user.ts:0
[transitive]
Path: src/api/user.ts -> src/service/status.ts -> src/db/client.ts
Reason: API layer must not depend on DB layer.

Summary:
Unsuppressed: 2
Suppressed: 0
Total: 2
```

## Sample Output (Success)

```text
Truss: No Architectural violations found
Checked 9000 files
```

## Deterministic Output

Truss guarantees stable and deterministic output across runs:

- consistent sorting of violations
- stable JSON schema
- snapshot-safe CLI output

This ensures reliable CI checks and predictable developer experience.

## JSON Output Contract

When `--format json` is provided, Truss prints exactly one JSON object to stdout.

### Schema versioning

All JSON output includes:

- `schemaVersion`
- `kind` (`report` or `error`)

### Report output (`kind: "report"`)

```json
{
  "schemaVersion": "1.1.0",
  "kind": "report",
  "exitCode": 0,
  "checkedFiles": 42,
  "edges": 137,
  "unsuppressed": [],
  "suppressed": [],
  "parserIssues": [],
  "analysis": {
    "diagnostics": [],
    "categories": {
      "parser": 0,
      "graph": 0,
      "validation": 0,
      "suppression": 0
    }
  },
  "summary": {
    "unsuppressedCount": 0,
    "suppressedCount": 0,
    "parserIssueCount": 0,
    "diagnosticCount": 0,
    "totalCount": 0
  }
}
```

### Error output (`kind: "error"`)

```json
{
  "schemaVersion": "1.1.0",
  "kind": "error",
  "exitCode": 2,
  "error": "Failed to load truss.yml"
}
```

## Continuous Integration

Truss integrates with CI pipelines to enforce architectural constraints automatically.

When Truss is run inside CI, unsuppressed architectural violations or blocking diagnostics cause the command to exit with a non-zero status code. This allows pull requests to fail before architecture-breaking changes are merged.

### Fail PR on Violations

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
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Run Truss architecture check
        run: npx truss-lint check
```

## CLI Test Coverage

The integration suite uses fixture repos and committed snapshots to keep the CLI contract explicit.

- Snapshot tests for human-readable and JSON output
- Validation of exit codes (`0`–`3`)
- Coverage of clean, violation, suppressed, and error scenarios
- Coverage of parser diagnostics and graph diagnostics
-	Coverage of deterministic cycle detection     
      





