// Rule.js

class Rule {
  constructor(config) {
    this.id = config.id
  }

  evaluate(context) {
    throw new Error("evaluate() must be implemented")
  }
}

module.exports = Rule;