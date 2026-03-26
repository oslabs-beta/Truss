import { parseImports } from "./ImportParser"
import { parseInlineSuppressions } from "./inlineSuppressionParser"
import { SuppressionEngine } from "./SuppressionEngine"
import { NoCrossLayerRule } from "./noCrossLayer"
import { Violation } from "../core/types"

function getLayerFromPath(path: string): string {
  if (path.includes("api")) return "api"
  if (path.includes("db")) return "db"
  if (path.includes("service")) return "service"
  return "unknown"
}

export function runEngine(
  filePath: string,
  fileContent: string
): Violation[] {
  const imports = parseImports(fileContent)
  const inlineSuppressions = parseInlineSuppressions(fileContent)

  const rules = [
    new NoCrossLayerRule({
      id: "no-cross-layer",
      from: "api",
      to: "db"
    })
  ]

  let violations: Violation[] = []

  for (const rule of rules) {
    violations = violations.concat(
      rule.evaluate({
        filePath,
        imports,
        getLayerFromPath
      })
    )
  }

  const suppressionEngine = new SuppressionEngine(inlineSuppressions)

  return suppressionEngine.filter(violations)
}