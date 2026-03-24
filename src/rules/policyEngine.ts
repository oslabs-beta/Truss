import { Violation } from "../rules/violation";
import { Suppression } from "../rules/suppression";
import { PolicyConfig } from "../rules/policyConfig";




export function enforcePolicies(
  violations: Violation[],
  suppressions: Suppression[],
  config: PolicyConfig
) {
  if (config.maxSuppressions &&
      suppressions.length > config.maxSuppressions) {
    throw new Error("Too many suppressions");
  }

  if (config.failOnSuppressed) {
    const suppressed = violations.filter(v => v.suppressed);
    if (suppressed.length > 0) {
      throw new Error("Suppressed violations present");
    }
  }
}