// SuppressionEngine.js

import { Violation } from "./violation";
import { Suppression } from "./suppression";

export function applySuppressions(
  violations: Violation[],
  suppressions: Suppression[]
): void {
  const now = new Date();

  for (const v of violations) {
    const match = suppressions.find(
      s =>
        s.ruleId === v.ruleId &&
        s.file === v.file &&
        s.line === v.line
    );

    if (!match) continue;

    if (match.expires && match.expires < now) {
      v.expiredSuppression = true;
      continue;
    }

    v.suppressed = true;
    match.used = true;
  }
}