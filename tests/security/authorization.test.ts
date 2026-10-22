import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { authorize, getDocumentAuthorizationSqlPredicate } from '../../apps/api/src/modules/authorization/index.js';
import { getDb, resetTestDb, closeDb } from '../../apps/api/src/db/index.js';
import { DocumentAction } from '@trustvault/shared';
import type { User, Document } from '@trustvault/shared';

describe('Central Authorization Policy [authorize()]', () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  afterAll(async () => {
    await closeDb();
  });

  const ownerUser: User = {
    id: '11111111-1111-4111-8111-111111111111',
    username: 'alice_owner',
    email: 'alice@vault.local',
    role: 'owner',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const editorUser: User = {
    id: '22222222-2222-4222-8222-222222222222',
    username: 'bob_editor',
    email: 'bob@vault.local',
    role: 'viewer',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const viewerUser: User = {
    id: '33333333-3333-4333-8333-333333333333',
    username: 'charlie_viewer',
    email: 'charlie@vault.local',
    role: 'viewer',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const strangerUser: User = {
    id: '44444444-4444-4444-8444-444444444444',
    username: 'eve_stranger',
    email: 'eve@vault.local',
    role: 'viewer',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const adminUser: User = {
    id: '55555555-5555-4555-8555-555555555555',
    username: 'dave_admin',
    email: 'dave@vault.local',
    role: 'admin',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const sampleDoc: Document = {
    id: '99999999-9999-4999-8999-999999999999',
    owner_id: ownerUser.id,
    title: 'Top Secret Strategy',
    category: 'Finance',
    current_version_number: 1,
    is_deleted: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  it('1. Denies access by default when user is null or undefined', async () => {
    const res1 = await authorize(null, sampleDoc, DocumentAction.READ);
    expect(res1.allowed).toBe(false);
    expect(res1.statusCode).toBe(401);

    const res2 = await authorize(undefined, sampleDoc, DocumentAction.READ);
    expect(res2.allowed).toBe(false);
    expect(res2.statusCode).toBe(401);
  });

  it('2. Denies access when document is null or undefined with 404', async () => {
    const res = await authorize(ownerUser, null, DocumentAction.READ);
    expect(res.allowed).toBe(false);
    expect(res.statusCode).toBe(404);
  });

  it('3. Denies access immediately if user is disabled or inactive', async () => {
    const inactiveUser: User = { ...ownerUser, is_active: false };
    const res = await authorize(inactiveUser, sampleDoc, DocumentAction.READ);
    expect(res.allowed).toBe(false);
    expect(res.statusCode).toBe(403);
  });

  it('4. Owner has full authorization for all document actions', async () => {
    const actions: (typeof DocumentAction)[keyof typeof DocumentAction][] = [
      DocumentAction.READ,
      DocumentAction.DOWNLOAD,
      DocumentAction.EDIT,
      DocumentAction.VERSION,
      DocumentAction.DELETE,
      DocumentAction.SHARE,
      DocumentAction.REVOKE,
      DocumentAction.AUDIT,
    ];

    for (const action of actions) {
      const res = await authorize(ownerUser, sampleDoc, action);
      expect(res.allowed, `Owner should be allowed action: ${action}`).toBe(true);
    }
  });

  it('5. Soft-deleted documents deny all operations to non-owners with 404', async () => {
    const deletedDoc: Document = { ...sampleDoc, is_deleted: true, deleted_at: new Date().toISOString() };
    const res = await authorize(viewerUser, deletedDoc, DocumentAction.READ);
    expect(res.allowed).toBe(false);
    expect(res.statusCode).toBe(404);
  });

  it('6. Soft-deleted documents allow owner RECOVER but deny other actions with 404', async () => {
    const deletedDoc: Document = { ...sampleDoc, is_deleted: true, deleted_at: new Date().toISOString() };

    const recoverRes = await authorize(ownerUser, deletedDoc, DocumentAction.RECOVER);
    expect(recoverRes.allowed).toBe(true);

    const readRes = await authorize(ownerUser, deletedDoc, DocumentAction.READ);
    expect(readRes.allowed).toBe(false);
    expect(readRes.statusCode).toBe(404);

    const downloadRes = await authorize(ownerUser, deletedDoc, DocumentAction.DOWNLOAD);
    expect(downloadRes.allowed).toBe(false);
    expect(downloadRes.statusCode).toBe(404);
  });

  it('7. Enforces viewer with active READ grant: can read & download, cannot edit, share, or delete', async () => {
    const db = await getDb();
    // Insert user records to satisfy FK
    await db.query(
      `INSERT INTO users (id, username, email, password_hash, role, is_active)
       VALUES ($1, $2, $3, 'dummy', 'owner', TRUE),
              ($4, $5, $6, 'dummy', 'viewer', TRUE)`,
      [ownerUser.id, ownerUser.username, ownerUser.email, viewerUser.id, viewerUser.username, viewerUser.email]
    );

    // Insert doc
    await db.query(
      `INSERT INTO documents (id, owner_id, title, category)
       VALUES ($1, $2, $3, $4)`,
      [sampleDoc.id, ownerUser.id, sampleDoc.title, sampleDoc.category]
    );

    // Insert active READ grant
    await db.query(
      `INSERT INTO document_grants (id, document_id, grantee_id, granted_by_id, permission, expires_at, revoked_at)
       VALUES (gen_random_uuid(), $1, $2, $3, 'read', NULL, NULL)`,
      [sampleDoc.id, viewerUser.id, ownerUser.id]
    );

    // Can read and download
    expect((await authorize(viewerUser, sampleDoc, DocumentAction.READ)).allowed).toBe(true);
    expect((await authorize(viewerUser, sampleDoc, DocumentAction.DOWNLOAD)).allowed).toBe(true);

    // Cannot mutate or administer
    expect((await authorize(viewerUser, sampleDoc, DocumentAction.EDIT)).allowed).toBe(false);
    expect((await authorize(viewerUser, sampleDoc, DocumentAction.VERSION)).allowed).toBe(false);
    expect((await authorize(viewerUser, sampleDoc, DocumentAction.DELETE)).allowed).toBe(false);
    expect((await authorize(viewerUser, sampleDoc, DocumentAction.SHARE)).allowed).toBe(false);
    expect((await authorize(viewerUser, sampleDoc, DocumentAction.REVOKE)).allowed).toBe(false);
    expect((await authorize(viewerUser, sampleDoc, DocumentAction.AUDIT)).allowed).toBe(false);
  });

  it('8. Enforces user with active EDIT grant: can read & edit, cannot delete, share, or revoke', async () => {
    const db = await getDb();
    await db.query(
      `INSERT INTO users (id, username, email, password_hash, role, is_active)
       VALUES ($1, $2, $3, 'dummy', 'owner', TRUE),
              ($4, $5, $6, 'dummy', 'viewer', TRUE)`,
      [ownerUser.id, ownerUser.username, ownerUser.email, editorUser.id, editorUser.username, editorUser.email]
    );

    await db.query(
      `INSERT INTO documents (id, owner_id, title, category)
       VALUES ($1, $2, $3, $4)`,
      [sampleDoc.id, ownerUser.id, sampleDoc.title, sampleDoc.category]
    );

    await db.query(
      `INSERT INTO document_grants (id, document_id, grantee_id, granted_by_id, permission, expires_at, revoked_at)
       VALUES (gen_random_uuid(), $1, $2, $3, 'edit', NULL, NULL)`,
      [sampleDoc.id, editorUser.id, ownerUser.id]
    );

    expect((await authorize(editorUser, sampleDoc, DocumentAction.READ)).allowed).toBe(true);
    expect((await authorize(editorUser, sampleDoc, DocumentAction.DOWNLOAD)).allowed).toBe(true);
    expect((await authorize(editorUser, sampleDoc, DocumentAction.EDIT)).allowed).toBe(true);
    expect((await authorize(editorUser, sampleDoc, DocumentAction.VERSION)).allowed).toBe(true);

    expect((await authorize(editorUser, sampleDoc, DocumentAction.DELETE)).allowed).toBe(false);
    expect((await authorize(editorUser, sampleDoc, DocumentAction.SHARE)).allowed).toBe(false);
    expect((await authorize(editorUser, sampleDoc, DocumentAction.REVOKE)).allowed).toBe(false);
    expect((await authorize(editorUser, sampleDoc, DocumentAction.AUDIT)).allowed).toBe(false);
  });

  it('9. Denies access when grant is expired', async () => {
    const db = await getDb();
    await db.query(
      `INSERT INTO users (id, username, email, password_hash, role, is_active)
       VALUES ($1, $2, $3, 'dummy', 'owner', TRUE),
              ($4, $5, $6, 'dummy', 'viewer', TRUE)`,
      [ownerUser.id, ownerUser.username, ownerUser.email, viewerUser.id, viewerUser.username, viewerUser.email]
    );

    await db.query(
      `INSERT INTO documents (id, owner_id, title, category)
       VALUES ($1, $2, $3, $4)`,
      [sampleDoc.id, ownerUser.id, sampleDoc.title, sampleDoc.category]
    );

    // Expired 1 hour ago
    const pastTime = new Date(Date.now() - 3600 * 1000).toISOString();
    await db.query(
      `INSERT INTO document_grants (id, document_id, grantee_id, granted_by_id, permission, expires_at, revoked_at)
       VALUES (gen_random_uuid(), $1, $2, $3, 'read', $4, NULL)`,
      [sampleDoc.id, viewerUser.id, ownerUser.id, pastTime]
    );

    const res = await authorize(viewerUser, sampleDoc, DocumentAction.READ);
    expect(res.allowed).toBe(false);
    expect(res.statusCode).toBe(404);
  });

  it('10. Denies access when grant is revoked', async () => {
    const db = await getDb();
    await db.query(
      `INSERT INTO users (id, username, email, password_hash, role, is_active)
       VALUES ($1, $2, $3, 'dummy', 'owner', TRUE),
              ($4, $5, $6, 'dummy', 'viewer', TRUE)`,
      [ownerUser.id, ownerUser.username, ownerUser.email, viewerUser.id, viewerUser.username, viewerUser.email]
    );

    await db.query(
      `INSERT INTO documents (id, owner_id, title, category)
       VALUES ($1, $2, $3, $4)`,
      [sampleDoc.id, ownerUser.id, sampleDoc.title, sampleDoc.category]
    );

    // Revoked
    const revokedTime = new Date().toISOString();
    await db.query(
      `INSERT INTO document_grants (id, document_id, grantee_id, granted_by_id, permission, expires_at, revoked_at)
       VALUES (gen_random_uuid(), $1, $2, $3, 'read', NULL, $4)`,
      [sampleDoc.id, viewerUser.id, ownerUser.id, revokedTime]
    );

    const res = await authorize(viewerUser, sampleDoc, DocumentAction.READ);
    expect(res.allowed).toBe(false);
    expect(res.statusCode).toBe(404);
  });

  it('11. ADMIN ROLE RULE: Admin status alone NEVER grants access to document contents without explicit grant', async () => {
    const db = await getDb();
    await db.query(
      `INSERT INTO users (id, username, email, password_hash, role, is_active)
       VALUES ($1, $2, $3, 'dummy', 'owner', TRUE),
              ($4, $5, $6, 'dummy', 'admin', TRUE)`,
      [ownerUser.id, ownerUser.username, ownerUser.email, adminUser.id, adminUser.username, adminUser.email]
    );

    await db.query(
      `INSERT INTO documents (id, owner_id, title, category)
       VALUES ($1, $2, $3, $4)`,
      [sampleDoc.id, ownerUser.id, sampleDoc.title, sampleDoc.category]
    );

    // Admin without grant attempts READ and DOWNLOAD
    const readRes = await authorize(adminUser, sampleDoc, DocumentAction.READ);
    expect(readRes.allowed, 'Admin must NOT be allowed read without explicit grant').toBe(false);
    expect(readRes.statusCode).toBe(404);

    const downloadRes = await authorize(adminUser, sampleDoc, DocumentAction.DOWNLOAD);
    expect(downloadRes.allowed, 'Admin must NOT be allowed download without explicit grant').toBe(false);
    expect(downloadRes.statusCode).toBe(404);

    const editRes = await authorize(adminUser, sampleDoc, DocumentAction.EDIT);
    expect(editRes.allowed, 'Admin must NOT be allowed edit without explicit grant').toBe(false);
    expect(editRes.statusCode).toBe(404);
  });

  it('12. SQL predicate enforces permission-safe queries in database', async () => {
    const predicate = getDocumentAuthorizationSqlPredicate(1);
    expect(predicate).toContain('d.is_deleted = FALSE');
    expect(predicate).toContain('d.owner_id = $1');
    expect(predicate).toContain('document_grants');
    expect(predicate).toContain('revoked_at IS NULL');
  });
});
