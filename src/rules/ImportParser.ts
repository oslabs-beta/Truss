function parseImports(fileContent) {
  const lines = fileContent.split("\n")
  const imports = []

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