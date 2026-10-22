import { Router } from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import path from 'node:path';
import { DocumentController } from './document.controller.js';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { config } from '../../config/index.js';

// Configure private staging storage for incoming uploads
const uploadStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, config.storage.tempDir);
  },
  filename: (_req, file, cb) => {
    // Generate an unguessable random temporary filename
    const randomName = `upload_${Date.now()}_${crypto.randomBytes(16).toString('hex')}${path.extname(file.originalname)}`;
    cb(null, randomName);
  },
});

const upload = multer({
  storage: uploadStorage,
  limits: {
    fileSize: config.storage.maxFileSizeBytes,
    files: 1,
  },
});

const router = Router();

// All document operations require strict authentication
router.use(requireAuth);

router.post('/', upload.single('file'), DocumentController.create);
router.get('/:id', DocumentController.getById);
router.get('/:id/download', DocumentController.download);
router.post('/:id/versions', upload.single('file'), DocumentController.createVersion);
router.patch('/:id', DocumentController.update);
router.delete('/:id', DocumentController.delete);
router.post('/:id/recover', DocumentController.recover);

export const documentRoutes = router;
