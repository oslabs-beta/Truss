// NoCrossLayerRule.js


const Rule = require("./Rule")
const { Violation } = require("./types")

class NoCrossLayerRule extends Rule {
  constructor(config) {
    super(config)
    this.from = config.from
    this.to = config.to
  }

  evaluate(context) {
    const { filePath, imports, getLayerFromPath } = context
    const violations = []

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

module.exports = NoCrossLayerRule;