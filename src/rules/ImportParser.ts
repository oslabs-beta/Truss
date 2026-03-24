interface ImportStatement {
  source: string
  line: number
}

export function parseImports(fileContent: string): ImportStatement[] {
  const lines: string[] = fileContent.split("\n")
  const imports: ImportStatement[] = []

  lines.forEach((line: string, index: number) => {
    const match: RegExpMatchArray | null =
      line.match(/import .* from ["'](.+)["']/)

    if (match) {
      imports.push({
        source: match[1],
        line: index + 1
      })
    }
  })

  return imports
}