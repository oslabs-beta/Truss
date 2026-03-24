// NoCrossLayerRule.js


import Rule, { EvaluationContext } from "./rules"
import { Violation } from "../core/types"

interface NoCrossLayerConfig {
  id: string
  type: "no-cross-layer"
  from: string
  to: string
}

export default class NoCrossLayerRule extends Rule {
  from: string
  to: string

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
        violations.push(
          new Violation({
            ruleId: this.id,
            message: `Layer "${this.from}" cannot import "${this.to}"`,
            file: filePath,
            line: imp.line,
            fromLayer,
            toLayer
          })
        )
      }
    }

    return violations
  }
}