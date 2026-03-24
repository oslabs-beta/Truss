
// Parsing inline suppressions with expiration

import { Suppression } from "../rules/suppression";

export function parseInlineSuppressions(
  filePath: string,
  source: string
): Suppression[] {
  const suppressions: Suppression[] = [];
  const lines = source.split("\n");

  lines.forEach((line, i) => {
    const match = line.match(
      /lint-disable\s+(\S+)(?:\s+expires=(\S+))?/
    );

    if (!match) return;

    suppressions.push(
      new Suppression(
        match[1],
        filePath,
        i + 1,
        match[2] ? new Date(match[2]) : null
      )
    );
  });

  return suppressions;
}