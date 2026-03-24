import { TrussConfig } from "../config/configSchema";
import { DependencyEdge, SuppressedViolation, Violation } from "./types";

function matchLayer(file: string, layers: TrussConfig["layers"]): string | null {
  for (const [layerName, patterns] of Object.entries(layers)) {
    for (const pattern of patterns) {
      const normalized = pattern.replace(/\*\*$/, "");
      if (file.startsWith(normalized)) return layerName;
    }
  }

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

export function applySuppressions(opts: {
  config: TrussConfig;
  violations: Violation[];
}): { unsuppressed: Violation[]; suppressed: SuppressedViolation[] } {
  const suppressions = opts.config.suppressions ?? [];
  const suppressed: SuppressedViolation[] = [];
  const unsuppressed: Violation[] = [];

  for (const v of opts.violations) {
    const s = suppressions.find(
      (x) => x.file === v.edge.fromFile && x.rule === v.ruleName,
    );

    if (s) suppressed.push({ ...v, suppressionReason: s.reason });
    else unsuppressed.push(v);
  }

  const byLocation = (a: Violation, b: Violation) =>
    a.edge.fromFile.localeCompare(b.edge.fromFile) || a.edge.line - b.edge.line;

  suppressed.sort(byLocation);
  unsuppressed.sort(byLocation);

  return { unsuppressed, suppressed };
}
