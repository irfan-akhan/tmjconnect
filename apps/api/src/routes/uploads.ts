import { Router } from 'express';
import multer from 'multer';
import type { Request, Response, NextFunction } from 'express';
import type { Container } from '../config/container';
import { authenticate, authorize, authorizeAny } from '../middleware/auth';
import { auditLog } from '../middleware/audit';
import { AppError } from '../middleware/errorHandler';
import {
  MAX_VIDEO_SIZE_BYTES,
  MAX_AVATAR_SIZE_BYTES,
  MAX_REPORT_PHOTO_SIZE_BYTES,
  MAX_THUMBNAIL_SIZE_BYTES,
  ALLOWED_VIDEO_MIMES,
  ALLOWED_IMAGE_MIMES,
} from '../config/constants';

// ─── Magic byte signatures ───────────────────────────────────────────────────────
const SIGNATURES: Record<string, { bytes: number[]; offset: number }[]> = {
  'video/mp4': [
    { bytes: [0x66, 0x74, 0x79, 0x70], offset: 4 }, // ftyp at offset 4
  ],
  'video/quicktime': [
    { bytes: [0x66, 0x74, 0x79, 0x70], offset: 4 }, // also ftyp
  ],
  'image/jpeg': [
    { bytes: [0xff, 0xd8, 0xff], offset: 0 },
  ],
  'image/png': [
    { bytes: [0x89, 0x50, 0x4e, 0x47], offset: 0 }, // .PNG
  ],
};

function validateMagicBytes(buffer: Buffer, allowedMimes: readonly string[]): boolean {
  for (const mime of allowedMimes) {
    const sigs = SIGNATURES[mime];
    if (!sigs) continue;
    for (const sig of sigs) {
      if (buffer.length < sig.offset + sig.bytes.length) continue;
      const match = sig.bytes.every((b, i) => buffer[sig.offset + i] === b);
      if (match) return true;
    }
  }
  return false;
}

function createUpload(maxSize: number, allowedMimes: readonly string[]) {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxSize },
    fileFilter: (_req, file, cb) => {
      if (!allowedMimes.includes(file.mimetype)) {
        cb(new AppError(400, 'INVALID_FILE_TYPE', `Allowed types: ${allowedMimes.join(', ')}`));
        return;
      }
      cb(null, true);
    },
  });
}

function uploadHandler(
  container: Container,
  folder: string,
  allowedMimes: readonly string[],
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) throw new AppError(400, 'MISSING_FILE', 'No file provided.');
      if (!validateMagicBytes(req.file.buffer, allowedMimes)) {
        throw new AppError(400, 'INVALID_FILE_TYPE', 'File content does not match an allowed format.');
      }
      const result = await container.storage.upload(req.file, folder);
      res.status(201).json({ data: result });
    } catch (err) { next(err); }
  };
}

export function uploadsRouter(container: Container) {
  const router = Router();
  router.use(authenticate);

  const videoUpload = createUpload(MAX_VIDEO_SIZE_BYTES, ALLOWED_VIDEO_MIMES);
  const avatarUpload = createUpload(MAX_AVATAR_SIZE_BYTES, ALLOWED_IMAGE_MIMES);
  const reportPhotoUpload = createUpload(MAX_REPORT_PHOTO_SIZE_BYTES, ALLOWED_IMAGE_MIMES);
  const thumbnailUpload = createUpload(MAX_THUMBNAIL_SIZE_BYTES, ALLOWED_IMAGE_MIMES);

  router.post('/video', authorizeAny('provider', 'admin'), videoUpload.single('file'), auditLog('video_uploaded', 'exercise'), uploadHandler(container, 'videos', ALLOWED_VIDEO_MIMES));
  router.post('/thumbnail', authorizeAny('provider', 'admin'), thumbnailUpload.single('file'), auditLog('thumbnail_uploaded', 'exercise'), uploadHandler(container, 'thumbnails', ALLOWED_IMAGE_MIMES));
  router.post('/avatar', avatarUpload.single('file'), auditLog('avatar_uploaded', 'user'), uploadHandler(container, 'avatars', ALLOWED_IMAGE_MIMES));
  router.post('/report-photo', reportPhotoUpload.single('file'), auditLog('report_photo_uploaded', 'report'), uploadHandler(container, 'report-photos', ALLOWED_IMAGE_MIMES));

  return router;
}
