export interface LayerMap {
  [layerName: string]: string;
}

export interface RuleConfig {
  id: string;
  type: "no-cross-layer";
  from: string;
  to: string;
}

export interface ArchitectureConfig {
  layers: LayerMap;
  rules: RuleConfig[];
}

import fs from "fs";
import yaml from "js-yaml";
import { ArchitectureConfig } from "../rules/config";

export function loadConfig(path: string): ArchitectureConfig {
  const raw = fs.readFileSync(path, "utf8");
  return yaml.load(raw) as ArchitectureConfig;
}