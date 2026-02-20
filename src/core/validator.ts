import { TrussConfig } from "../config/configSchema";
import { SuppressedViolation, Violation, DependencyEdge } from "./types";

function matchLayer(file: string, layers: TrussConfig["layers"]): string | null {
  for (const [layerName, patterns] of Object.entries(layers)) {
    for (const p of patterns) {
      const normalized = p.replace(/\*\*$/, "");
      if (file.startsWith(normalized)) return layerName;
    }
  }
  return null;
}

// Evaluate all edges against rules; do not stop at first violation.
export function evaluateRules(opts: {
  config: TrussConfig;
  edges: DependencyEdge[];
}): { violations: Violation[]; fileToLayer: Map<string, string> } {
  const { config, edges } = opts;
  const fileToLayer = new Map<string, string>();

  const getLayer = (file: string): string | null => {
    if (fileToLayer.has(file)) return fileToLayer.get(file) ?? null;
    const layer = matchLayer(file, config.layers);
    if (layer) fileToLayer.set(file, layer);
    return layer;
  };

  const violations: Violation[] = [];

  for (const edge of edges) {
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
        edge: DependencyEdge.fromFile,
        toFile: edge.toFile,
        line: edge.line,
        importText: edge.importText,
        reason: rule.message ?? `${fromLayer} layer must not depend on ${toLayer} layer.`,
      });
    }
  }

  return { violations, fileToLayer };
}

// Split violations into unsuppressed (failing) and suppressed (intentional) buckets.
export function applySuppressions(opts: {
  config: TrussConfig;
  violations: Violation[];
}): { unsuppressed: Violation[]; suppressed: SuppressedViolation[] } {
  const suppressions = opts.config.suppressions ?? [];
  const suppressed: SuppressedViolation[] = [];
  const unsuppressed: Violation[] = [];

  for (const v of opts.violations) {
    const s = suppressions.find((x) => x.file === v.fromFile && x.rule === v.ruleName);
    if (s) suppressed.push({ ...v, suppressionReason: s.reason });
    else unsuppressed.push(v);
  }

  suppressed.sort((a, b) => a.fromFile.localeCompare(b.fromFile) || a.line - b.line);
  unsuppressed.sort((a, b) => a.fromFile.localeCompare(b.fromFile) || a.line - b.line);

  return { unsuppressed, suppressed };
}
