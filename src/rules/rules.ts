// Rule.js

export type RuleCheckFn = (
  filePath: string,
  source: string
) => Violation[];

export class Rule {
  constructor(
    public id: string,
    public check: RuleCheckFn
  ) {}
}