import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

let client: S3Client | null = null;

function getClient() {
  if (!client) {
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const endpoint = process.env.R2_ENDPOINT;
    if (!accountId || !accessKeyId || !secretAccessKey || !endpoint) {
      throw new Error("R2 environment variables are not fully set");
    }
    client = new S3Client({
      region: "auto",
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
    });
  }
  return client;
}

function bucketName() {
  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket) {
    throw new Error("R2_BUCKET_NAME is not set");
  }
  return bucket;
}

// Presigned URL the browser uploads the original file to directly. The
// server never sees the file bytes, so there is no body-size limit and no
// chance of the original being touched, let alone compressed, on the way in.
export async function createUploadUrl(key: string, contentType: string) {
  const command = new PutObjectCommand({
    Bucket: bucketName(),
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(getClient(), command, { expiresIn: 60 * 15 });
}

// For displaying the original inline (gallery grid, video playback).
export async function createViewUrl(key: string) {
  const command = new GetObjectCommand({ Bucket: bucketName(), Key: key });
  return getSignedUrl(getClient(), command, { expiresIn: 60 * 60 });
}

// Forces a real download of the untouched original with its original
// filename, rather than the browser just opening it inline.
export async function createDownloadUrl(key: string, filename: string, contentType: string) {
  const safeName = filename.replace(/["\r\n]/g, "_");
  const command = new GetObjectCommand({
    Bucket: bucketName(),
    Key: key,
    ResponseContentDisposition: `attachment; filename="${safeName}"`,
    ResponseContentType: contentType,
  });
  return getSignedUrl(getClient(), command, { expiresIn: 60 * 60 });
}
