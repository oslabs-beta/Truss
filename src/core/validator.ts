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