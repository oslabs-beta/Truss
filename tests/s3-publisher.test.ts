import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { Readable } from "node:stream";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { uploadReportsToS3 } from "../src/reporting/s3Publisher";

function directory(t: TestContext): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "truss-s3-test-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

for (const prefix of [undefined, "///", "/reports/build-1/"]) {
  test(`publisher sends report bytes and content types with prefix ${JSON.stringify(prefix)}`, async (t) => {
    const dir = directory(t);
    fs.writeFileSync(path.join(dir, "truss-report.json"), '{"label":"雪"}');
    fs.writeFileSync(path.join(dir, "truss-report.html"), "<!DOCTYPE html><h1>雪</h1>");
    fs.writeFileSync(path.join(dir, "unrelated.txt"), "do not upload");
    const requests: Array<{ bucket?: string; key?: string; contentType?: string; body: string }> = [];
    t.mock.method(S3Client.prototype, "send", async (command: PutObjectCommand) => {
      assert.ok(command instanceof PutObjectCommand);
      const chunks: Buffer[] = [];
      for await (const chunk of command.input.Body as Readable) chunks.push(Buffer.from(chunk));
      requests.push({ bucket: command.input.Bucket, key: command.input.Key,
        contentType: command.input.ContentType, body: Buffer.concat(chunks).toString("utf8") });
      return {};
    });
    const uploaded = await uploadReportsToS3({ reportDir: dir, bucket: "test-bucket", prefix });
    const base = prefix === "/reports/build-1/" ? "reports/build-1/" : "";
    assert.deepEqual(requests, [
      { bucket: "test-bucket", key: `${base}truss-report.json`, contentType: "application/json", body: '{"label":"雪"}' },
      { bucket: "test-bucket", key: `${base}truss-report.html`, contentType: "text/html; charset=utf-8", body: "<!DOCTYPE html><h1>雪</h1>" },
    ]);
    assert.deepEqual(uploaded, [
      { fileName: "truss-report.json", key: `${base}truss-report.json` },
      { fileName: "truss-report.html", key: `${base}truss-report.html` },
    ]);
  });
}

test("publisher skips missing artifacts, including an entirely empty directory", async (t) => {
  const dir = directory(t);
  const send = t.mock.method(S3Client.prototype, "send", async (command: PutObjectCommand) => {
    for await (const chunk of command.input.Body as Readable) { /* Consume the upload stream. */ }
    return {};
  });
  assert.deepEqual(await uploadReportsToS3({ reportDir: dir, bucket: "test" }), []);
  assert.equal(send.mock.callCount(), 0);
  fs.writeFileSync(path.join(dir, "truss-report.html"), "report");
  assert.deepEqual(await uploadReportsToS3({ reportDir: dir, bucket: "test" }), [
    { fileName: "truss-report.html", key: "truss-report.html" },
  ]);
  assert.equal(send.mock.callCount(), 1);
});

test("publisher propagates an upload failure and stops before the next artifact", async (t) => {
  const dir = directory(t);
  for (const ext of ["json", "html"]) fs.writeFileSync(path.join(dir, `truss-report.${ext}`), "report");
  const failure = new Error("upload rejected");
  const send = t.mock.method(S3Client.prototype, "send", async (command: PutObjectCommand) => {
    for await (const chunk of command.input.Body as Readable) { /* Consume the upload stream. */ }
    throw failure;
  });
  await assert.rejects(uploadReportsToS3({ reportDir: dir, bucket: "test" }), error => error === failure);
  assert.equal(send.mock.callCount(), 1);
});
