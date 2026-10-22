import { getDb, DbClient } from '../../db/index.js';
import type {
  User,
  Document,
  DocumentActionType,
  AuthorizationResult,
} from '@trustvault/shared';
import { DocumentAction } from '@trustvault/shared';

export interface AuthorizeOptions {
  client?: DbClient;
}

/**
 * MANDATORY CENTRAL AUTHORIZATION FUNCTION
 * 
 * Rules:
 * 1. Deny by default.
 * 2. Validate current user status (must be authenticated and active).
 * 3. Validate document status (cannot access soft-deleted documents unless recovering as owner).
 * 4. Resolve ownership and grants from trusted server-side state.
 * 5. Respect grant expiration and revocation.
 * 6. Enforce permission matrix:
 *    - Owner: read, download, edit, version, delete, recover, share, revoke, audit
 *    - Active 'edit' grant: read, download, edit, version
 *    - Active 'read' grant: read, download
 *    - Admin alone: NEVER has implicit access to document content or mutations
 * 7. Never trust roles or permission claims from the frontend.
 * 8. Return 404 for unauthorized document access to prevent existence disclosure.
 */
export async function authorize(
  user: User | null | undefined,
  document: Document | null | undefined,
  action: DocumentActionType,
  options?: AuthorizeOptions
): Promise<AuthorizationResult> {
  // 1. Validate User Authentication & Active Status
  if (!user) {
    return {
      allowed: false,
      reason: 'Authentication required',
      statusCode: 401,
    };
  }

  if (!user.is_active) {
    return {
      allowed: false,
      reason: 'User account is inactive or disabled',
      statusCode: 403,
    };
  }

  // 2. Validate Document Existence
  if (!document) {
    return {
      allowed: false,
      reason: 'Document not found',
      statusCode: 404,
    };
  }

  const isOwner = user.id === document.owner_id;

  // 3. Handle Soft-Deleted Documents
  if (document.is_deleted) {
    // Only the owner can recover a soft-deleted document
    if (isOwner && action === DocumentAction.RECOVER) {
      return { allowed: true };
    }
    // All other operations on soft-deleted documents are denied with 404
    return {
      allowed: false,
      reason: 'Document not found or deleted',
      statusCode: 404,
    };
  }

  // 4. If action is RECOVER, but document is not deleted, deny
  if (action === DocumentAction.RECOVER) {
    return {
      allowed: false,
      reason: 'Document is not deleted',
      statusCode: 404,
    };
  }

  // 5. Check Owner Permissions
  if (isOwner) {
    // Owners have full access to all standard document operations
    return { allowed: true };
  }

  // 6. Non-Owner: Check Active Server-Side Grants
  // Resolve active grants directly from database (never trust client claims)
  const db = options?.client || (await getDb());
  const grantRes = await db.query<{ permission: 'read' | 'edit' }>(
    `SELECT permission
     FROM document_grants
     WHERE document_id = $1
       AND grantee_id = $2
       AND revoked_at IS NULL
       AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
     LIMIT 1`,
    [document.id, user.id]
  );

  const activeGrant = grantRes.rows[0];

  if (!activeGrant) {
    // Note: Admin status alone NEVER grants access to document contents or operations
    // Return 404 to avoid disclosing whether the document exists to unauthorized users
    return {
      allowed: false,
      reason: 'Access denied: No active grant for document',
      statusCode: 404,
    };
  }

  // 7. Enforce Grant Permission Matrix
  if (activeGrant.permission === 'edit') {
    // Editors can read, download, edit metadata, and upload versions
    if (
      action === DocumentAction.READ ||
      action === DocumentAction.DOWNLOAD ||
      action === DocumentAction.EDIT ||
      action === DocumentAction.VERSION
    ) {
      return { allowed: true };
    }
    // Editors CANNOT delete, recover, share, revoke, or view audit logs
    return {
      allowed: false,
      reason: `Edit grant does not permit action '${action}'`,
      statusCode: 404,
    };
  }

  if (activeGrant.permission === 'read') {
    // Viewers can only read metadata and download content
    if (action === DocumentAction.READ || action === DocumentAction.DOWNLOAD) {
      return { allowed: true };
    }
    // Viewers CANNOT edit, version, delete, recover, share, revoke, or view audit logs
    return {
      allowed: false,
      reason: `Read grant does not permit action '${action}'`,
      statusCode: 404,
    };
  }

  // Default fallback: deny
  return {
    allowed: false,
    reason: 'Operation denied by default policy',
    statusCode: 404,
  };
}

/**
 * SQL Policy Predicate for Permission-Safe Collection Queries & Search
 * 
 * Generates an authorized SQL clause ensuring queries only select documents that:
 * 1. Are NOT soft-deleted
 * 2. Belong to user OR have an active, unexpired, unrevoked grant for user
 * 
 * Note: Admins also only see documents they own or are granted access to.
 */
export function getDocumentAuthorizationSqlPredicate(
  userIdParamIndex: number
): string {
  return `(
    d.is_deleted = FALSE AND (
      d.owner_id = $${userIdParamIndex}
      OR EXISTS (
        SELECT 1 FROM document_grants g
        WHERE g.document_id = d.id
          AND g.grantee_id = $${userIdParamIndex}
          AND g.revoked_at IS NULL
          AND (g.expires_at IS NULL OR g.expires_at > CURRENT_TIMESTAMP)
      )
    )
  )`;
}
