// suppression/parseConfigSuppressions.js
import { Suppression } from '../core/types'

export function parseConfigSuppressions(config) {
  if (!config.suppressions) return []

  return config.suppressions.map(s => {
    const expiresAt = s.until ? new Date(s.until) : null

    return new Suppression({
      ruleId: s.rule,
      file: s.file,
      line: s.line ?? null,
      reason: s.reason,
      expiresAt,
      source: 'config'
    })
  })
}