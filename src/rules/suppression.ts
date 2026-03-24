export class Suppression {
  used: boolean = false;

  constructor(
    public ruleId: string,
    public file: string,
    public line: number,
    public expires: Date | null
  ) {}
}