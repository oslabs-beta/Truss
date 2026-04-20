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
exports.discoverSourceFiles = discoverSourceFiles;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const errors_1 = require("../utils/errors");
const logger_1 = require("../utils/logger");
const pathResolver_1 = require("../utils/pathResolver");
const DEFAULT_IGNORES = new Set([
    "node_modules",
    ".git",
    "dist",
    "build",
    "out",
    ".next",
    ".turbo",
    "coverage",
    ".cache",
    ".yarn",
]);
const EXT_OK = new Set([".ts", ".tsx", ".js", ".jsx"]);
function discoverSourceFiles(opts) {
    // Resolves the root once so every discovered file can be normalized the same way.
    const repoRoot = path.resolve(opts.repoRoot);
    logger_1.logger.debug(`Scanning source files under: ${repoRoot}`);
    // Combines built-in ignores with any repo-specific ignores from config.
    const ignore = new Set(DEFAULT_IGNORES);
    for (const i of opts.extraIgnores ?? [])
        ignore.add(i);
    logger_1.logger.debug(`Using ignore rules: ${Array.from(ignore).join(", ")}`);
    const results = [];
    // Walks the directory tree depth-first and collects files with supported source extensions.
    function walk(dirAbs) {
        let entries;
        try {
            entries = fs.readdirSync(dirAbs, { withFileTypes: true });
        }
        catch {
            const shownDir = path.basename(dirAbs) || dirAbs;
            logger_1.logger.error(`Failed to read directory: ${dirAbs}`);
            throw new errors_1.FileScanError(`Failed to read directory: ${shownDir}`);
        }
        for (const ent of entries) {
            const abs = path.join(dirAbs, ent.name);
            const rel = path.relative(repoRoot, abs);
            // Skip ignored files and directories before doing any deeper work.
            if ((0, pathResolver_1.isIgnoredPath)(rel, ignore))
                continue;
            if (ent.isDirectory()) {
                walk(abs);
                continue;
            }
            if (!ent.isFile())
                continue;
            if (!EXT_OK.has(path.extname(ent.name)))
                continue;
            results.push(rel.split(path.sep).join("/"));
        }
    }
    walk(repoRoot);
    // Sorting guarantees deterministic file order for downstream analysis and snapshots.
    results.sort();
    logger_1.logger.debug(`Discovered ${results.length} source files`);
    return results;
}
