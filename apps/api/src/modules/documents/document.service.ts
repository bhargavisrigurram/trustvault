import crypto from 'node:crypto';
import fs from 'node:fs';
import { DocumentRepository } from './document.repository.js';
import { StorageService } from '../storage/storage.service.js';
import { AuditService } from '../audit/audit.service.js';
import { authorize } from '../authorization/index.js';
import { transaction } from '../../db/index.js';
import { DocumentAction, AuditEventType, AuditOutcome, sanitizeFilename } from '@trustvault/shared';
import type {
  User,
  Document,
  DocumentVersion,
  SearchDocumentsQuery,
  DocumentSearchResult,
} from '@trustvault/shared';

export interface ServiceResult<T> {
  success: boolean;
  data?: T;
  statusCode?: number;
  errorCode?: string;
  errorMessage?: string;
}

export class DocumentService {
  constructor(
    private docRepo: DocumentRepository = new DocumentRepository(),
    private storageService: StorageService = new StorageService(),
    private auditService: AuditService = new AuditService()
  ) {}

  /**
   * Upload and create a new document with initial version (v1)
   */
  async createDocument(
    user: User,
    data: { title: string; category: string },
    file: { path: string; originalname: string }
  ): Promise<ServiceResult<{ document: Document; version: DocumentVersion }>> {
    const tempPath = file.path;

    try {
      // 1. Inspect and validate file signature & checksum
      const inspection = await this.storageService.validateAndInspectFile(tempPath, file.originalname);
      if (!inspection.valid || !inspection.detectedMime || !inspection.sha256Checksum || !inspection.size) {
        this.storageService.deleteTempFile(tempPath);
        return {
          success: false,
          statusCode: 400,
          errorCode: 'INVALID_FILE',
          errorMessage: inspection.error || 'Invalid file format or signature',
        };
      }

      const storageKey = crypto.randomUUID();
      const safeFilename = sanitizeFilename(file.originalname);

      // 2. Perform atomic database transaction
      const result = await transaction(async (txClient) => {
        const txDocRepo = new DocumentRepository(txClient);

        const doc = await txDocRepo.create({
          ownerId: user.id,
          title: data.title,
          category: data.category,
        });

        const ver = await txDocRepo.createVersion({
          documentId: doc.id,
          versionNumber: 1,
          storageKey,
          fileName: safeFilename,
          fileSize: inspection.size!,
          mimeType: inspection.detectedMime!,
          sha256Checksum: inspection.sha256Checksum!,
          uploadedById: user.id,
        });

        // Record audit event in transaction
        await this.auditService.recordEvent(
          {
            eventType: AuditEventType.DOCUMENT_CREATE,
            actorId: user.id,
            actorUsername: user.username,
            targetType: 'document',
            targetId: doc.id,
            outcome: AuditOutcome.SUCCESS,
            details: {
              title: doc.title,
              category: doc.category,
              fileName: safeFilename,
              fileSize: inspection.size,
              mimeType: inspection.detectedMime,
              sha256Checksum: inspection.sha256Checksum,
            },
          },
          { client: txClient }
        );

        return { document: doc, version: ver };
      });

      // 3. Move file from temp to private permanent storage
      await this.storageService.commitFile(tempPath, storageKey);

      return {
        success: true,
        data: result,
      };
    } catch (err: any) {
      this.storageService.deleteTempFile(tempPath);
      throw err;
    }
  }

  /**
   * Get document metadata and versions
   */
  async getDocument(
    user: User,
    documentId: string
  ): Promise<ServiceResult<{ document: Document; currentVersion: DocumentVersion | null; versions: DocumentVersion[] }>> {
    const docWithVer = await this.docRepo.findWithCurrentVersion(documentId);
    if (!docWithVer) {
      return {
        success: false,
        statusCode: 404,
        errorCode: 'NOT_FOUND',
        errorMessage: 'Document not found',
      };
    }

    // Mandatory authorization boundary check
    const authRes = await authorize(user, docWithVer.document, DocumentAction.READ);
    if (!authRes.allowed) {
      await this.auditService.recordEvent({
        eventType: AuditEventType.ACCESS_DENIED,
        actorId: user.id,
        actorUsername: user.username,
        targetType: 'document',
        targetId: documentId,
        outcome: AuditOutcome.DENIED,
        details: {
          action: DocumentAction.READ,
          reason: authRes.reason,
        },
      });

      return {
        success: false,
        statusCode: authRes.statusCode || 404,
        errorCode: 'NOT_FOUND',
        errorMessage: authRes.reason || 'Document not found',
      };
    }

    const versions = await this.docRepo.findVersions(documentId);

    return {
      success: true,
      data: {
        document: docWithVer.document,
        currentVersion: docWithVer.currentVersion,
        versions,
      },
    };
  }

  /**
   * Stream document file content
   */
  async getDocumentFileStream(
    user: User,
    documentId: string,
    versionNumber?: number
  ): Promise<ServiceResult<{
    stream: fs.ReadStream;
    fileName: string;
    mimeType: string;
    fileSize: number;
    sha256Checksum: string;
  }>> {
    const doc = await this.docRepo.findById(documentId);
    if (!doc) {
      return {
        success: false,
        statusCode: 404,
        errorCode: 'NOT_FOUND',
        errorMessage: 'Document not found',
      };
    }

    // Central authorization rule: download action
    const authRes = await authorize(user, doc, DocumentAction.DOWNLOAD);
    if (!authRes.allowed) {
      await this.auditService.recordEvent({
        eventType: AuditEventType.ACCESS_DENIED,
        actorId: user.id,
        actorUsername: user.username,
        targetType: 'document',
        targetId: documentId,
        outcome: AuditOutcome.DENIED,
        details: {
          action: DocumentAction.DOWNLOAD,
          reason: authRes.reason,
        },
      });

      return {
        success: false,
        statusCode: authRes.statusCode || 404,
        errorCode: 'NOT_FOUND',
        errorMessage: authRes.reason || 'Document not found',
      };
    }

    // Resolve target version (specified version or latest)
    const targetVerNum = versionNumber ?? doc.current_version_number;
    const version = await this.docRepo.findVersionByNumber(documentId, targetVerNum);

    if (!version) {
      return {
        success: false,
        statusCode: 404,
        errorCode: 'NOT_FOUND',
        errorMessage: 'Requested document version not found',
      };
    }

    await this.auditService.recordEvent({
      eventType: AuditEventType.DOCUMENT_DOWNLOAD,
      actorId: user.id,
      actorUsername: user.username,
      targetType: 'document',
      targetId: doc.id,
      outcome: AuditOutcome.SUCCESS,
      details: {
        versionNumber: targetVerNum,
        fileName: version.file_name,
        mimeType: version.mime_type,
      },
    });

    const stream = this.storageService.createReadStream(version.storage_key);

    return {
      success: true,
      data: {
        stream,
        fileName: version.file_name,
        mimeType: version.mime_type,
        fileSize: Number(version.file_size),
        sha256Checksum: version.sha256_checksum,
      },
    };
  }

  /**
   * Create a new immutable version for a document with optimistic concurrency control
   */
  async createVersion(
    user: User,
    documentId: string,
    file: { path: string; originalname: string },
    expectedCurrentVersion?: number
  ): Promise<ServiceResult<{ document: Document; version: DocumentVersion }>> {
    const tempPath = file.path;

    try {
      const doc = await this.docRepo.findById(documentId);
      if (!doc) {
        this.storageService.deleteTempFile(tempPath);
        return {
          success: false,
          statusCode: 404,
          errorCode: 'NOT_FOUND',
          errorMessage: 'Document not found',
        };
      }

      // Mandatory authorization: version creation requires edit permissions
      const authRes = await authorize(user, doc, DocumentAction.VERSION);
      if (!authRes.allowed) {
        this.storageService.deleteTempFile(tempPath);
        await this.auditService.recordEvent({
          eventType: AuditEventType.ACCESS_DENIED,
          actorId: user.id,
          actorUsername: user.username,
          targetType: 'document',
          targetId: documentId,
          outcome: AuditOutcome.DENIED,
          details: {
            action: DocumentAction.VERSION,
            reason: authRes.reason,
          },
        });

        return {
          success: false,
          statusCode: authRes.statusCode || 404,
          errorCode: 'NOT_FOUND',
          errorMessage: authRes.reason || 'Document not found',
        };
      }

      // Optimistic concurrency check
      if (expectedCurrentVersion !== undefined && doc.current_version_number !== expectedCurrentVersion) {
        this.storageService.deleteTempFile(tempPath);
        return {
          success: false,
          statusCode: 409,
          errorCode: 'VERSION_CONFLICT',
          errorMessage: `Version conflict: Expected version ${expectedCurrentVersion}, but current is ${doc.current_version_number}`,
        };
      }

      // Validate new version file
      const inspection = await this.storageService.validateAndInspectFile(tempPath, file.originalname);
      if (!inspection.valid || !inspection.detectedMime || !inspection.sha256Checksum || !inspection.size) {
        this.storageService.deleteTempFile(tempPath);
        return {
          success: false,
          statusCode: 400,
          errorCode: 'INVALID_FILE',
          errorMessage: inspection.error || 'Invalid file format or signature',
        };
      }

      const nextVersionNum = doc.current_version_number + 1;
      const storageKey = crypto.randomUUID();
      const safeFilename = sanitizeFilename(file.originalname);

      const result = await transaction(async (txClient) => {
        const txDocRepo = new DocumentRepository(txClient);

        // Update version number with optimistic locking
        const updated = await txDocRepo.updateCurrentVersion(
          documentId,
          nextVersionNum,
          expectedCurrentVersion ?? doc.current_version_number
        );

        if (!updated) {
          throw new Error('CONCURRENCY_CONFLICT');
        }

        const ver = await txDocRepo.createVersion({
          documentId,
          versionNumber: nextVersionNum,
          storageKey,
          fileName: safeFilename,
          fileSize: inspection.size!,
          mimeType: inspection.detectedMime!,
          sha256Checksum: inspection.sha256Checksum!,
          uploadedById: user.id,
        });

        // Record audit event in transaction
        await this.auditService.recordEvent(
          {
            eventType: AuditEventType.DOCUMENT_VERSION_CREATE,
            actorId: user.id,
            actorUsername: user.username,
            targetType: 'document',
            targetId: documentId,
            outcome: AuditOutcome.SUCCESS,
            details: {
              versionNumber: nextVersionNum,
              fileName: safeFilename,
              fileSize: inspection.size,
              mimeType: inspection.detectedMime,
              sha256Checksum: inspection.sha256Checksum,
            },
          },
          { client: txClient }
        );

        const updatedDoc = (await txDocRepo.findById(documentId))!;
        return { document: updatedDoc, version: ver };
      });

      await this.storageService.commitFile(tempPath, storageKey);

      return {
        success: true,
        data: result,
      };
    } catch (err: any) {
      this.storageService.deleteTempFile(tempPath);
      if (err.message === 'CONCURRENCY_CONFLICT') {
        return {
          success: false,
          statusCode: 409,
          errorCode: 'VERSION_CONFLICT',
          errorMessage: 'Concurrent edit detected. Please refresh and try again.',
        };
      }
      throw err;
    }
  }

  /**
   * Update document metadata (title, category)
   */
  async updateDocument(
    user: User,
    documentId: string,
    data: { title?: string; category?: string }
  ): Promise<ServiceResult<Document>> {
    const doc = await this.docRepo.findById(documentId);
    if (!doc) {
      return {
        success: false,
        statusCode: 404,
        errorCode: 'NOT_FOUND',
        errorMessage: 'Document not found',
      };
    }

    const authRes = await authorize(user, doc, DocumentAction.EDIT);
    if (!authRes.allowed) {
      await this.auditService.recordEvent({
        eventType: AuditEventType.ACCESS_DENIED,
        actorId: user.id,
        actorUsername: user.username,
        targetType: 'document',
        targetId: documentId,
        outcome: AuditOutcome.DENIED,
        details: {
          action: DocumentAction.EDIT,
          reason: authRes.reason,
        },
      });

      return {
        success: false,
        statusCode: authRes.statusCode || 404,
        errorCode: 'NOT_FOUND',
        errorMessage: authRes.reason || 'Document not found',
      };
    }

    const updated = await this.docRepo.updateMetadata(documentId, data);

    await this.auditService.recordEvent({
      eventType: AuditEventType.DOCUMENT_EDIT,
      actorId: user.id,
      actorUsername: user.username,
      targetType: 'document',
      targetId: documentId,
      outcome: AuditOutcome.SUCCESS,
      details: {
        updatedFields: Object.keys(data),
      },
    });

    return {
      success: true,
      data: updated!,
    };
  }

  /**
   * Soft-delete document
   */
  async softDeleteDocument(user: User, documentId: string): Promise<ServiceResult<void>> {
    const doc = await this.docRepo.findById(documentId);
    if (!doc) {
      return {
        success: false,
        statusCode: 404,
        errorCode: 'NOT_FOUND',
        errorMessage: 'Document not found',
      };
    }

    const authRes = await authorize(user, doc, DocumentAction.DELETE);
    if (!authRes.allowed) {
      await this.auditService.recordEvent({
        eventType: AuditEventType.ACCESS_DENIED,
        actorId: user.id,
        actorUsername: user.username,
        targetType: 'document',
        targetId: documentId,
        outcome: AuditOutcome.DENIED,
        details: {
          action: DocumentAction.DELETE,
          reason: authRes.reason,
        },
      });

      return {
        success: false,
        statusCode: authRes.statusCode || 404,
        errorCode: 'NOT_FOUND',
        errorMessage: authRes.reason || 'Document not found',
      };
    }

    await this.docRepo.softDelete(documentId);

    await this.auditService.recordEvent({
      eventType: AuditEventType.DOCUMENT_DELETE,
      actorId: user.id,
      actorUsername: user.username,
      targetType: 'document',
      targetId: documentId,
      outcome: AuditOutcome.SUCCESS,
    });

    return {
      success: true,
    };
  }

  /**
   * Recover soft-deleted document (Owner only)
   */
  async recoverDocument(user: User, documentId: string): Promise<ServiceResult<void>> {
    const doc = await this.docRepo.findById(documentId);
    if (!doc) {
      return {
        success: false,
        statusCode: 404,
        errorCode: 'NOT_FOUND',
        errorMessage: 'Document not found',
      };
    }

    const authRes = await authorize(user, doc, DocumentAction.RECOVER);
    if (!authRes.allowed) {
      await this.auditService.recordEvent({
        eventType: AuditEventType.ACCESS_DENIED,
        actorId: user.id,
        actorUsername: user.username,
        targetType: 'document',
        targetId: documentId,
        outcome: AuditOutcome.DENIED,
        details: {
          action: DocumentAction.RECOVER,
          reason: authRes.reason,
        },
      });

      return {
        success: false,
        statusCode: authRes.statusCode || 404,
        errorCode: 'NOT_FOUND',
        errorMessage: authRes.reason || 'Document not found or cannot be recovered',
      };
    }

    await this.docRepo.recover(documentId);

    await this.auditService.recordEvent({
      eventType: AuditEventType.DOCUMENT_RECOVER,
      actorId: user.id,
      actorUsername: user.username,
      targetType: 'document',
      targetId: documentId,
      outcome: AuditOutcome.SUCCESS,
    });

    return {
      success: true,
    };
  }

  /**
   * Search documents with database-level permission boundaries
   */
  async searchDocuments(
    user: User,
    query: SearchDocumentsQuery
  ): Promise<ServiceResult<DocumentSearchResult>> {
    const result = await this.docRepo.searchDocuments(user.id, query);
    return {
      success: true,
      data: result,
    };
  }
}
