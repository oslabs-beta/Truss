import { runEngine } from "../rules/engine"

const filePath = "src/api/user.ts"

const fileContent = `
// truss-ignore
import { repo } from "../db/userRepo"

import { helper } from "../service/helper"
`

const result = runEngine(filePath, fileContent)

console.log(JSON.stringify(result, null, 2))