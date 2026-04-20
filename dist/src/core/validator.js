"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateRules = evaluateRules;
exports.applySuppressions = applySuppressions;
const traversal_1 = require("../graph/traversal");
const minimatch_1 = require("minimatch");
function matchLayer(file, layers) {
    for (const [layerName, patterns] of Object.entries(layers)) {
        for (const pattern of patterns) {
            if ((0, minimatch_1.minimatch)(file, pattern)) {
                return layerName;
            }
        }
    }
    return null;
}
function evaluateRules(opts) {
    const { config, edges, graph } = opts;
    const directViolations = [];
    for (const edge of edges) {
        if (edge.importKind !== "internal")
            continue;
        const fromLayer = matchLayer(edge.fromFile, config.layers);
        const toLayer = matchLayer(edge.toFile, config.layers);
        if (!fromLayer || !toLayer)
            continue;
        for (const rule of config.rules) {
            if (rule.from !== fromLayer)
                continue;
            if (!rule.disallow.includes(toLayer))
                continue;
            directViolations.push({
                ruleName: rule.name,
                fromLayer,
                toLayer,
                edge,
                reason: rule.message ??
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
    const deduped = [];
    const seen = new Set();
    for (const violation of merged) {
        const edge = violation.edge;
        const key = edge.importKind === "internal"
            ? `${violation.ruleName}|${edge.fromFile}|${edge.toFile}|${violation.reason}`
            : `${violation.ruleName}|${edge.fromFile}|external|${violation.reason}`;
        if (seen.has(key))
            continue;
        seen.add(key);
        deduped.push(violation);
    }
    return { violations: deduped };
}
function applySuppressions(opts) {
    const suppressions = opts.config.suppressions ?? [];
    const suppressed = [];
    const unsuppressed = [];
    for (const v of opts.violations) {
        // match on source file + rule name
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
function buildInternalEdgeMap(edges) {
    const map = new Map();
    for (const edge of edges) {
        if (edge.importKind !== "internal")
            continue;
        if (!map.has(edge.fromFile)) {
            map.set(edge.fromFile, new Set());
        }
        map.get(edge.fromFile).add(edge.toFile);
    }
    return map;
}
function collectTransitiveViolations(opts) {
    const violations = [];
    const directEdgeMap = buildInternalEdgeMap(opts.edges);
    const seen = new Set();
    for (const [fromFile] of directEdgeMap) {
        const fromLayer = matchLayer(fromFile, opts.config.layers);
        if (!fromLayer)
            continue;
        const reachable = (0, traversal_1.getTransitiveDependencies)(opts.graph, fromFile);
        for (const toFile of reachable) {
            if (fromFile === toFile)
                continue;
            const toLayer = matchLayer(toFile, opts.config.layers);
            if (!toLayer)
                continue;
            const isDirect = directEdgeMap.get(fromFile)?.has(toFile) ?? false;
            if (isDirect)
                continue;
            for (const rule of opts.config.rules) {
                if (rule.from !== fromLayer)
                    continue;
                if (!rule.disallow.includes(toLayer))
                    continue;
                const key = `${rule.name}|${fromFile}|${toFile}`;
                if (seen.has(key))
                    continue;
                const path = (0, traversal_1.findDependencyPath)(opts.graph, fromFile, toFile);
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
