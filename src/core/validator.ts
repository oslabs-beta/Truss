import { TrussConfig } from "../config/configSchema";
import { SuppressedViolation, Violation, DependencyEdge } from "./types";

/**
 * matchLayer()
 * Purpose: Find a layer name for a file using config.layers patterns.
 * Input:
 *  - file: file path (string)
 *  - layers: config "layers" object (layerName -> patterns[])
 * Output:
 *  - layer name (string) if matched, otherwise null
 */
function matchLayer(file: string, layers: TrussConfig["layers"]): string | null {
  for (const [layerName, patterns] of Object.entries(layers)) {
    for (const pattern of patterns) {
      // Remove "**" at the end (very simple glob support).
      const normalized = pattern.replace(/\*\*$/, "");

      // If file path starts with the pattern → it belongs to this layer.
      if (file.startsWith(normalized)) return layerName;
    }
  }

  // No match → file is not in any layer.
  return null;
}
export function evaluateRules(opts: {
  config: TrussConfig;
  edges: DependencyEdge[];
}): { violations: Violation[]; fileToLayer: Map<string, string> } {
  const { config, edges } = opts;

  const fileToLayer = new Map<string, string>();
  const violations: Violation[] = [];

  const getLayer = (file: string): string | null => {
    const cached = fileToLayer.get(file);
    if (cached) return cached;

    const layer = matchLayer(file, config.layers);
    if (layer) fileToLayer.set(file, layer);

    return layer;
  };

  for (const edge of edges) {
    // Only internal dependencies participate in layer rules
    if (edge.importKind !== "internal") continue;

    const fromLayer = getLayer(edge.fromFile);
    const toLayer = getLayer(edge.toFile);

    if (!fromLayer || !toLayer) continue;

    for (const rule of config.rules) {
      if (rule.from !== fromLayer) continue;
      if (!rule.disallow.includes(toLayer)) continue;

      violations.push({
        ruleName: rule.name,
        fromLayer,
        toLayer,
        edge,
        reason:
          rule.message ??
          `${fromLayer} layer must not depend on ${toLayer} layer.`,
      });
    }
  }

  return { violations, fileToLayer };
}

