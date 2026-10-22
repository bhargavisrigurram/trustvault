import { getDb, DbClient } from '../../db/index.js';
import type { DocumentGrant, GrantPermissionType } from '@trustvault/shared';

export interface GrantWithUser extends DocumentGrant {
  grantee_username: string;
  grantee_email: string;
}

export class GrantRepository {
  constructor(private client?: DbClient) {}

  private async getClient(): Promise<DbClient> {
    return this.client || (await getDb());
  }

  async createGrant(data: {
    documentId: string;
    granteeId: string;
    grantedById: string;
    permission: GrantPermissionType;
    expiresAt: Date | null;
  }): Promise<DocumentGrant> {
    const db = await this.getClient();

    // Revoke any existing active grant for this (document, user) pair before creating a new one
    await db.query(
      `UPDATE document_grants
       SET revoked_at = CURRENT_TIMESTAMP
       WHERE document_id = $1 AND grantee_id = $2 AND revoked_at IS NULL`,
      [data.documentId, data.granteeId]
    );

    const res = await db.query<DocumentGrant>(
      `INSERT INTO document_grants (document_id, grantee_id, granted_by_id, permission, expires_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, document_id, grantee_id, granted_by_id, permission, expires_at, revoked_at, created_at`,
      [
        data.documentId,
        data.granteeId,
        data.grantedById,
        data.permission,
        data.expiresAt ? data.expiresAt.toISOString() : null,
      ]
    );

    return res.rows[0];
  }

  async findById(grantId: string): Promise<DocumentGrant | null> {
    const db = await this.getClient();
    const res = await db.query<DocumentGrant>(
      `SELECT id, document_id, grantee_id, granted_by_id, permission, expires_at, revoked_at, created_at
       FROM document_grants
       WHERE id = $1`,
      [grantId]
    );
    return res.rows[0] || null;
  }

  async findActiveGrant(documentId: string, granteeId: string): Promise<DocumentGrant | null> {
    const db = await this.getClient();
    const res = await db.query<DocumentGrant>(
      `SELECT id, document_id, grantee_id, granted_by_id, permission, expires_at, revoked_at, created_at
       FROM document_grants
       WHERE document_id = $1
         AND grantee_id = $2
         AND revoked_at IS NULL
         AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`,
      [documentId, granteeId]
    );
    return res.rows[0] || null;
  }

  async listGrantsForDocument(documentId: string): Promise<GrantWithUser[]> {
    const db = await this.getClient();
    const res = await db.query<GrantWithUser>(
      `SELECT g.id, g.document_id, g.grantee_id, g.granted_by_id, g.permission,
              g.expires_at, g.revoked_at, g.created_at,
              u.username as grantee_username, u.email as grantee_email
       FROM document_grants g
       JOIN users u ON u.id = g.grantee_id
       WHERE g.document_id = $1
       ORDER BY g.created_at DESC`,
      [documentId]
    );
    return res.rows;
  }

  async revokeGrant(grantId: string): Promise<DocumentGrant | null> {
    const db = await this.getClient();
    const res = await db.query<DocumentGrant>(
      `UPDATE document_grants
       SET revoked_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND revoked_at IS NULL
       RETURNING id, document_id, grantee_id, granted_by_id, permission, expires_at, revoked_at, created_at`,
      [grantId]
    );
    return res.rows[0] || null;
  }

  async invalidateTokensForGrant(documentId: string, userId: string): Promise<void> {
    const db = await this.getClient();
    await db.query(
      `UPDATE download_tokens
       SET consumed_at = CURRENT_TIMESTAMP
       WHERE document_id = $1 AND user_id = $2 AND consumed_at IS NULL`,
      [documentId, userId]
    );
  }
}
