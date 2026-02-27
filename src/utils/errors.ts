// utils/errors.ts

/**
 * Base error class for all Truss-specific errors.
 * Extends the native Error object.
 */
export class TrussError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TrussError";
  }
}

/**
 * Thrown when there is a configuration problem.
 * Example: config file missing, invalid structure, wrong paths.
 */
export class ConfigError extends TrussError {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

/**
 * Thrown when scanning source files fails.
 * Example: filesystem errors or invalid repo root.
 */
export class FileScanError extends TrussError {
  constructor(message: string) {
    super(message);
    this.name = "FileScanError";
  }
}

/**
 * Thrown when import resolution fails.
 * Example: cannot resolve a relative import or alias.
 */
export class ResolveError extends TrussError {
  constructor(message: string) {
    super(message);
    this.name = "ResolveError";
  }
}