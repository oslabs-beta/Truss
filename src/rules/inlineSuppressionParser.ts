// InlineSuppressionParser.js

export interface InlineSuppression {
  line: number
}

export function parseInlineSuppressions(fileContent: string): InlineSuppression[] {
  const lines: string[] = fileContent.split("\n")
  const suppressions: InlineSuppression[] = []

  for (let i = 0; i < lines.length; i++) {
    const line: string = lines[i].trim()

    if (line.startsWith("// truss-ignore")) {
      suppressions.push({
        line: i + 2 // next line (1-based)
      })
    }
  }

  return suppressions
}