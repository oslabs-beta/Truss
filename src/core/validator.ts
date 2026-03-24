export function evaluateRules(opts: {
  config: TrussConfig;
  edges: DependencyEdge[];
}): { violations: Violation[]; fileToLayer: Map<string, string> } {
  const { config, edges } = opts;
  let didLogMatchLayerProbe = false;

  const fileToLayer = new Map<string, string>();
  const violations: Violation[] = [];

  const getLayer = (file: string): string | null => {
    // Caches resolved layers so repeated files do not need to scan the config again.
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
        reason:
          rule.message ??
          `${fromLayer} layer must not depend on ${toLayer} layer.`,
      });
    }
  }

  return { violations, fileToLayer };
}
