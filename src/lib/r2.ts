import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

let client: S3Client | null = null;

// The R2 variables were originally entered in lowercase in Vercel, so both
// cases are checked here rather than requiring them to be renamed.
function env(upper: string, lower: string): string | undefined {
  return process.env[upper] ?? process.env[lower];
}

function getClient() {
  if (!client) {
    const accountId = env("R2_ACCOUNT_ID", "r2_account_id");
    const accessKeyId = env("R2_ACCESS_KEY_ID", "r2_access_key_id");
    const secretAccessKey = env("R2_SECRET_ACCESS_KEY", "r2_secret_access_key");
    const endpoint = env("R2_ENDPOINT", "r2_endpoint");
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
  const bucket = env("R2_BUCKET_NAME", "r2_bucket_name");
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

// For displaying the original inline: the gallery grid, the lightbox, and
// (via press-and-hold / right-click "save image") the actual save/download
// path itself, rather than a separate forced-attachment link.
export async function createViewUrl(key: string) {
  const command = new GetObjectCommand({ Bucket: bucketName(), Key: key });
  return getSignedUrl(getClient(), command, { expiresIn: 60 * 60 });
}

// Used by admin gallery moderation when permanently removing media.
export async function deleteObject(key: string) {
  await getClient().send(new DeleteObjectCommand({ Bucket: bucketName(), Key: key }));
}
