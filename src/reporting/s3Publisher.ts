import * as fs from "node:fs";
import * as path from "node:path";

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

type UploadReportToS3Options = {
  reportDir: string;
  bucket: string;
  prefix?: string;
};

type UploadedArtifact = {
  fileName: string;
  key: string;
};

export async function uploadReportsToS3(
  options: UploadReportToS3Options
): Promise<UploadedArtifact[]> {
  const reportFiles = ["truss-report.json", "truss-report.html"];

  const client = new S3Client({});

  const uploaded: UploadedArtifact[] = [];

  for (const fileName of reportFiles) {
    const filePath = path.join(options.reportDir, fileName);

    if (!fs.existsSync(filePath)) {
      continue;
    }

    const key = buildS3Key(options.prefix, fileName);
    const body = fs.createReadStream(filePath);

    await client.send(
      new PutObjectCommand({
        Bucket: options.bucket,
        Key: key,
        Body: body,
        ContentType: getContentType(fileName),
      })
    );

    uploaded.push({
      fileName,
      key,
    });
  }

  return uploaded;
}

function buildS3Key(prefix: string | undefined, fileName: string): string {
  const cleanPrefix = prefix?.replace(/^\/+|\/+$/g, "");

  if (!cleanPrefix) {
    return fileName;
  }

  return `${cleanPrefix}/${fileName}`;
}

function getContentType(fileName: string): string {
  if (fileName.endsWith(".html")) {
    return "text/html; charset=utf-8";
  }

  if (fileName.endsWith(".json")) {
    return "application/json";
  }

  return "application/octet-stream";
}