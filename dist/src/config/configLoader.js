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
exports.loadTrussConfig = loadTrussConfig;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const yaml = __importStar(require("yaml"));
const errors_1 = require("../utils/errors");
function labelPath(displayPath, fallbackPath) {
    // Prefers the display label shown to users, then the requested path, then the default filename.
    return displayPath ?? fallbackPath ?? "truss.yml";
}
function buildMissingConfigMessage(shownPath) {
    // The fix guidance changes depending on whether the default config path was expected.
    if (shownPath === "truss.yml") {
        return `Config file not found: ${shownPath}. Add a truss.yml at the repo root or pass --config <path>.`;
    }
    return `Config file not found: ${shownPath}. Create the file at that path or fix --config.`;
}
function formatYamlError(err, shownPath) {
    // Keeps parser line and column details when the YAML library includes them.
    const detail = err.message.split("\n")[0].trim();
    const location = detail.match(/at line (\d+), column (\d+)/);
    if (location) {
        return `Invalid YAML in ${shownPath} at line ${location[1]}, column ${location[2]}. Fix the syntax and try again.`;
    }
    return `Invalid YAML in ${shownPath}. Fix the syntax and try again.`;
}
function normalizeLayerPattern(pattern) {
    const trimmed = pattern.trim().split(path.sep).join("/");
    if (!trimmed)
        return trimmed;
    if (trimmed.includes("*"))
        return trimmed;
    return trimmed.endsWith("/") ? `${trimmed}**` : `${trimmed}/**`;
}
// Loads the YAML file, validates the required shape, and returns it as a typed config.
function loadTrussConfig(configPath, displayPath) {
    const abs = path.resolve(configPath);
    const shownPath = labelPath(displayPath, configPath);
    if (!fs.existsSync(abs)) {
        throw new errors_1.ConfigError(buildMissingConfigMessage(shownPath));
    }
    let parsed;
    try {
        const raw = fs.readFileSync(abs, "utf8");
        parsed = yaml.parse(raw);
    }
    catch (e) {
        throw new errors_1.ConfigError(formatYamlError(e, shownPath));
    }
    if (!parsed || typeof parsed !== "object") {
        throw new errors_1.ConfigError(`Invalid config in ${shownPath}: expected a YAML object at the document root.`);
    }
    const cfg = parsed;
    if (!cfg.layers || typeof cfg.layers !== "object" || Array.isArray(cfg.layers)) {
        throw new errors_1.ConfigError(`Invalid config in ${shownPath}: "layers" must be an object mapping layer names to path patterns.`);
    }
    const layerNames = Object.keys(cfg.layers);
    if (layerNames.length === 0) {
        throw new errors_1.ConfigError(`Invalid config in ${shownPath}: "layers" must define at least one layer.`);
    }
    for (const [layerName, patterns] of Object.entries(cfg.layers)) {
        if (!Array.isArray(patterns) ||
            patterns.length === 0 ||
            patterns.some((p) => typeof p !== "string")) {
            throw new errors_1.ConfigError(`Invalid layer "${layerName}" in ${shownPath}. Expected a non-empty list of path patterns, for example: ["src/${layerName}"].`);
        }
    }
    const normalizedLayers = Object.fromEntries(Object.entries(cfg.layers).map(([layerName, patterns]) => [
        layerName,
        patterns.map(normalizeLayerPattern),
    ]));
    if (!("rules" in cfg) || !Array.isArray(cfg.rules)) {
        throw new errors_1.ConfigError(`Invalid config in ${shownPath}: "rules" must be an array.`);
    }
    const knownLayers = new Set(layerNames);
    // Validates each rule's shape before checking that every referenced layer name exists.
    for (const r of cfg.rules) {
        if (!r || typeof r !== "object") {
            throw new errors_1.ConfigError(`Invalid rule entry in ${shownPath}: expected an object.`);
        }
        if (!r.name || typeof r.name !== "string") {
            throw new errors_1.ConfigError(`Invalid rule entry in ${shownPath}: missing "name".`);
        }
        if (!r.from || typeof r.from !== "string") {
            throw new errors_1.ConfigError(`Rule "${r.name}" in ${shownPath} is missing "from".`);
        }
        if (!knownLayers.has(r.from)) {
            throw new errors_1.ConfigError(`Rule "${r.name}" in ${shownPath} references unknown layer in "from": "${r.from}".`);
        }
        if (!Array.isArray(r.disallow) ||
            r.disallow.length === 0 ||
            r.disallow.some((x) => typeof x !== "string")) {
            throw new errors_1.ConfigError(`Rule "${r.name}" in ${shownPath} must define "disallow" as a non-empty string[].`);
        }
        if ("message" in r && r.message !== undefined && typeof r.message !== "string") {
            throw new errors_1.ConfigError(`Rule "${r.name}" in ${shownPath} has invalid "message": expected a string.`);
        }
        for (const target of r.disallow) {
            if (!knownLayers.has(target)) {
                throw new errors_1.ConfigError(`Rule "${r.name}" in ${shownPath} references unknown disallow layer: "${target}".`);
            }
        }
    }
    return {
        ...cfg,
        layers: normalizedLayers,
    };
}
