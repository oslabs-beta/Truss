import * as fs from "node:fs";
import * as path from "node:path";
import { FileScanError } from "../utils/errors";
import { logger } from "../utils/logger";
import { isIgnoredPath } from "../utils/pathResolver";

const DEFAULT_IGNORES = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "out",
  ".next",
  ".turbo",
  "coverage",
  ".cache",
  ".yarn",
]);

const EXT_OK = new Set([".ts", ".tsx", ".js", ".jsx"]);

export function discoverSourceFiles(opts: {
  repoRoot: string;
  extraIgnores?: string[];
}): string[] {
  // Resolves the root once so every discovered file can be normalized the same way.
  const repoRoot = path.resolve(opts.repoRoot);
  logger.debug(`Scanning source files under: ${repoRoot}`);

  // Combines built-in ignores with any repo-specific ignores from config.
  const ignore = new Set(DEFAULT_IGNORES);
  for (const i of opts.extraIgnores ?? []) ignore.add(i);

  logger.debug(`Using ignore rules: ${Array.from(ignore).join(", ")}`);

  const results: string[] = [];

  // Walks the directory tree depth-first and collects files with supported source extensions.
  function walk(dirAbs: string): void {
    let entries;

    try {
      entries = fs.readdirSync(dirAbs, { withFileTypes: true });
    } catch {
      logger.error(`Failed to read directory: ${dirAbs}`);
      throw new FileScanError(`Failed to read directory: ${dirAbs}`);
    }

   for (const ent of entries) {
  const abs = path.join(dirAbs, ent.name);
  const rel = path.relative(repoRoot, abs);

  // Skip ignored files and directories before doing any deeper work.
  if (isIgnoredPath(rel, ignore)) continue;

  if (ent.isDirectory()) {
    walk(abs);
    continue;
  }

  if (!ent.isFile()) continue;
  if (!EXT_OK.has(path.extname(ent.name))) continue;

  results.push(rel.split(path.sep).join("/"));
}
  }

  walk(repoRoot);
  // Sorting guarantees deterministic file order for downstream analysis and snapshots.
  results.sort();
  logger.debug(`Discovered ${results.length} source files`);
  return results;
}
