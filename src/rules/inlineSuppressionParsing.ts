// InlineSuppressionParser.js

function parseInlineSuppressions(fileContent) {
  const lines = fileContent.split("\n")
  const suppressions = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()

    if (line.startsWith("// truss-ignore")) {
      // Suppress next line
      suppressions.push({
        line: i + 2 // next line (1-based)
      })
    }
  }

  return suppressions
}

module.exports = { parseInlineSuppressions }