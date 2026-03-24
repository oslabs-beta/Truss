export class Violation {
  suppressed: boolean = false;
  expiredSuppression: boolean = false;

  constructor(
    public ruleId: string,
    public file: string,
    public line: number,
    public message: string
  ) {}
}