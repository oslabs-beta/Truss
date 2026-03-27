import { TrussConfig } from "../config/configSchema";
import { SuppressedViolation, Violation, DependencyEdge } from "./types";

function matchLayer(
  file: string,
  layers: TrussConfig["layers"],
): string | null {
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
  const internalEdges = edges.filter(
    (edge): edge is Extract<DependencyEdge, { importKind: "internal" }> =>
      edge.importKind === "internal",
  );

  // build adjacency list for the transitive BFS walk below
  const outgoingByFile = new Map<string, typeof internalEdges>();
  for (const edge of internalEdges) {
    const bucket = outgoingByFile.get(edge.fromFile);
    if (bucket) {
      bucket.push(edge);
      continue;
    }
    outgoingByFile.set(edge.fromFile, [edge]);
  }

  for (const [fromFile, outgoing] of outgoingByFile.entries()) {
    outgoing.sort(
      (a, b) =>
        a.line - b.line ||
        a.toFile.localeCompare(b.toFile) ||
        a.importText.localeCompare(b.importText),
    );
    outgoingByFile.set(fromFile, outgoing);
  }

  const getLayer = (file: string): string | null => {
    const cached = fileToLayer.get(file);
    if (cached) return cached;
    const layer = matchLayer(file, config.layers);
    if (layer) fileToLayer.set(file, layer);
    return layer;
  };

  const emittedViolationKeys = new Set<string>();

  for (const edge of internalEdges) {
    const fromLayer = getLayer(edge.fromFile);
    if (!fromLayer) continue;

    const applicableRules = config.rules.filter((rule) => rule.from === fromLayer);
    if (applicableRules.length === 0) continue;

    // BFS from the first imported file; track the full path so transitive
    // violations show the chain rather than a misleading import text.
    const queue: Array<{ file: string; path: string[] }> = [
      { file: edge.toFile, path: [edge.fromFile, edge.toFile] },
    ];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const { file: currentFile, path: currentPath } = queue.shift()!;
      if (visited.has(currentFile)) continue;
      visited.add(currentFile);

      const currentLayer = getLayer(currentFile);
      if (currentLayer) {
        for (const rule of applicableRules) {
          if (!rule.disallow.includes(currentLayer)) continue;

          const isDirect = currentPath.length === 2;
          const importText = isDirect
            ? edge.importText
            : `(transitive: ${currentPath.join(" → ")})`;
          const reportLine = isDirect ? edge.line : 0;

          const key = [
            rule.name,
            edge.fromFile,
            currentFile,
            reportLine.toString(),
            importText,
          ].join("|");
          if (emittedViolationKeys.has(key)) continue;
          emittedViolationKeys.add(key);

          violations.push({
            ruleName: rule.name,
            fromLayer,
            toLayer: currentLayer,
            edge: { ...edge, toFile: currentFile, importText, line: reportLine },
            reason:
              rule.message ??
              `${fromLayer} layer must not depend on ${currentLayer} layer.`,
          });
        }
      }

      const next = outgoingByFile.get(currentFile);
      if (!next) continue;
      for (const out of next) {
        queue.push({ file: out.toFile, path: [...currentPath, out.toFile] });
      }
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
