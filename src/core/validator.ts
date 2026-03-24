import { TrussConfig } from "../config/configSchema";
import { SuppressedViolation, Violation, DependencyEdge } from "./types";

/**
 * function matchLayer()
 * Purpose: Find a layer name for a file using config.layers patterns.
 * Input:
 *  - file: file path (string)
 *  - layers: config "layers" object (layerName -> patterns[])
 * Output:
 *  - layer name (string) if matched, otherwise null
 */
function matchLayer(
  file: string,
  layers: TrussConfig["layers"],
): string | null {
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

/**
 * evaluateRules()
 * Purpose: Check all dependency edges against config rules and collect violations.
 * Input:
 *  - opts.config: full Truss config (layers + rules + suppressions)
 *  - opts.edges: list of dependency edges between files
 * Output:
 *  - violations: all rule violations found
 *  - fileToLayer: cache map (file path -> layer name) for matched files
 */
export function evaluateRules(opts: {
  config: TrussConfig;
  edges: DependencyEdge[];
}): { violations: Violation[]; fileToLayer: Map<string, string> } {
  const { config, edges } = opts;
  // #region agent log
  fetch("http://127.0.0.1:7861/ingest/8b9c63fd-394c-4722-bece-a02463c6f64a", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "8d2d4f",
    },
    body: JSON.stringify({
      sessionId: "8d2d4f",
      runId: "pre-fix",
      hypothesisId: "H2",
      location: "src/core/validator.ts:evaluateRules:entry",
      message: "evaluateRules entry",
      data: {
        edgeCount: edges.length,
        ruleCount: config.rules.length,
        layerCount: Object.keys(config.layers ?? {}).length,
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  const fileToLayer = new Map<string, string>();
  const violations: Violation[] = [];
  let didLogMatchLayerProbe = false;

  const getLayer = (file: string): string | null => {
    const cached = fileToLayer.get(file);
    if (cached) return cached;

    if (!didLogMatchLayerProbe) {
      didLogMatchLayerProbe = true;
      // #region agent log
      fetch(
        "http://127.0.0.1:7861/ingest/8b9c63fd-394c-4722-bece-a02463c6f64a",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Debug-Session-Id": "8d2d4f",
          },
          body: JSON.stringify({
            sessionId: "8d2d4f",
            runId: "pre-fix",
            hypothesisId: "H1",
            location: "src/core/validator.ts:getLayer:beforeMatchLayer",
            message: "matchLayer probe before invocation",
            data: { probeFile: file, matchLayerType: typeof matchLayer },
            timestamp: Date.now(),
          }),
        },
      ).catch(() => {});
      // #endregion
    }

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
