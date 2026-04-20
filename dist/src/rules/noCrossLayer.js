"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.matchesNoCrossLayerRule = matchesNoCrossLayerRule;
const boundaryRule_1 = require("./boundaryRule");
function matchesNoCrossLayerRule(opts) {
    return (0, boundaryRule_1.matchesBoundaryRule)(opts);
}
