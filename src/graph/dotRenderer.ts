import { DependencyGraph } from "./graphBuilder";

type LayerMap = Record<string, string[]>;

type GraphViolation = {
  from: string;
  to: string;
};

const LAYER_COLORS = [
  "#dbeafe", // blue
  "#fef3c7", // amber
  "#dcfce7", // green
  "#fce7f3", // pink
  "#ede9fe", // violet
  "#fee2e2", // red
  "#e0f2fe", // sky
  "#ecfccb", // lime
];

export function renderGraphAsDot(
  graph: DependencyGraph,
  layers?: LayerMap,
  violations?: GraphViolation[]
): string {
  const lines: string[] = [];
  lines.push("digraph G {");
  lines.push('  rankdir=LR;');
  lines.push('  graph [overlap=false, splines=true, bgcolor="white"];');
  lines.push(
    '  node [shape=box, style="rounded,filled", color="#475569", fontname="Arial"];'
  );
  lines.push('  edge [color="#94a3b8"];');

  const allNodes = new Set<string>();

  for (const node of graph.nodes) {
    allNodes.add(simplifyPath(node));
  }

  for (const [from, targets] of graph.adjacency) {
    const fromKey = simplifyPath(from);
    allNodes.add(fromKey);

    for (const to of targets) {
      allNodes.add(simplifyPath(to));
    }
  }

  const sortedNodes = [...allNodes].sort();
  const layerColorMap = buildLayerColorMap(layers);

  if (layers && Object.keys(layers).length > 0) {
    const groupedByLayer = new Map<string, string[]>();
    const ungrouped: string[] = [];

    for (const node of sortedNodes) {
      const layerName = matchLayer(node, layers);

      if (!layerName) {
        ungrouped.push(node);
        continue;
      }

      addToCluster(groupedByLayer, layerName, node);
    }

    const layerNames = [...groupedByLayer.keys()].sort();

    for (const layerName of layerNames) {
      const fillColor = layerColorMap.get(layerName) ?? "#f8fafc";
      const borderColor = "#94a3b8";
      const nodes = groupedByLayer.get(layerName) ?? [];

      lines.push(`  subgraph cluster_${sanitizeId(layerName)} {`);
      lines.push(`    label=${quote(layerName)};`);
      lines.push(`    color=${quote(borderColor)};`);
      lines.push('    style="rounded";');

      const subgroups = buildSubgroups(nodes, layerName);
      let subgroupIndex = 0;

      for (const [groupName, groupNodes] of subgroups) {
        lines.push(
          `    subgraph cluster_${sanitizeId(layerName)}_${subgroupIndex} {`
        );
        lines.push(`      label=${quote(groupName)};`);
        lines.push('      style="rounded,dashed";');
        lines.push('      color="#cbd5e1";');

        for (const node of groupNodes.sort()) {
          lines.push(
            `      ${quote(node)} [fillcolor=${quote(fillColor)}, label=${quote(
              node
            )}];`
          );
        }

        lines.push("    }");
        subgroupIndex += 1;
      }

      lines.push("  }");
    }

    for (const node of ungrouped.sort()) {
      lines.push(
        `  ${quote(node)} [fillcolor="#f8fafc", label=${quote(node)}];`
      );
    }
  } else {
    for (const node of sortedNodes) {
      lines.push(
        `  ${quote(node)} [fillcolor="#f8fafc", label=${quote(node)}];`
      );
    }
  }

  const violationSet = new Set<string>();
  if (violations) {
    for (const violation of violations) {
      const key = `${simplifyPath(violation.from)}=>${simplifyPath(
        violation.to
      )}`;
      violationSet.add(key);
    }
  }

  const sortedFromNodes = [...graph.adjacency.keys()].sort();
  const emittedEdges = new Set<string>();

  for (const from of sortedFromNodes) {
    const targets = [...(graph.adjacency.get(from) ?? new Set<string>())].sort();

    for (const to of targets) {
      const fromKey = simplifyPath(from);
      const toKey = simplifyPath(to);

      if (fromKey === toKey) continue;

      const edgeKey = `${fromKey}=>${toKey}`;
      if (emittedEdges.has(edgeKey)) continue;
      emittedEdges.add(edgeKey);

      if (violationSet.has(edgeKey)) {
        lines.push(
          `  ${quote(fromKey)} -> ${quote(
            toKey
          )} [color="red", penwidth=2.5];`
        );
      } else {
        lines.push(`  ${quote(fromKey)} -> ${quote(toKey)};`);
      }
    }
  }

  lines.push("}");
  return lines.join("\n");
}

function buildLayerColorMap(layers?: LayerMap): Map<string, string> {
  const map = new Map<string, string>();
  if (!layers) return map;

  const layerNames = Object.keys(layers).sort();

  for (let i = 0; i < layerNames.length; i += 1) {
    map.set(layerNames[i], LAYER_COLORS[i % LAYER_COLORS.length]);
  }

  return map;
}

function buildSubgroups(
  nodes: string[],
  layerName: string
): Map<string, string[]> {
  const groups = new Map<string, string[]>();

  for (const node of nodes) {
    addToCluster(groups, inferGroupName(node, layerName), node);
  }

  return groups;
}

function inferGroupName(node: string, layerName: string): string {
  const parts = node.split("/");

  if (layerName === "server") {
    if (parts[1] === "routes") return "routes";
    if (parts[1] === "controllers") return "controllers";
    if (parts[1] === "services") return "services";
    if (parts[1] === "db") return "db";
    if (parts[1] === "middleware") return "middleware";
    if (parts[1] === "lib") return "lib";
    if (parts[1] === "types") return "types";
    if (parts[1] === "utils") return "utils";
  }

  if (layerName === "ui") {
    if (parts[2] === "app") return "app";
    if (parts[2] === "api") return "api";
    if (parts[2] === "shared") return "shared";
    if (parts[2] === "styles") return "styles";
    if (parts[2] === "features") {
      return parts[3] ? `feature:${parts[3]}` : "features";
    }
  }

  if (layerName === "shared") {
    return "shared";
  }

  return "other";
}

function addToCluster(
  map: Map<string, string[]>,
  key: string,
  value: string
): void {
  if (!map.has(key)) {
    map.set(key, []);
  }

  map.get(key)!.push(value);
}

function matchLayer(file: string, layers: LayerMap): string | null {
  for (const [layerName, patterns] of Object.entries(layers)) {
    for (const pattern of patterns) {
      const normalized = pattern.replace(/\/\*\*$/, "").replace(/\*$/, "");
      if (normalized && file.startsWith(normalized)) {
        return layerName;
      }
    }
  }

  return null;
}

function simplifyPath(file: string): string {
  const parts = file.split("/");

  if (parts.length <= 4) return file;

  if (parts[0] === "client" && parts[1] === "src") {
    if (parts[2] === "features" && parts[3]) {
      return parts.slice(0, 4).join("/");
    }

    return parts.slice(0, 4).join("/");
  }

  if (parts[0] === "server") {
    if (parts[1] === "routes") return parts.slice(0, 2).join("/");
    if (parts[1] === "controllers") return parts.slice(0, 2).join("/");
    if (parts[1] === "services") return parts.slice(0, 2).join("/");
    if (parts[1] === "db") return parts.slice(0, 2).join("/");
    if (parts[1] === "middleware") return parts.slice(0, 2).join("/");
    if (parts[1] === "lib") return parts.slice(0, 2).join("/");
    if (parts[1] === "types") return parts.slice(0, 2).join("/");
    if (parts[1] === "utils") return parts.slice(0, 2).join("/");
  }

  return parts.slice(0, 4).join("/");
}

function sanitizeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_]/g, "_");
}

function quote(value: string): string {
  return JSON.stringify(value);
}