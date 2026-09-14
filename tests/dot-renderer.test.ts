import test from "node:test";
import assert from "node:assert/strict";
import { renderGraphAsDot } from "../src/graph/dotRenderer";
import type { DependencyGraph } from "../src/graph/graphBuilder";

function graph(nodes: string[], edges: [string, string[]][] = []): DependencyGraph {
  return { nodes: new Set(nodes), adjacency: new Map(edges.map(([from, to]) => [from, new Set(to)])) };
}

test("empty graphs produce valid DOT scaffolding with or without layers", () => {
  const dot = renderGraphAsDot(graph([]));
  assert.ok(dot.startsWith("digraph G {\n  rankdir=LR;"));
  assert.ok(dot.endsWith("\n}"));
  assert.doesNotMatch(dot, / -> |subgraph|label=/);
  assert.equal(renderGraphAsDot(graph([]), {}, []), dot);
});

test("nodes and edges are sorted, including isolated nodes and adjacency-only endpoints", () => {
  const first = renderGraphAsDot(graph(["z", "a"], [["c", ["b", "a"]], ["b", ["a"]]]));
  const second = renderGraphAsDot(graph(["a", "z"], [["b", ["a"]], ["c", ["a", "b"]]]));
  assert.equal(first, second);
  assert.deepEqual(first.split("\n").filter(line => line.includes("label=")),
    ["a", "b", "c", "z"].map(node => `  "${node}" [fillcolor="#f8fafc", label="${node}"];`));
  assert.deepEqual(first.split("\n").filter(line => line.includes(" -> ")), [
    '  "b" -> "a";', '  "c" -> "a";', '  "c" -> "b";',
  ]);
});

test("DOT quotes special characters in node and layer labels and sanitizes cluster IDs", () => {
  const layer = 'odd "layer"-雪';
  const node = 'odd/"quoted"\\file\n雪.ts';
  const dot = renderGraphAsDot(graph([node], [[node, ["target"]]]), { [layer]: ["odd/**"] });
  assert.ok(dot.includes(`label=${JSON.stringify(layer)};`));
  assert.ok(dot.includes(`subgraph cluster_${layer.replace(/[^a-zA-Z0-9_]/g, "_")} {`));
  assert.ok(dot.includes(`${JSON.stringify(node)} -> "target";`));
  assert.ok(dot.includes(`label=${JSON.stringify(node)}]`));
});

test("collapsed paths deduplicate edges, omit self edges and highlight normalized violations", () => {
  const a = "client/src/features/cart/a.ts";
  const b = "client/src/features/cart/b.ts";
  const target = "server/services/orders/deep/index.ts";
  const dot = renderGraphAsDot(graph([a, b], [[a, [b, target]], [b, [target, "plain.ts"]]]), undefined,
    [{ from: b, to: target }]);
  assert.deepEqual(dot.split("\n").filter(line => line.includes(" -> ")), [
    '  "client/src/features/cart" -> "server/services" [color="red", penwidth=2.5];',
    '  "client/src/features/cart" -> "plain.ts";',
  ]);
  assert.equal(dot.split('label="client/src/features/cart"').length - 1, 1);
});

test("server and UI paths receive their documented subgroups, with unmatched nodes left outside", () => {
  const serverGroups = ["routes", "controllers", "services", "db", "middleware", "lib", "types", "utils"];
  const uiGroups = ["app", "api", "shared", "styles", "features"];
  const nodes = [
    ...serverGroups.map(group => `server/${group}/deep/nested/file.ts`),
    ...uiGroups.map(group => `client/src/${group}`),
    "client/src/features/cart/deep/file.ts", "client/src/app/deep/file.ts",
    "server/custom/deep/nested/file.ts", "client/src/misc/file.ts", "shared/a.ts", "loose.ts",
  ];
  const layers = { server: ["server/**"], ui: ["client/src/*"], shared: ["shared/**"], ignored: ["*"] };
  const dot = renderGraphAsDot(graph(nodes), layers);
  for (const group of [...serverGroups, ...uiGroups, "feature:cart", "other"]) {
    assert.ok(dot.includes(`label="${group}";`), group);
  }
  for (const group of serverGroups) assert.ok(dot.includes(`label="server/${group}"]`));
  assert.ok(dot.includes('"loose.ts" [fillcolor="#f8fafc", label="loose.ts"]'));
  assert.doesNotMatch(dot, /cluster_ignored/);
  assert.equal(dot, renderGraphAsDot(graph([...nodes].reverse()), layers));
});

test("overlapping prefixes use the first matching layer and colors follow sorted layer names", () => {
  const dot = renderGraphAsDot(graph(["src/a.ts", "src/b.ts"]), { zebra: ["missing/**", "src/**"], alpha: ["src/**"] });
  assert.match(dot, /subgraph cluster_zebra/);
  assert.doesNotMatch(dot, /subgraph cluster_alpha/);
  assert.equal((dot.match(/fillcolor="#fef3c7"/g) ?? []).length, 2);
});
