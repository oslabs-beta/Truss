import * as fs from "node:fs";
import * as path from "node:path";
import * as yaml from "yaml";
import { TrussConfig } from "./configSchema";
import { ConfigError } from "../utils/errors";

// export class ConfigError extends Error {
//   constructor(message: string) {
//     super(message);
//     this.name = "ConfigError";
//   }
// }

// Pseudo-flow: read YAML -> validate required shape -> return typed config.
export function loadTrussConfig(configPath: string): TrussConfig {
  const abs = path.resolve(configPath);

  if (!fs.existsSync(abs)) {
    throw new ConfigError(`Missing config: ${configPath} (expected truss.yml)`);
  }

  let parsed: unknown;
  try {
    const raw = fs.readFileSync(abs, "utf8");
    parsed = yaml.parse(raw);
  } catch (e) {
    throw new ConfigError(`Invalid YAML in ${configPath}: ${(e as Error).message}`);
  }

  if (!parsed || typeof parsed !== "object") {
    throw new ConfigError(`Invalid config in ${configPath}: expected a YAML object`);
  }

  const cfg = parsed as Partial<TrussConfig>;

  if (!cfg.layers || typeof cfg.layers !== "object" || Array.isArray(cfg.layers)) {
    throw new ConfigError('Invalid config: "layers" must be defined as an object');
  }

  const layerNames = Object.keys(cfg.layers);
  if (layerNames.length === 0) {
    throw new ConfigError('Invalid config: "layers" must define at least one layer');
  }

  for (const [layerName, patterns] of Object.entries(cfg.layers)) {
    if (!Array.isArray(patterns) || patterns.length === 0 || patterns.some((p) => typeof p !== "string")) {
      throw new ConfigError(`Invalid layer config: layer "${layerName}" must map to non-empty string[]`);
    }
  }

  if (!cfg.rules || !Array.isArray(cfg.rules) || cfg.rules.length === 0) {
    throw new ConfigError('Invalid config: "rules" must be a non-empty array');
  }

  const knownLayers = new Set(layerNames);

  for (const r of cfg.rules) {
    if (!r || typeof r !== "object") throw new ConfigError("Invalid rule entry: expected object");
    if (!r.name || typeof r.name !== "string") throw new ConfigError('Rule is missing "name"');
    if (!r.from || typeof r.from !== "string") {
      throw new ConfigError(`Rule "${r.name}" missing "from"`);
    }
    if (!knownLayers.has(r.from)) {
      throw new ConfigError(`Rule "${r.name}" references unknown layer in "from": "${r.from}"`);
    }
    if (!Array.isArray(r.disallow) || r.disallow.length === 0 || r.disallow.some((x) => typeof x !== "string")) {
      throw new ConfigError(`Rule "${r.name}" must have non-empty "disallow" as string[]`);
    }
    for (const target of r.disallow) {
      if (!knownLayers.has(target)) {
        throw new ConfigError(`Rule "${r.name}" references unknown disallow layer: "${target}"`);
      }
    }
  }

  return cfg as TrussConfig;
}
