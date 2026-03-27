import { BoundaryRuleConfig, matchesBoundaryRule } from "./boundaryRule";

export type NoCrossLayerRuleConfig = BoundaryRuleConfig;

export function matchesNoCrossLayerRule(opts: {
  rule: NoCrossLayerRuleConfig;
  fromLayer: string;
  toLayer: string;
}): boolean {
  return matchesBoundaryRule(opts);
}