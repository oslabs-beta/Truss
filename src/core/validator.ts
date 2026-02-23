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

  // Cache: file path -> layer name (only for files that match).
  const fileToLayer = new Map<string, string>();

  // Helper: get layer for a file, using cache to avoid repeating work.
  const getLayer = (file: string): string | null => {
    const cached = fileToLayer.get(file);
    if (cached) return cached;

    const layer = matchLayer(file, config.layers);
    if (layer) fileToLayer.set(file, layer);

    return layer;
  };

  const violations: Violation[] = [];

  for (const edge of edges) {
    // Find layers for both sides of the dependency.
    const fromLayer = getLayer(edge.fromFile);
    const toLayer = getLayer(edge.toFile);

    // If file is not in any known layer → skip it.
    if (!fromLayer || !toLayer) continue;

    for (const rule of config.rules) {
      // Rule applies only if "from" matches current layer.
      if (rule.from !== fromLayer) continue;

      // Only a violation if the target layer is in disallow list.
      if (!rule.disallow.includes(toLayer)) continue;

      // Create a Violation object (edge contains file/line/import text).
      violations.push({
        ruleName: rule.name,
        fromLayer,
        toLayer,
        edge, // store the full edge object here
        reason: rule.message ?? `${fromLayer} layer must not depend on ${toLayer} layer.`,
      });
    }
  }

  return { violations, fileToLayer };
}

/**
 * applySuppressions()
 * Purpose: Split violations into two lists:
 *  - unsuppressed: real violations (should fail the check)
 *  - suppressed: violations that are allowed with a suppression reason
 * Input:
 *  - opts.config: Truss config (we use config.suppressions)
 *  - opts.violations: violations found by evaluateRules
 * Output:
 *  - unsuppressed + suppressed arrays
 */
export function applySuppressions(opts: {
  config: TrussConfig;
  violations: Violation[];
}): { unsuppressed: Violation[]; suppressed: SuppressedViolation[] } {
  const suppressions = opts.config.suppressions ?? [];

  const suppressed: SuppressedViolation[] = [];
  const unsuppressed: Violation[] = [];

  for (const v of opts.violations) {
    // Find suppression that matches "from file" + rule name.
    const s = suppressions.find(
      (x) => x.file === v.edge.fromFile && x.rule === v.ruleName
    );

    if (s) suppressed.push({ ...v, suppressionReason: s.reason });
    else unsuppressed.push(v);
  }

  // Sort by file path, then by line number (stable output).
  const byLocation = (a: Violation, b: Violation) =>
    a.edge.fromFile.localeCompare(b.edge.fromFile) || a.edge.line - b.edge.line;

  suppressed.sort(byLocation);
  unsuppressed.sort(byLocation);

  return { unsuppressed, suppressed };
}
