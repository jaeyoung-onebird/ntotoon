import fs from 'fs/promises';
import path from 'path';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

const STORAGE_DIR = path.join(process.cwd(), 'public', 'uploads');
const USE_S3 = !!process.env.S3_BUCKET_NAME;

const s3 = USE_S3
  ? new S3Client({ region: process.env.AWS_REGION || 'ap-northeast-2' })
  : null;

async function ensureDir(dirPath: string) {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function uploadToS3(buffer: Buffer, key: string, contentType = 'image/png'): Promise<string> {
  if (USE_S3 && s3) {
    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME!,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    );
    return `https://${process.env.S3_BUCKET_NAME}.s3.amazonaws.com/${key}`;
  }

  // Local filesystem fallback (dev)
  const filePath = path.join(STORAGE_DIR, key);
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, buffer);
  return `/uploads/${key}`;
}

export async function downloadFromS3(key: string): Promise<Buffer> {
  if (USE_S3 && s3) {
    const response = await s3.send(
      new GetObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME!,
        Key: key,
      }),
    );
    const stream = response.Body;
    if (!stream) throw new Error(`Empty response for key: ${key}`);
    const chunks: Uint8Array[] = [];
    for await (const chunk of stream as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  // Local filesystem fallback (dev)
  const filePath = path.join(STORAGE_DIR, key);
  return fs.readFile(filePath);
}

export async function getSignedDownloadUrl(key: string): Promise<string> {
  if (USE_S3) {
    return `https://${process.env.S3_BUCKET_NAME}.s3.amazonaws.com/${key}`;
  }
  return `/uploads/${key}`;
}
