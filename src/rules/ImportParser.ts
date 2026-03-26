import { ImportStatement } from "../core/types"

export function parseImports(fileContent: string): ImportStatement[] {
  const lines = fileContent.split("\n")
  const imports: ImportStatement[] = []

  lines.forEach((line, index) => {
    const match = line.match(/import .* from ["'](.+)["']/)

    if (match) {
      imports.push({
        source: match[1],
        line: index + 1
      })
    }
  })

  return imports
}