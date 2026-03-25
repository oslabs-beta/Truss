import * as fs from "node:fs";
import * as path from "node:path";
import { logger } from "./logger";

/**
 * File extensions we try when resolving local imports.
 */
const RESOLVABLE_EXTENSIONS = [
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mts",
  ".cts",
  ".mjs",
  ".cjs",
];

export function isIgnoredPath(rel: string, ignore: Set<string>): boolean {
  const relPosix = rel.split(path.sep).join("/");

  for (const pattern of ignore) {
    const normalized = pattern.split(path.sep).join("/");

    // tests/fixtures/**
    if (normalized.endsWith("/**")) {
      const base = normalized.slice(0, -3);
      if (relPosix === base || relPosix.startsWith(base + "/")) {
        return true;
      }
    }

    // dist, node_modules
    if (relPosix === normalized || relPosix.startsWith(normalized + "/")) {
      return true;
    }

    // **/*.test.ts
    if (normalized === "**/*.test.ts" && relPosix.endsWith(".test.ts")) {
      return true;
    }

    if (normalized === "**/*.spec.ts" && relPosix.endsWith(".spec.ts")) {
      return true;
    }
  }

  return false;
}

/**
 * Convert absolute file path to repo-relative POSIX path.
 * Returns null if file is outside the repo root.
 */
export function toRepoRelativePosix(
  repoRoot: string,
  absPath: string,
): string | null {
  const rel = path.relative(repoRoot, absPath);

  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    return null;
  }

  return rel.split(path.sep).join("/");
}

/**
 * Check if import specifier points to a local file.
 * Examples:
 * - "./x"    -> true
 * - "../x"   -> true
 * - "/src/x" -> true
 * - "react"  -> false
 */
export function isLocalSpecifier(specifier: string): boolean {
  return specifier.startsWith(".") || specifier.startsWith("/");
}

/**
 * Resolve a local import path to a repo-relative file path.
 * Returns null if:
 * - the specifier is external
 * - or the target file cannot be found
 */
export function resolveImportToFile(
  repoRoot: string,
  fromFile: string,
  specifier: string,
): string | null {
  if (!isLocalSpecifier(specifier)) {
    logger.debug(`Skipping external import "${specifier}" from "${fromFile}"`);
    return null;
  }

  const fromAbs = path.resolve(repoRoot, fromFile);
  const baseDir = path.dirname(fromAbs);

  /**
   * If specifier starts with "/":
   * treat it as repo-root-relative, for example:
   * "/src/utils/x" -> "<repoRoot>/src/utils/x"
   *
   * If specifier starts with ".":
   * treat it as file-relative, for example:
   * "../utils/x" -> relative to current file
   */
  const unresolved = specifier.startsWith("/")
    ? path.resolve(repoRoot, `.${specifier}`)
    : path.resolve(baseDir, specifier);

  logger.debug(`Base resolved path for "${specifier}": ${unresolved}`);

  const candidates: string[] = [
    unresolved,
    ...RESOLVABLE_EXTENSIONS.map((ext) => `${unresolved}${ext}`),
    ...RESOLVABLE_EXTENSIONS.map((ext) => path.join(unresolved, `index${ext}`)),
  ];

  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;
    if (!fs.statSync(candidate).isFile()) continue;

    const rel = toRepoRelativePosix(repoRoot, candidate);
    if (rel) {
      logger.debug(`Resolved "${specifier}" from "${fromFile}" to "${rel}"`);
      return rel;
    }
  }

  logger.debug(`Could not resolve "${specifier}" from "${fromFile}"`);
  return null;
}