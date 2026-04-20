"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.isIgnoredPath = isIgnoredPath;
exports.toRepoRelativePosix = toRepoRelativePosix;
exports.isLocalSpecifier = isLocalSpecifier;
exports.resolveImportToFile = resolveImportToFile;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const logger_1 = require("./logger");
/**
 * File extensions we try when resolving local imports.
 */
const RESOLVABLE_EXTENSIONS = [
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".mts",
    ".cts",
    ".mjs",
    ".cjs",
];
function isIgnoredPath(rel, ignore) {
    const relPosix = rel.split(path.sep).join("/");
    for (const pattern of ignore) {
        const normalized = pattern.split(path.sep).join("/");
        // tests/fixtures/**
        if (normalized.endsWith("/**")) {
            const base = normalized.slice(0, -3);
            if (relPosix === base || relPosix.startsWith(base + "/")) {
                return true;
            }
        }
        // dist, node_modules
        if (relPosix === normalized ||
            relPosix.startsWith(normalized + "/") ||
            relPosix.includes("/" + normalized + "/")) {
            return true;
        }
        // **/*.test.ts
        if (normalized === "**/*.test.ts" && relPosix.endsWith(".test.ts")) {
            return true;
        }
        if (normalized === "**/*.spec.ts" && relPosix.endsWith(".spec.ts")) {
            return true;
        }
    }
    return false;
}
/**
 * Convert absolute file path to repo-relative POSIX path.
 * Returns null if file is outside the repo root.
 */
function toRepoRelativePosix(repoRoot, absPath) {
    // Rejects paths outside the repo so internal edges never point at external files.
    const rel = path.relative(repoRoot, absPath);
    if (rel.startsWith("..") || path.isAbsolute(rel)) {
        return null;
    }
    return rel.split(path.sep).join("/");
}
/**
 * Check if import specifier points to a local file.
 * Examples:
 * - "./x"    -> true
 * - "../x"   -> true
 * - "/src/x" -> true
 * - "react"  -> false
 */
function isLocalSpecifier(specifier) {
    return specifier.startsWith(".") || specifier.startsWith("/");
}
/**
 * Resolve a local import path to a repo-relative file path.
 * Returns null if:
 * - the specifier is external
 * - or the target file cannot be found
 */
function resolveImportToFile(repoRoot, fromFile, specifier) {
    if (!isLocalSpecifier(specifier)) {
        logger_1.logger.debug(`Skipping external import "${specifier}" from "${fromFile}"`);
        return null;
    }
    const fromAbs = path.resolve(repoRoot, fromFile);
    const baseDir = path.dirname(fromAbs);
    // Leading `/` is treated as repo-root-relative; leading `.` stays relative to the importing file.
    const unresolved = specifier.startsWith("/")
        ? path.resolve(repoRoot, `.${specifier}`)
        : path.resolve(baseDir, specifier);
    logger_1.logger.debug(`Base resolved path for "${specifier}": ${unresolved}`);
    // Tries the raw path, extension variants, and `index.*` variants in the same order
    // import paths are commonly resolved when extensions are omitted.
    const candidates = [
        unresolved,
        ...RESOLVABLE_EXTENSIONS.map((ext) => `${unresolved}${ext}`),
        ...RESOLVABLE_EXTENSIONS.map((ext) => path.join(unresolved, `index${ext}`)),
    ];
    for (const candidate of candidates) {
        if (!fs.existsSync(candidate))
            continue;
        if (!fs.statSync(candidate).isFile())
            continue;
        const rel = toRepoRelativePosix(repoRoot, candidate);
        if (rel) {
            logger_1.logger.debug(`Resolved "${specifier}" from "${fromFile}" to "${rel}"`);
            return rel;
        }
    }
    logger_1.logger.debug(`Could not resolve "${specifier}" from "${fromFile}"`);
    return null;
}
