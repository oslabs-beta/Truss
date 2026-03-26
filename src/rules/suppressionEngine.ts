import { InlineSuppression, Violation } from "../core/types"

export class SuppressionEngine {
  constructor(
    private readonly inlineSuppressions: InlineSuppression[]
  ) {}

  filter(violations: Violation[]): Violation[] {
    return violations.filter(v => !this.isSuppressed(v))
  }

  private isSuppressed(violation: Violation): boolean {
    return this.inlineSuppressions.some(s => {
      if (s.line !== violation.line) return false

      if (s.ruleId && s.ruleId !== violation.ruleId) {
        return false
      }

      if (s.expiresAt && new Date() > s.expiresAt) {
        return false
      }

      return true
    })
  }
}