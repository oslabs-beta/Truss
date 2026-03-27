import test from "node:test";
import assert from "node:assert/strict";
import * as path from "node:path";

import { buildDependencyEdges } from "../src/graph/dependencyGraph";
import type { DependencyEdge } from "../src/core/types";

const packageRoot = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  "..",
);
const fixturesRoot = path.join(packageRoot, "tests", "fixtures");

function fixturePath(name: string): string {
  return path.join(fixturesRoot, name);
}

function edgeKey(edge: DependencyEdge): string {
  if (edge.importKind === "internal") {
    return `${edge.fromFile}->${edge.toFile}:${edge.line}`;
  }

  return `${edge.fromFile}->${edge.packageName}:${edge.line}`;
}

test("buildDependencyEdges prevents cycle recursion and deduplicates deterministically", () => {
  const repoRoot = fixturePath("cycle-repo");
  const files = ["src/a.ts", "src/b.ts", "src/c.ts"];
  const reversed = [...files].reverse();

  const first = buildDependencyEdges({ repoRoot, files });
  const second = buildDependencyEdges({ repoRoot, files: reversed });

  assert.strictEqual(first.parserIssues.length, 0);
  assert.strictEqual(first.edges.length, 4);
  assert.strictEqual(new Set(first.edges.map(edgeKey)).size, first.edges.length);

  assert.deepStrictEqual(
    first.edges.map(edgeKey),
    [
      "src/a.ts->src/b.ts:1",
      "src/b.ts->src/a.ts:1",
      "src/c.ts->src/a.ts:1",
      "src/c.ts->src/b.ts:2",
    ],
  );

  assert.deepStrictEqual(second.parserIssues, first.parserIssues);
  assert.deepStrictEqual(
    second.edges.map(edgeKey),
    first.edges.map(edgeKey),
  );
});
