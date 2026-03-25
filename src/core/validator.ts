import { TrussConfig } from "../config/configSchema";
import { SuppressedViolation, Violation, DependencyEdge } from "./types";

/**
 * function matchLayer()
 * Purpose: Find a layer name for a file using config.layers patterns.
 */
function matchLayer(file: string, layers: TrussConfig["layers"]): string | null {
  // Checks layer patterns in config order and returns the first one that matches the file path.
  for (const [layerName, patterns] of Object.entries(layers)) {
    for (const pattern of patterns) {
      // Remove "**" at the end (very simple glob support).
      const normalized = pattern.replace(/\*\*$/, "");

      // If file path starts with the pattern -> it belongs to this layer.
      if (file.startsWith(normalized)) return layerName;
    }
  }

  // No match -> file is not in any layer.
  return null;
}

/**
 * evaluateRules()
 * Purpose: Check all dependency edges against config rules and collect violations.
 */
export function evaluateRules(opts: {
  config: TrussConfig;
  edges: DependencyEdge[];
}): { violations: Violation[]; fileToLayer: Map<string, string> } {
  const { config, edges } = opts;

  // Cache: file path -> layer name (only for files that match).
  const fileToLayer = new Map<string, string>();
  const violations: Violation[] = [];

  const getLayer = (file: string): string | null => {
    // Caches resolved layers so repeated files do not need to scan the config again.
    const cached = fileToLayer.get(file);
    if (cached) return cached;

    const layer = matchLayer(file, config.layers);
    if (layer) fileToLayer.set(file, layer);

    return layer;
  };

  // Only internal edges are checked. Each edge becomes a violation when its source layer
  // matches a rule's `from` value and its target layer appears in that rule's `disallow` list.
  for (const edge of edges) {
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

/**
 * applySuppressions()
 * Purpose: Split violations into unsuppressed + suppressed
 */
export function applySuppressions(opts: {
  config: TrussConfig;
  violations: Violation[];
}): { unsuppressed: Violation[]; suppressed: SuppressedViolation[] } {
  const suppressions = opts.config.suppressions ?? [];

  const suppressed: SuppressedViolation[] = [];
  const unsuppressed: Violation[] = [];

  // A suppression applies only when both the source file and rule name match the violation.
  for (const v of opts.violations) {
    // Find suppression that matches file + rule
    const s = suppressions.find(
      (x) => x.file === v.edge.fromFile && x.rule === v.ruleName,
    );

    if (s) suppressed.push({ ...v, suppressionReason: s.reason });
    else unsuppressed.push(v);
  }

  const byLocation = (a: Violation, b: Violation) =>
    a.edge.fromFile.localeCompare(b.edge.fromFile) ||
    a.edge.line - b.edge.line;

  // Sorting keeps CLI output and snapshots stable across runs.
  suppressed.sort(byLocation);
  unsuppressed.sort(byLocation);

  return { unsuppressed, suppressed };
}
