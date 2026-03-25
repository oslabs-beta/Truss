import { GraphNode } from "./graphNode";

type Color = "white" | "gray" | "black";

export function detectCycles(nodes: Map<string, GraphNode>): string[][] {
  const color = new Map<string, Color>();
  const cycles: string[][] = [];

  for (const file of nodes.keys()) color.set(file, "white");

  function dfs(file: string, stack: string[]): void {
    color.set(file, "gray");
    stack.push(file);

    const node = nodes.get(file);
    if (!node) {
      stack.pop();
      color.set(file, "black");
      return;
    }

    const sorted = [...node.outgoing].sort((a, b) =>
      a.to.file.localeCompare(b.to.file),
    );

    for (const edge of sorted) {
      const target = edge.to.file;
      if (color.get(target) === "gray") {
        // gray = currently on the stack, so this is a back edge
        const cycleStart = stack.indexOf(target);
        cycles.push([...stack.slice(cycleStart), target]);
      } else if (color.get(target) === "white") {
        dfs(target, stack);
      }
    }

    stack.pop();
    color.set(file, "black");
  }

  for (const file of [...nodes.keys()].sort()) {
    if (color.get(file) === "white") {
      dfs(file, []);
    }
  }

  return cycles;
}
