"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.matchesBoundaryRule = matchesBoundaryRule;
function matchesBoundaryRule(opts) {
    const { rule, fromLayer, toLayer } = opts;
    return rule.from === fromLayer && rule.disallow.includes(toLayer);
}
