// InlineSuppressionParser.js

import { InlineSuppression } from "../core/types"

const IGNORE_REGEX =
  /^\/\/\s*truss-ignore(?:\s+([a-zA-Z0-9-_]+))?(?:\s+until=([\d-]+))?/

export function parseInlineSuppressions(
  fileContent: string
): InlineSuppression[] {
  const lines = fileContent.split("\n")
  const suppressions: InlineSuppression[] = []

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].trim().match(IGNORE_REGEX)

    if (!match) continue

    const [, ruleId, until] = match

    suppressions.push({
      line: i + 2,
      ruleId: ruleId || undefined,
      expiresAt: until ? new Date(until) : undefined
    })
  }

  return suppressions
}
