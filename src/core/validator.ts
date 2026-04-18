import { TrussConfig } from "../config/configSchema";
import { SuppressedViolation, Violation, DependencyEdge } from "./types";
import { DependencyGraph } from "../graph/graphBuilder";
import { getTransitiveDependencies, findDependencyPath } from "../graph/traversal";
import { minimatch } from "minimatch";

function matchLayer(file: string, layers: Record<string, string[]>): string | null {
  for (const [layerName, patterns] of Object.entries(layers)) {
    for (const pattern of patterns) {
      if (minimatch(file, pattern)) {
        return layerName;
      }
    }
  }
  return null;

}

export function evaluateRules(opts: {
  config: TrussConfig;
  edges: DependencyEdge[];
  graph: DependencyGraph;
}): { violations: Violation[] } {
  const { config, edges, graph } = opts;
  const directViolations: Violation[] = [];

  for (const edge of edges) {
    if (edge.importKind !== "internal") continue;

    const fromLayer = matchLayer(edge.fromFile, config.layers);
    const toLayer = matchLayer(edge.toFile, config.layers);

    if (!fromLayer || !toLayer) continue;

    for (const rule of config.rules) {
      if (rule.from !== fromLayer) continue;
      if (!rule.disallow.includes(toLayer)) continue;

      directViolations.push({
  ruleName: rule.name,
  fromLayer,
  toLayer,
  edge,
  reason:
    rule.message ??
    `Layer "${fromLayer}" must not depend on layer "${toLayer}"`,
});
    }
  }

  const transitiveViolations = collectTransitiveViolations({
    config,
    graph,
    edges,
  });

  const merged = [...directViolations, ...transitiveViolations];
  const deduped: Violation[] = [];
  const seen = new Set<string>();

  for (const violation of merged) {
    const edge = violation.edge;
    const key =
      edge.importKind === "internal"
        ? `${violation.ruleName}|${edge.fromFile}|${edge.toFile}|${violation.reason}`
        : `${violation.ruleName}|${edge.fromFile}|external|${violation.reason}`;

    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(violation);
  }

  return { violations: deduped };
}

export function applySuppressions(opts: {
  config: TrussConfig;
  violations: Violation[];
}): { unsuppressed: Violation[]; suppressed: SuppressedViolation[] } {
  const suppressions = opts.config.suppressions ?? [];

  const suppressed: SuppressedViolation[] = [];
  const unsuppressed: Violation[] = [];

  for (const v of opts.violations) {
    // match on source file + rule name
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

function buildInternalEdgeMap(edges: DependencyEdge[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();

  for (const edge of edges) {
    if (edge.importKind !== "internal") continue;

    if (!map.has(edge.fromFile)) {
      map.set(edge.fromFile, new Set<string>());
    }

    map.get(edge.fromFile)!.add(edge.toFile);
  }

  return map;
}

function collectTransitiveViolations(opts: {
  config: TrussConfig;
  graph: DependencyGraph;
  edges: DependencyEdge[];
}): Violation[] {
  const violations: Violation[] = [];
  const directEdgeMap = buildInternalEdgeMap(opts.edges);
  const seen = new Set<string>();

  for (const [fromFile] of directEdgeMap) {
    const fromLayer = matchLayer(fromFile, opts.config.layers);
    if (!fromLayer) continue;

    const reachable = getTransitiveDependencies(opts.graph, fromFile);

    for (const toFile of reachable) {
      if (fromFile === toFile) continue;

      const toLayer = matchLayer(toFile, opts.config.layers);
      if (!toLayer) continue;

      const isDirect = directEdgeMap.get(fromFile)?.has(toFile) ?? false;
      if (isDirect) continue;

      for (const rule of opts.config.rules) {
        if (rule.from !== fromLayer) continue;
        if (!rule.disallow.includes(toLayer)) continue;

        const key = `${rule.name}|${fromFile}|${toFile}`;
        if (seen.has(key)) continue;

        const path = findDependencyPath(opts.graph, fromFile, toFile);
        const importText = path
          ? `(transitive: ${path.join(" → ")})`
          : `[transitive dependency]`;

        violations.push({
  ruleName: rule.name,
  fromLayer,
  toLayer,
  edge: {
    fromFile,
    toFile,
    importText: "[transitive]",
    line: 0,
    importKind: "internal",
  },
  reason: rule.message ?? `Layer "${fromLayer}" must not depend on layer "${toLayer}"`,
  path: path ?? undefined,
});

        seen.add(key);
      }
    }
  }

  return violations;
}