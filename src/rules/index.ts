import { loadConfig } from "../rules/yamlLoader";
import { parseInlineSuppressions } from "../rules/inlineSuppressionParser";
import { runRules } from "../rules/ruleEngine";
import { applySuppressions } from "../rules/SuppressionEngine";
import { enforcePolicies } from "../rules/policyEngine";
import { createNoCrossLayerRule } from "../rules/noCrossLayer";

export function analyze(files, yamlPath, policyConfig) {
  const arch = loadConfig(yamlPath);

  const rules = arch.rules.map(r =>
    createNoCrossLayerRule(r, arch.layers)
  );

  const suppressions = files.flatMap(f =>
    parseInlineSuppressions(f.path, f.content)
  );

  const violations = runRules(files, rules);

  applySuppressions(violations, suppressions);

  enforcePolicies(violations, suppressions, policyConfig);

  return {
    violations,
    suppressions
  };
}