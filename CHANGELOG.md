# Changelog

Notable changes to Truss are documented here, grouped by release and change type.

## [0.2.0] - 2026-09-16

### Added

- JSON and HTML report artifacts through `check --report-dir`, including a styled HTML summary of status, violations, and diagnostics.
- Optional AWS S3 report publishing through `--upload-s3`, `TRUSS_S3_BUCKET`, and `TRUSS_S3_PREFIX`.
- Opt-in OpenTelemetry console metrics for analysis duration, files, dependency edges, violations, and diagnostics through `TRUSS_OTEL_CONSOLE=1`.
- Docker support with build, help, and architecture-check scripts, plus CI verification of the Docker build and CLI startup.
- CI package builds, architecture enforcement, and uploaded analysis report artifacts.
- Behavioral tests for HTML and DOT rendering, CLI commands and artifacts, configuration validation, path resolution, logging, and S3 publishing.
- Source-only coverage reporting with `npm run test:coverage`, enforcing 80% minimum line, branch, and function coverage locally and in CI; tests, dist, and node_modules are excluded.

### Changed

- Extracted report generation into dedicated reporting modules.
- Expanded README guidance for CI enforcement, Docker, generated reports, S3 publishing, telemetry, and testing; added CI, npm version, and license badges alongside existing installation instructions.

### Fixed

- Excluded declaration-level `import type` and `export type` dependencies from runtime graph analysis to avoid false-positive dependencies and cycles.

### Removed

- Removed tracked `node_modules` files and a duplicate ignore entry.

[0.2.0]: https://github.com/oslabs-beta/Truss/compare/v0.1.3...v0.2.0
