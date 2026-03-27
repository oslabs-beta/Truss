export type BoundaryRuleConfig = {
  name: string;
  from: string;
  disallow: string[];
  message?: string;
};

export function matchesBoundaryRule(opts: {
  rule: BoundaryRuleConfig;
  fromLayer: string;
  toLayer: string;
}): boolean {
  const { rule, fromLayer, toLayer } = opts;

  return rule.from === fromLayer && rule.disallow.includes(toLayer);
}