import { Request, Response, NextFunction } from 'express';
import { DocumentService } from './document.service.js';
import {
  CreateDocumentRequestSchema,
  UpdateDocumentRequestSchema,
  CreateVersionRequestSchema,
  SearchDocumentsQuerySchema,
} from '@trustvault/shared';

const docService = new DocumentService();

export class DocumentController {
  /**
   * Upload initial document
   */
  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({
          success: false,
          error: {
            code: 'FILE_REQUIRED',
            message: 'A document file must be uploaded',
          },
        });
        return;
      }

      const validated = CreateDocumentRequestSchema.parse(req.body);

      const result = await docService.createDocument(req.user!, validated, {
        path: req.file.path,
        originalname: req.file.originalname,
      });

      if (!result.success) {
        res.status(result.statusCode || 400).json({
          success: false,
          error: {
            code: result.errorCode || 'UPLOAD_FAILED',
            message: result.errorMessage || 'Failed to upload document',
          },
        });
        return;
      }

      res.status(201).json({
        success: true,
        data: result.data,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get document metadata and version history
   */
  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const documentId = req.params.id;
      const result = await docService.getDocument(req.user!, documentId);

      if (!result.success) {
        res.status(result.statusCode || 404).json({
          success: false,
          error: {
            code: result.errorCode || 'NOT_FOUND',
            message: result.errorMessage || 'Document not found',
          },
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: result.data,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Stream document download with strict security headers
   */
  static async download(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const documentId = req.params.id;
      const versionNumber = req.query.version ? parseInt(req.query.version as string, 10) : undefined;

      const result = await docService.getDocumentFileStream(req.user!, documentId, versionNumber);

      if (!result.success || !result.data) {
        res.status(result.statusCode || 404).json({
          success: false,
          error: {
            code: result.errorCode || 'NOT_FOUND',
            message: result.errorMessage || 'Document not found',
          },
        });
        return;
      }

      const { stream, fileName, mimeType, fileSize, sha256Checksum } = result.data;

      // Set strict security headers for file delivery
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Length', fileSize);
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('X-File-Checksum-SHA256', sha256Checksum);

      stream.pipe(res);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Upload new document version
   */
  static async createVersion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({
          success: false,
          error: {
            code: 'FILE_REQUIRED',
            message: 'A document version file must be uploaded',
          },
        });
        return;
      }

      const documentId = req.params.id;
      const parsedBody = CreateVersionRequestSchema.parse(req.body);

      const result = await docService.createVersion(
        req.user!,
        documentId,
        {
          path: req.file.path,
          originalname: req.file.originalname,
        },
        parsedBody.expectedVersion
      );

      if (!result.success) {
        res.status(result.statusCode || 400).json({
          success: false,
          error: {
            code: result.errorCode || 'VERSION_FAILED',
            message: result.errorMessage || 'Failed to upload version',
          },
        });
        return;
      }

      res.status(201).json({
        success: true,
        data: result.data,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Update metadata (title, category)
   */
  static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const documentId = req.params.id;
      const validated = UpdateDocumentRequestSchema.parse(req.body);

      const result = await docService.updateDocument(req.user!, documentId, validated);

      if (!result.success) {
        res.status(result.statusCode || 404).json({
          success: false,
          error: {
            code: result.errorCode || 'UPDATE_FAILED',
            message: result.errorMessage || 'Failed to update document',
          },
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: result.data,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Soft-delete document
   */
  static async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const documentId = req.params.id;
      const result = await docService.softDeleteDocument(req.user!, documentId);

      if (!result.success) {
        res.status(result.statusCode || 404).json({
          success: false,
          error: {
            code: result.errorCode || 'DELETE_FAILED',
            message: result.errorMessage || 'Failed to delete document',
          },
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          message: 'Document deleted successfully',
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Recover soft-deleted document
   */
  static async recover(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const documentId = req.params.id;
      const result = await docService.recoverDocument(req.user!, documentId);

      if (!result.success) {
        res.status(result.statusCode || 404).json({
          success: false,
          error: {
            code: result.errorCode || 'RECOVER_FAILED',
            message: result.errorMessage || 'Failed to recover document',
          },
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          message: 'Document recovered successfully',
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Search and list documents with permission safety
   */
  static async listOrSearch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = SearchDocumentsQuerySchema.parse(req.query);
      const result = await docService.searchDocuments(req.user!, validated);

      res.status(200).json({
        success: true,
        data: result.data,
      });
    } catch (err) {
      next(err);
    }
  }
}
