import { Suppression } from "../rules/suppression";
import { Rule } from "../rules/rules";

export function detectUnusedSuppressions(
  suppressions: Suppression[]
): Suppression[] {
  return suppressions.filter(s => !s.used);
}

export function detectInvalidSuppressions(
  suppressions: Suppression[],
  rules: Rule[]
): Suppression[] {
  const ids = new Set(rules.map(r => r.id));
  return suppressions.filter(s => !ids.has(s.ruleId));
}