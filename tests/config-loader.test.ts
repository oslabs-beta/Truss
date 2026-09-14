import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { loadTrussConfig } from "../src/config/configLoader";
import { ConfigError } from "../src/utils/errors";

const rule = { name: "boundary", from: "app", disallow: ["db"] };
const valid = { layers: { app: ["src/app"], db: ["src/db"] }, rules: [rule] };
const cases: Array<[string, unknown, RegExp]> = [
  ["missing layers", { rules: [] }, /"layers" must be an object/],
  ["array layers", { layers: [], rules: [] }, /"layers" must be an object/],
  ["non-list patterns", { ...valid, layers: { app: "src/app" } }, /Invalid layer "app"/],
  ["empty patterns", { ...valid, layers: { app: [] } }, /Invalid layer "app"/],
  ["non-string patterns", { ...valid, layers: { app: [42] } }, /Invalid layer "app"/],
  ["non-array rules", { ...valid, rules: {} }, /"rules" must be an array/],
  ["null rule", { ...valid, rules: [null] }, /expected an object/],
  ["scalar rule", { ...valid, rules: ["boundary"] }, /expected an object/],
  ["missing rule name", { ...valid, rules: [{ from: "app", disallow: ["db"] }] }, /missing "name"/],
  ["non-string rule name", { ...valid, rules: [{ ...rule, name: 1 }] }, /missing "name"/],
  ["missing source layer", { ...valid, rules: [{ name: "boundary", disallow: ["db"] }] }, /missing "from"/],
  ["non-string source layer", { ...valid, rules: [{ ...rule, from: 1 }] }, /missing "from"/],
  ["non-array targets", { ...valid, rules: [{ ...rule, disallow: "db" }] }, /non-empty string\[\]/],
  ["empty targets", { ...valid, rules: [{ ...rule, disallow: [] }] }, /non-empty string\[\]/],
  ["non-string targets", { ...valid, rules: [{ ...rule, disallow: [1] }] }, /non-empty string\[\]/],
  ["non-string message", { ...valid, rules: [{ ...rule, message: 42 }] }, /invalid "message"/],
  ["unknown target layer", { ...valid, rules: [{ ...rule, disallow: ["missing"] }] }, /unknown disallow layer: "missing"/],
];

for (const [name, config, message] of cases) {
  test(`configuration rejects ${name} with a labeled configuration error`, (t) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "truss-config-test-"));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    const file = path.join(dir, "custom.yml");
    fs.writeFileSync(file, JSON.stringify(config));
    assert.throws(() => loadTrussConfig(file, "custom.yml"), error => {
      assert.ok(error instanceof ConfigError);
      assert.match(error.message, message);
      assert.match(error.message, /custom.yml/);
      return true;
    });
  });
}

test("configuration normalizes directory patterns while retaining globs and optional settings", (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "truss-config-test-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, "custom.yml");
  const config = { ...valid, layers: { app: [" src/app/ ", "src/app", "src/**/*.tsx"], db: ["src/db"] },
    ignore: ["generated"], suppressions: [{ file: "src/app/a.ts", rule: "boundary", reason: "accepted" }] };
  fs.writeFileSync(file, JSON.stringify(config));
  assert.deepEqual(loadTrussConfig(file), { ...config,
    layers: { app: ["src/app/**", "src/app/**", "src/**/*.tsx"], db: ["src/db/**"] } });
});
