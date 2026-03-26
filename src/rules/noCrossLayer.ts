// NoCrossLayerRule.js

import { Rule } from "./rules"
import { EvaluationContext, Violation } from "../core/types"

export interface NoCrossLayerConfig {
  id: string
  from: string
  to: string
}

export class NoCrossLayerRule extends Rule {
  private readonly from: string
  private readonly to: string

  constructor(config: NoCrossLayerConfig) {
    super(config)
    this.from = config.from
    this.to = config.to
  }

  evaluate(context: EvaluationContext): Violation[] {
    const { filePath, imports, getLayerFromPath } = context
    const violations: Violation[] = []

    const fromLayer = getLayerFromPath(filePath)

    for (const imp of imports) {
      const toLayer = getLayerFromPath(imp.source)

      if (fromLayer === this.from && toLayer === this.to) {
        violations.push({
          ruleId: this.id,
          message: `Layer "${this.from}" cannot import "${this.to}"`,
          file: filePath,
          line: imp.line,
          fromLayer,
          toLayer
        })
      }
    }

    return violations
  }
}