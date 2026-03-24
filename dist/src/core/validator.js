"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateRules = evaluateRules;
exports.applySuppressions = applySuppressions;
function matchLayer(file, layers) {
    for (const [layerName, patterns] of Object.entries(layers)) {
        for (const pattern of patterns) {
            const normalized = pattern.replace(/\*\*$/, "");
            if (file.startsWith(normalized))
                return layerName;
        }
    }
    return null;
}
function evaluateRules(opts) {
    const { config, edges } = opts;
    const fileToLayer = new Map();
    const violations = [];
    const getLayer = (file) => {
        const cached = fileToLayer.get(file);
        if (cached)
            return cached;
        const layer = matchLayer(file, config.layers);
        if (layer)
            fileToLayer.set(file, layer);
        return layer;
    };
    for (const edge of edges) {
        // Only internal dependencies participate in layer rules
        if (edge.importKind !== "internal")
            continue;
        const fromLayer = getLayer(edge.fromFile);
        const toLayer = getLayer(edge.toFile);
        if (!fromLayer || !toLayer)
            continue;
        for (const rule of config.rules) {
            if (rule.from !== fromLayer)
                continue;
            if (!rule.disallow.includes(toLayer))
                continue;
            violations.push({
                ruleName: rule.name,
                fromLayer,
                toLayer,
                edge,
                reason: rule.message ??
                    `${fromLayer} layer must not depend on ${toLayer} layer.`,
            });
        }
    }
    return { violations, fileToLayer };
}
function applySuppressions(opts) {
    const suppressions = opts.config.suppressions ?? [];
    const suppressed = [];
    const unsuppressed = [];
    for (const v of opts.violations) {
        const s = suppressions.find((x) => x.file === v.edge.fromFile && x.rule === v.ruleName);
        if (s)
            suppressed.push({ ...v, suppressionReason: s.reason });
        else
            unsuppressed.push(v);
    }
    const byLocation = (a, b) => a.edge.fromFile.localeCompare(b.edge.fromFile) || a.edge.line - b.edge.line;
    suppressed.sort(byLocation);
    unsuppressed.sort(byLocation);
    return { unsuppressed, suppressed };
}
