"use strict";
// utils/errors.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResolveError = exports.FileScanError = exports.ConfigError = exports.TrussError = void 0;
/**
 * Base error class for all Truss-specific errors.
 * Extends the native Error object.
 */
class TrussError extends Error {
    constructor(message) {
        super(message);
        this.name = "TrussError";
    }
}
exports.TrussError = TrussError;
/**
 * Thrown when there is a configuration problem.
 * Example: config file missing, invalid structure, wrong paths.
 */
class ConfigError extends TrussError {
    constructor(message) {
        super(message);
        this.name = "ConfigError";
    }
}
exports.ConfigError = ConfigError;
/**
 * Thrown when scanning source files fails.
 * Example: filesystem errors or invalid repo root.
 */
class FileScanError extends TrussError {
    constructor(message) {
        super(message);
        this.name = "FileScanError";
    }
}
exports.FileScanError = FileScanError;
/**
 * Thrown when import resolution fails.
 * Example: cannot resolve a relative import or alias.
 */
class ResolveError extends TrussError {
    constructor(message) {
        super(message);
        this.name = "ResolveError";
    }
}
exports.ResolveError = ResolveError;
