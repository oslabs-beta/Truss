"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadTrussConfig = loadTrussConfig;
const fs = require("node:fs");
const path = require("node:path");
const yaml = require("yaml");
const errors_1 = require("../utils/errors");
// export class ConfigError extends Error {
//   constructor(message: string) {
//     super(message);
//     this.name = "ConfigError";
//   }
// }
function labelPath(displayPath, fallbackPath) {
    return displayPath ?? fallbackPath ?? "truss.yml";
}
function buildMissingConfigMessage(shownPath) {
    if (shownPath === "truss.yml") {
        return `Config file not found: ${shownPath}. Add a truss.yml at the repo root or pass --config <path>.`;
    }
    return `Config file not found: ${shownPath}. Create the file at that path or fix --config.`;
}
function formatYamlError(err, shownPath) {
    const detail = err.message.split("\n")[0].trim();
    const location = detail.match(/at line (\d+), column (\d+)/);
    if (location) {
        return `Invalid YAML in ${shownPath} at line ${location[1]}, column ${location[2]}. Fix the syntax and try again.`;
    }
    return `Invalid YAML in ${shownPath}. Fix the syntax and try again.`;
}
// Pseudo-flow: read YAML -> validate required shape -> return typed config.
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
        if (!Array.isArray(patterns) || patterns.length === 0 || patterns.some((p) => typeof p !== "string")) {
            throw new errors_1.ConfigError(`Invalid layer "${layerName}" in ${shownPath}. Expected a non-empty list of path patterns, for example: ["src/${layerName}"].`);
        }
    }
    if (!cfg.rules || !Array.isArray(cfg.rules) || cfg.rules.length === 0) {
        throw new errors_1.ConfigError(`No rules defined in ${shownPath}. Add at least one rule under "rules".`);
    }
    const knownLayers = new Set(layerNames);
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
        if (!Array.isArray(r.disallow) || r.disallow.length === 0 || r.disallow.some((x) => typeof x !== "string")) {
            throw new errors_1.ConfigError(`Rule "${r.name}" in ${shownPath} must define "disallow" as a non-empty string[].`);
        }
        for (const target of r.disallow) {
            if (!knownLayers.has(target)) {
                throw new errors_1.ConfigError(`Rule "${r.name}" in ${shownPath} references unknown disallow layer: "${target}".`);
            }
        }
    }
    return cfg;
}
