import { GrantRepository, GrantWithUser } from './grant.repository.js';
import { DocumentRepository } from '../documents/document.repository.js';
import { UserRepository } from '../users/user.repository.js';
import { AuditService } from '../audit/audit.service.js';
import { authorize } from '../authorization/index.js';
import { transaction } from '../../db/index.js';
import { DocumentAction, AuditEventType, AuditOutcome } from '@trustvault/shared';
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
    private userRepo: UserRepository = new UserRepository(),
    private auditService: AuditService = new AuditService()
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
      expiresInHours?: number | null;
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
      await this.auditService.recordEvent({
        eventType: AuditEventType.ACCESS_DENIED,
        actorId: user.id,
        actorUsername: user.username,
        targetType: 'document',
        targetId: documentId,
        outcome: AuditOutcome.DENIED,
        details: {
          action: DocumentAction.SHARE,
          reason: authRes.reason,
        },
      });

      return {
        success: false,
        statusCode: authRes.statusCode || 404,
        errorCode: 'NOT_FOUND',
        errorMessage: authRes.reason || 'Document not found or permission denied',
      };
    }

    // Resolve grantee
    const granteeIdentifier = data.granteeUsernameOrEmail.trim();
    const grantee = await this.userRepo.findByUsernameOrEmail(granteeIdentifier);
    if (!grantee) {
      return {
        success: false,
        statusCode: 404,
        errorCode: 'USER_NOT_FOUND',
        errorMessage: `Recipient user "${granteeIdentifier}" not found. Verify username or email (e.g. bob, alice, admin).`,
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

    await this.auditService.recordEvent({
      eventType: AuditEventType.GRANT_CREATE,
      actorId: user.id,
      actorUsername: user.username,
      targetType: 'grant',
      targetId: grant.id,
      outcome: AuditOutcome.SUCCESS,
      details: {
        documentId: doc.id,
        granteeId: grantee.id,
        granteeUsername: grantee.username,
        permission: data.permission,
        expiresAt: expiresAt?.toISOString() || null,
      },
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
      await this.auditService.recordEvent({
        eventType: AuditEventType.ACCESS_DENIED,
        actorId: user.id,
        actorUsername: user.username,
        targetType: 'document',
        targetId: documentId,
        outcome: AuditOutcome.DENIED,
        details: {
          action: DocumentAction.REVOKE,
          reason: authRes.reason,
        },
      });

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

    await this.auditService.recordEvent({
      eventType: AuditEventType.GRANT_REVOKE,
      actorId: user.id,
      actorUsername: user.username,
      targetType: 'grant',
      targetId: grantId,
      outcome: AuditOutcome.SUCCESS,
      details: {
        documentId,
        granteeId: existingGrant.grantee_id,
      },
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
