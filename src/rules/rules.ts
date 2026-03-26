

import { EvaluationContext, Violation } from "../core/types"

export interface RuleConfig {
  id: string
}

export abstract class Rule {
  public readonly id: string

  constructor(config: RuleConfig) {
    this.id = config.id
  }

  abstract evaluate(context: EvaluationContext): Violation[]
}