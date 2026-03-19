// SuppressionEngine.js

class SuppressionEngine {
  constructor(inlineSuppressions) {
    this.inlineSuppressions = inlineSuppressions
  }

  filter(violations) {
    return violations.filter(v => !this.isSuppressed(v))
  }

  isSuppressed(violation) {
    return this.inlineSuppressions.some(s => {
      return s.line === violation.line
    })
  }
}

module.exports = SuppressionEngine