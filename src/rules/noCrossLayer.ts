// NoCrossLayerRule.js

import { Rule } from "../models/Rule";
import { Violation } from "../models/Violation";
import { RuleConfig, LayerMap } from "../models/Config";

function findLayer(filePath: string, layers: LayerMap): string | null {
  for (const [name, dir] of Object.entries(layers)) {
    if (filePath.includes(dir)) return name;
  }
  return null;
}

export function createNoCrossLayerRule(
  ruleConfig: RuleConfig,
  layers: LayerMap
): Rule {
  return new Rule(ruleConfig.id, (filePath, source) => {
    const violations: Violation[] = [];
    const fromLayer = findLayer(filePath, layers);

    source.split("\n").forEach((line, i) => {
      const match = line.match(/import .* from ['"](.*)['"]/);
      if (!match) return;

      const toLayer = findLayer(match[1], layers);

      if (
        fromLayer === ruleConfig.from &&
        toLayer === ruleConfig.to
      ) {
        violations.push(
          new Violation(
            ruleConfig.id,
            filePath,
            i + 1,
            `Layer ${ruleConfig.from} cannot import ${ruleConfig.to}`
          )
        );
      }
    });

    return violations;
  });
}