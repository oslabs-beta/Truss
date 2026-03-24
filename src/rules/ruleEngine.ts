import { Rule } from "./rules";
import { Violation } from "./violation";

export interface SourceFile {
  path: string;
  content: string;
}

export function runRules(
  files: SourceFile[],
  rules: Rule[]
): Violation[] {
  const violations: Violation[] = [];

  for (const file of files) {
    for (const rule of rules) {
      violations.push(...rule.check(file.path, file.content));
    }
  }

  return violations;
}