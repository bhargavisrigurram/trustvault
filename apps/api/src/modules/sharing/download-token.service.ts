import crypto from 'node:crypto';
import fs from 'node:fs';
import { getDb, transaction, DbClient } from '../../db/index.js';
import { DocumentRepository } from '../documents/document.repository.js';
import { UserRepository } from '../users/user.repository.js';
import { StorageService } from '../storage/storage.service.js';
import { authorize } from '../authorization/index.js';
import { DocumentAction } from '@trustvault/shared';
import type { User, DocumentVersion } from '@trustvault/shared';

export interface TokenIssuanceResult {
  success: boolean;
  token?: string;
  expiresAt?: string;
  statusCode?: number;
  errorCode?: string;
  errorMessage?: string;
}

export interface TokenRedemptionResult {
  success: boolean;
  stream?: fs.ReadStream;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
  sha256Checksum?: string;
  statusCode?: number;
  errorCode?: string;
  errorMessage?: string;
}

export class DownloadTokenService {
  constructor(
    private docRepo: DocumentRepository = new DocumentRepository(),
    private userRepo: UserRepository = new UserRepository(),
    private storageService: StorageService = new StorageService()
  ) {}

  /**
   * Issue a 60-second single-use download token bound to user, document, and version
   */
  async issueToken(
    user: User,
    documentId: string,
    versionNumber?: number
  ): Promise<TokenIssuanceResult> {
    const doc = await this.docRepo.findById(documentId);
    if (!doc) {
      return {
        success: false,
        statusCode: 404,
        errorCode: 'NOT_FOUND',
        errorMessage: 'Document not found',
      };
    }

    // Mandatory authorization check for download
    const authRes = await authorize(user, doc, DocumentAction.DOWNLOAD);
    if (!authRes.allowed) {
      return {
        success: false,
        statusCode: authRes.statusCode || 404,
        errorCode: 'NOT_FOUND',
        errorMessage: authRes.reason || 'Document not found',
      };
    }

    // Resolve target version
    const targetVerNum = versionNumber ?? doc.current_version_number;
    const version = await this.docRepo.findVersionByNumber(documentId, targetVerNum);
    if (!version) {
      return {
        success: false,
        statusCode: 404,
        errorCode: 'NOT_FOUND',
        errorMessage: 'Document version not found',
      };
    }

    // Generate cryptographically random token (32 bytes entropy)
    const rawToken = crypto.randomBytes(32).toString('base64url');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    // Maximum lifetime: 60 seconds
    const now = Date.now();
    const expiresAt = new Date(now + 60 * 1000);

    const db = await getDb();
    await db.query(
      `INSERT INTO download_tokens (token_hash, user_id, document_id, version_id, operation, expires_at)
       VALUES ($1, $2, $3, $4, 'download', $5)`,
      [tokenHash, user.id, doc.id, version.id, expiresAt.toISOString()]
    );

    return {
      success: true,
      token: rawToken,
      expiresAt: expiresAt.toISOString(),
    };
  }

  /**
   * Atomically redeem a download token with authorization re-check and replay prevention
   */
  async redeemToken(rawToken: string, requestingUser?: User): Promise<TokenRedemptionResult> {
    if (!rawToken || typeof rawToken !== 'string') {
      return {
        success: false,
        statusCode: 400,
        errorCode: 'INVALID_TOKEN',
        errorMessage: 'Download token is required',
      };
    }

    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    // Atomic redemption inside database transaction
    return await transaction(async (txClient) => {
      const txUserRepo = new UserRepository(txClient);
      const txDocRepo = new DocumentRepository(txClient);

      // 1. Atomically consume token (prevents concurrent replay attacks)
      const consumeRes = await txClient.query<{
        id: string;
        user_id: string;
        document_id: string;
        version_id: string;
        operation: string;
        expires_at: Date;
        consumed_at: Date | null;
      }>(
        `UPDATE download_tokens
         SET consumed_at = CURRENT_TIMESTAMP
         WHERE token_hash = $1
           AND consumed_at IS NULL
           AND expires_at > CURRENT_TIMESTAMP
         RETURNING id, user_id, document_id, version_id, operation, expires_at, consumed_at`,
        [tokenHash]
      );

      const tokenRecord = consumeRes.rows[0];

      if (!tokenRecord) {
        // Query to distinguish between expired, already consumed (replay), or non-existent
        const checkRes = await txClient.query<{
          consumed_at: Date | null;
          expires_at: Date;
        }>(
          `SELECT consumed_at, expires_at FROM download_tokens WHERE token_hash = $1`,
          [tokenHash]
        );

        if (checkRes.rows.length === 0) {
          return {
            success: false,
            statusCode: 404,
            errorCode: 'INVALID_TOKEN',
            errorMessage: 'Download token is invalid or does not exist',
          };
        }

        const existing = checkRes.rows[0];
        if (existing.consumed_at) {
          return {
            success: false,
            statusCode: 410,
            errorCode: 'TOKEN_ALREADY_USED',
            errorMessage: 'Download token has already been consumed (replay attempt detected)',
          };
        }

        return {
          success: false,
          statusCode: 410,
          errorCode: 'TOKEN_EXPIRED',
          errorMessage: 'Download token has expired (maximum lifespan is 60 seconds)',
        };
      }

      // 2. Cross-user redemption check:
      // If a requestingUser is authenticated, verify token was issued to that same user
      if (requestingUser && requestingUser.id !== tokenRecord.user_id) {
        return {
          success: false,
          statusCode: 403,
          errorCode: 'CROSS_USER_FORBIDDEN',
          errorMessage: 'Cannot redeem download token issued to a different user',
        };
      }

      // 3. Resolve bound user and verify active status using txUserRepo
      const boundUser = await txUserRepo.findById(tokenRecord.user_id);
      if (!boundUser || !boundUser.is_active) {
        return {
          success: false,
          statusCode: 403,
          errorCode: 'USER_DISABLED',
          errorMessage: 'Token owner account is inactive or disabled',
        };
      }

      // 4. Resolve document using txDocRepo
      const doc = await txDocRepo.findById(tokenRecord.document_id);
      if (!doc || doc.is_deleted) {
        return {
          success: false,
          statusCode: 404,
          errorCode: 'DOCUMENT_UNAVAILABLE',
          errorMessage: 'Document is not available or has been deleted',
        };
      }

      // 5. Re-check current authorization at the linearization point
      // If grant was revoked, authorize() will deny
      const authRes = await authorize(boundUser, doc, DocumentAction.DOWNLOAD, { client: txClient });
      if (!authRes.allowed) {
        return {
          success: false,
          statusCode: 403,
          errorCode: 'ACCESS_REVOKED',
          errorMessage: 'Document access permissions have been revoked',
        };
      }

      // 6. Retrieve version and prepare stream
      const versionRes = await txClient.query<DocumentVersion>(
        `SELECT id, document_id, version_number, storage_key, file_name, file_size, mime_type, sha256_checksum
         FROM document_versions
         WHERE id = $1`,
        [tokenRecord.version_id]
      );
      const version = versionRes.rows[0];
      if (!version) {
        return {
          success: false,
          statusCode: 404,
          errorCode: 'VERSION_NOT_FOUND',
          errorMessage: 'Document version not found',
        };
      }

      const stream = this.storageService.createReadStream(version.storage_key);

      return {
        success: true,
        stream,
        fileName: version.file_name,
        mimeType: version.mime_type,
        fileSize: Number(version.file_size),
        sha256Checksum: version.sha256_checksum,
      };
    });
  }
}
