import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { isIgnoredPath, resolveImportToFile, toRepoRelativePosix } from "../src/utils/pathResolver";
import { logger } from "../src/utils/logger";

for (const [pattern, matches, nonMatches] of [
  ["generated/**", ["generated", "generated/a.ts", "generated/nested/a.ts"], ["generated-other/a.ts", "src/generated/a.ts"]],
  ["node_modules", ["node_modules", "node_modules/pkg/a.ts", "packages/app/node_modules/pkg/a.ts"], ["src/node_modules-helper/a.ts"]],
  ["**/*.test.ts", ["a.test.ts", "src/a.test.ts"], ["src/a.ts", "src/a.test.tsx"]],
  ["**/*.spec.ts", ["a.spec.ts", "src/a.spec.ts"], ["src/a.ts", "src/a.spec.tsx"]],
] as const) {
  test(`ignore pattern ${pattern} matches paths without hiding similarly named source files`, () => {
    for (const file of matches) assert.equal(isIgnoredPath(file, new Set([pattern])), true, file);
    for (const file of nonMatches) assert.equal(isIgnoredPath(file, new Set([pattern])), false, file);
  });
}

test("local resolution honors root-relative imports, extension precedence and directory indexes", (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "truss-resolver-test-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const repo = path.join(dir, "repo");
  fs.mkdirSync(path.join(repo, "src/module"), { recursive: true });
  for (const file of ["src/choice.ts", "src/choice.js", "src/module/index.tsx", "src/exact.mjs"]) {
    fs.writeFileSync(path.join(repo, file), "export {};\n");
  }
  fs.writeFileSync(path.join(dir, "outside.ts"), "export {};\n");
  assert.equal(resolveImportToFile(repo, "src/app.ts", "./choice"), "src/choice.ts");
  assert.equal(resolveImportToFile(repo, "src/app.ts", "./choice.js"), "src/choice.js");
  assert.equal(resolveImportToFile(repo, "src/app.ts", "./module"), "src/module/index.tsx");
  assert.equal(resolveImportToFile(repo, "src/nested/app.ts", "/src/exact.mjs"), "src/exact.mjs");
  assert.equal(resolveImportToFile(repo, "src/app.ts", "react"), null);
  assert.equal(resolveImportToFile(repo, "src/app.ts", "./missing"), null);
  assert.equal(resolveImportToFile(repo, "src/app.ts", "../../outside.ts"), null);
  assert.equal(toRepoRelativePosix(repo, path.join(dir, "outside.ts")), null);
  assert.equal(toRepoRelativePosix(repo, path.join(repo, "src/choice.ts")), "src/choice.ts");
});

for (const debug of [undefined, "false", "1", "true"]) {
  test(`logger respects DEBUG=${debug} and uses the appropriate console channel`, (t) => {
    const original = process.env.DEBUG;
    t.after(() => { if (original === undefined) delete process.env.DEBUG; else process.env.DEBUG = original; });
    if (debug === undefined) delete process.env.DEBUG; else process.env.DEBUG = debug;
    const calls: Array<[string, string]> = [];
    for (const method of ["log", "warn", "error", "debug"] as const) {
      t.mock.method(console, method, (message: string) => { calls.push([method, message]); });
    }
    logger.info("information");
    logger.warn("warning");
    logger.error("failure");
    logger.debug("details");
    assert.deepEqual(calls, debug === "true" ? [
      ["log", "information"], ["warn", "warning"], ["error", "failure"], ["debug", "details"],
    ] : []);
  });
}
