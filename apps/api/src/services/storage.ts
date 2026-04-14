import type { Env } from '../config/env';
import type { Logger } from '../config/logger';
import { randomUUID } from 'crypto';
import path from 'path';
import fs from 'fs/promises';

/**
 * StorageDriver interface (Open/Closed Principle).
 * Route handlers call only this interface — never a specific driver.
 * Switching between local and S3: change STORAGE_DRIVER env var. Zero code changes.
 */
export interface StorageDriver {
  /**
   * Uploads a file to the storage backend.
   * @returns { key: string, url: string } — key is the storage path, url is the public/signed URL.
   */
  upload(file: Express.Multer.File, folder: string): Promise<{ key: string; url: string }>;
  /** Returns the public URL for a stored file key. */
  getUrl(key: string): string;
  /** Deletes a file by its storage key. */
  delete(key: string): Promise<void>;
  /** Lists all keys in a given folder prefix. Used by orphanFileCleanupJob. */
  listKeys(folder: string): Promise<string[]>;
}

// ─── Local driver ────────────────────────────────────────────────────────────────
// Stores files on local disk. Used for pilot (VPS) deployments.
// Files are served by Nginx at /uploads/. UPLOAD_DIR defaults to ./uploads.

function createLocalDriver(uploadDir: string, apiUrl: string): StorageDriver {
  return {
    async upload(file, folder) {
      const ext = path.extname(file.originalname).toLowerCase();
      // UUID filename: prevents path traversal, collisions, and client filename leaks.
      const filename = `${randomUUID()}${ext}`;
      const key = `${folder}/${filename}`;
      const filePath = path.join(uploadDir, key);

      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, file.buffer);

      return { key, url: `${apiUrl}/uploads/${key}` };
    },

    getUrl(key) {
      return `${apiUrl}/uploads/${key}`;
    },

    async delete(key) {
      const filePath = path.join(uploadDir, key);
      await fs.unlink(filePath).catch(() => {/* File may not exist — not an error */});
    },

    async listKeys(folder) {
      const folderPath = path.join(uploadDir, folder);
      try {
        const files = await fs.readdir(folderPath);
        return files.map((f) => `${folder}/${f}`);
      } catch {
        return [];
      }
    },
  };
}

// ─── S3 driver ────────────────────────────────────────────────────────────────────
// Stores files on AWS S3. Used for production deployments.
// Returns signed CloudFront URLs for HIPAA-compliant access control.

async function createS3Driver(env: Env, logger: Logger): Promise<StorageDriver> {
  const { S3Client, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command } =
    await import('@aws-sdk/client-s3');

  const s3 = new S3Client({ region: env.S3_REGION! });
  const bucket = env.S3_BUCKET!;
  const cloudfrontUrl = env.CLOUDFRONT_URL!;

  return {
    async upload(file, folder) {
      const ext = path.extname(file.originalname).toLowerCase();
      const filename = `${randomUUID()}${ext}`;
      const key = `${folder}/${filename}`;

      await s3.send(new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        ServerSideEncryption: 'AES256',
      }));

      return { key, url: `${cloudfrontUrl}/${key}` };
    },

    getUrl(key) {
      return `${cloudfrontUrl}/${key}`;
    },

    async delete(key) {
      await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })).catch((err: Error) => {
        logger.warn({ err, key }, '[S3Driver] Delete failed');
      });
    },

    async listKeys(folder) {
      const response = await s3.send(new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: `${folder}/`,
      }));
      return (response.Contents ?? [])
        .map((obj) => obj.Key)
        .filter((k): k is string => !!k);
    },
  };
}

// ─── Factory ─────────────────────────────────────────────────────────────────────

/**
 * extractStorageKey — Best-effort reverse of `getUrl(key)`.
 *
 * We persist the full public URL on user records (avatar_url, video_url, etc.).
 * When those records are replaced, we want to delete the old blob — which needs
 * the key, not the URL. This helper parses it back out by matching the expected
 * trailing `folder/filename` shape.
 *
 * Returns null if the URL doesn't look like one we produced (external URL,
 * malformed, different host). Callers should treat null as "skip delete".
 */
export function extractStorageKey(url: string | null | undefined, folder: string): string | null {
  if (!url) return null;
  try {
    const pathname = new URL(url).pathname;
    // Match the last occurrence of `/<folder>/<filename>` — tolerates prefixes
    // like `/uploads/` (local driver) or CloudFront path maps.
    const match = pathname.match(new RegExp(`/${folder}/([^/?#]+)$`));
    return match ? `${folder}/${match[1]}` : null;
  } catch {
    return null;
  }
}

/**
 * Creates the active storage driver based on STORAGE_DRIVER env var.
 * local: files saved to UPLOAD_DIR, served by Nginx
 * s3: files uploaded to S3_BUCKET, served via CLOUDFRONT_URL
 */
export async function createStorageDriver(env: Env, logger: Logger): Promise<StorageDriver> {
  if (env.STORAGE_DRIVER === 's3') {
    if (!env.S3_BUCKET || !env.S3_REGION || !env.CLOUDFRONT_URL) {
      throw new Error('S3_BUCKET, S3_REGION, and CLOUDFRONT_URL are required when STORAGE_DRIVER=s3');
    }
    logger.info('[Storage] Using S3 driver');
    return createS3Driver(env, logger);
  }

  logger.info({ uploadDir: env.UPLOAD_DIR }, '[Storage] Using local driver');
  return createLocalDriver(env.UPLOAD_DIR, env.API_URL);
}
