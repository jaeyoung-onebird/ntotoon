import fs from 'fs/promises';
import path from 'path';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

const STORAGE_DIR = path.join(process.cwd(), 'public', 'uploads');
const USE_S3 = !!process.env.S3_BUCKET_NAME;
const CLOUDFRONT_URL = process.env.CLOUDFRONT_URL || '';

const s3 = USE_S3
  ? new S3Client({
      region: process.env.AWS_REGION || 'ap-northeast-2',
      credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
        ? { accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY }
        : undefined,
    })
  : null;

async function ensureDir(dirPath: string) {
  await fs.mkdir(dirPath, { recursive: true });
}

function detectContentType(key: string): string {
  if (key.endsWith('.jpg') || key.endsWith('.jpeg')) return 'image/jpeg';
  if (key.endsWith('.webp')) return 'image/webp';
  return 'image/png';
}

export async function uploadToS3(buffer: Buffer, key: string, contentType?: string): Promise<string> {
  const ct = contentType || detectContentType(key);
  if (USE_S3 && s3) {
    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME!,
        Key: key,
        Body: buffer,
        ContentType: ct,
      }),
    );
    const encodedKey = key.split('/').map(encodeURIComponent).join('/');
    // /cdn/ 프록시 경로 사용 (CORS/mixed-content 문제 방지)
    return `/cdn/${encodedKey}`;
  }

  // Local filesystem fallback (dev)
  const filePath = path.join(STORAGE_DIR, key);
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, buffer);
  return `/uploads/${key.split('/').map(encodeURIComponent).join('/')}`;
}

export async function downloadFromS3(key: string): Promise<Buffer> {
  // URL 인코딩된 키가 올 수 있으므로 디코딩
  const decodedKey = decodeURIComponent(key);
  if (USE_S3 && s3) {
    const response = await s3.send(
      new GetObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME!,
        Key: decodedKey,
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
  const filePath = path.join(STORAGE_DIR, decodedKey);
  return fs.readFile(filePath);
}

/** CloudFront/S3 절대 URL → /cdn/ 프록시 경로로 변환 */
export function toPublicUrl(url: string | null | undefined): string {
  if (!url) return '';
  if (url.startsWith('/')) return url; // 이미 로컬 경로
  try {
    const u = new URL(url);
    return `/cdn${u.pathname}`;
  } catch {
    return url;
  }
}

export async function getSignedDownloadUrl(key: string): Promise<string> {
  const encodedKey = key.split('/').map(encodeURIComponent).join('/');
  if (USE_S3) {
    if (CLOUDFRONT_URL) {
      return `${CLOUDFRONT_URL}/${encodedKey}`;
    }
    return `https://${process.env.S3_BUCKET_NAME}.s3.amazonaws.com/${encodedKey}`;
  }
  return `/uploads/${encodedKey}`;
}
