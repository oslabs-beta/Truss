"use strict";
//Represents a single dependency between two source files
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExitCode = exports.REPORT_SCHEMA_VERSION = void 0;
exports.REPORT_SCHEMA_VERSION = "1.1.0";
//Exit codes used by the CLI process
exports.ExitCode = {
    OK: 0,
    VIOLATIONS: 1,
    CONFIG_ERROR: 2,
    INTERNAL_ERROR: 3,
};
