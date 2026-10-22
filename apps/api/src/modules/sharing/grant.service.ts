import { GrantRepository, GrantWithUser } from './grant.repository.js';
import { DocumentRepository } from '../documents/document.repository.js';
import { UserRepository } from '../users/user.repository.js';
import { authorize } from '../authorization/index.js';
import { transaction } from '../../db/index.js';
import { DocumentAction } from '@trustvault/shared';
import type { User, DocumentGrant, GrantPermissionType } from '@trustvault/shared';

export interface GrantServiceResult<T> {
  success: boolean;
  data?: T;
  statusCode?: number;
  errorCode?: string;
  errorMessage?: string;
}

export class GrantService {
  constructor(
    private grantRepo: GrantRepository = new GrantRepository(),
    private docRepo: DocumentRepository = new DocumentRepository(),
    private userRepo: UserRepository = new UserRepository()
  ) {}

  /**
   * Create or update a document grant for a recipient user
   */
  async createGrant(
    user: User,
    documentId: string,
    data: {
      granteeUsernameOrEmail: string;
      permission: GrantPermissionType;
      expiresInHours?: number;
    }
  ): Promise<GrantServiceResult<DocumentGrant>> {
    const doc = await this.docRepo.findById(documentId);
    if (!doc) {
      return {
        success: false,
        statusCode: 404,
        errorCode: 'NOT_FOUND',
        errorMessage: 'Document not found',
      };
    }

    // Central authorization rule: only authorized users (owners) can share
    const authRes = await authorize(user, doc, DocumentAction.SHARE);
    if (!authRes.allowed) {
      return {
        success: false,
        statusCode: authRes.statusCode || 404,
        errorCode: 'NOT_FOUND',
        errorMessage: authRes.reason || 'Document not found or permission denied',
      };
    }

    // Resolve grantee
    const grantee = await this.userRepo.findByUsernameOrEmail(data.granteeUsernameOrEmail);
    if (!grantee) {
      return {
        success: false,
        statusCode: 404,
        errorCode: 'USER_NOT_FOUND',
        errorMessage: 'Recipient user not found',
      };
    }

    if (!grantee.is_active) {
      return {
        success: false,
        statusCode: 400,
        errorCode: 'USER_DISABLED',
        errorMessage: 'Cannot grant access to an inactive or disabled user',
      };
    }

    if (grantee.id === user.id) {
      return {
        success: false,
        statusCode: 400,
        errorCode: 'INVALID_GRANTEE',
        errorMessage: 'You cannot grant permissions to yourself',
      };
    }

    // Calculate expiration date
    let expiresAt: Date | null = null;
    if (data.expiresInHours && data.expiresInHours > 0) {
      expiresAt = new Date(Date.now() + data.expiresInHours * 3600 * 1000);
    }

    const grant = await this.grantRepo.createGrant({
      documentId: doc.id,
      granteeId: grantee.id,
      grantedById: user.id,
      permission: data.permission,
      expiresAt,
    });

    return {
      success: true,
      data: grant,
    };
  }

  /**
   * Revoke an existing grant
   */
  async revokeGrant(
    user: User,
    documentId: string,
    grantId: string
  ): Promise<GrantServiceResult<DocumentGrant>> {
    const doc = await this.docRepo.findById(documentId);
    if (!doc) {
      return {
        success: false,
        statusCode: 404,
        errorCode: 'NOT_FOUND',
        errorMessage: 'Document not found',
      };
    }

    // Central authorization rule: only authorized users (owners) can revoke
    const authRes = await authorize(user, doc, DocumentAction.REVOKE);
    if (!authRes.allowed) {
      return {
        success: false,
        statusCode: authRes.statusCode || 404,
        errorCode: 'NOT_FOUND',
        errorMessage: authRes.reason || 'Document not found or permission denied',
      };
    }

    const existingGrant = await this.grantRepo.findById(grantId);
    if (!existingGrant || existingGrant.document_id !== documentId) {
      return {
        success: false,
        statusCode: 404,
        errorCode: 'GRANT_NOT_FOUND',
        errorMessage: 'Grant not found for this document',
      };
    }

    // Revocation transaction: revoke grant and invalidate all pending download tokens
    const revokedGrant = await transaction(async (txClient) => {
      const txGrantRepo = new GrantRepository(txClient);
      const res = await txGrantRepo.revokeGrant(grantId);
      if (res) {
        await txGrantRepo.invalidateTokensForGrant(documentId, res.grantee_id);
      }
      return res;
    });

    return {
      success: true,
      data: revokedGrant || existingGrant,
    };
  }

  /**
   * List all grants for a document (Owner only)
   */
  async listGrants(
    user: User,
    documentId: string
  ): Promise<GrantServiceResult<GrantWithUser[]>> {
    const doc = await this.docRepo.findById(documentId);
    if (!doc) {
      return {
        success: false,
        statusCode: 404,
        errorCode: 'NOT_FOUND',
        errorMessage: 'Document not found',
      };
    }

    // Owner authorization check
    const authRes = await authorize(user, doc, DocumentAction.SHARE);
    if (!authRes.allowed) {
      return {
        success: false,
        statusCode: authRes.statusCode || 404,
        errorCode: 'NOT_FOUND',
        errorMessage: authRes.reason || 'Document not found',
      };
    }

    const grants = await this.grantRepo.listGrantsForDocument(documentId);
    return {
      success: true,
      data: grants,
    };
  }
}
