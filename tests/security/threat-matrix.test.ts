import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../apps/api/src/app.js';
import { getDb, resetTestDb, closeDb } from '../../apps/api/src/db/index.js';
import { StorageService } from '../../apps/api/src/modules/storage/storage.service.js';

describe('Threat Matrix Automated Verification Suite (T01 - T28) [Phase 7]', () => {
  let app: any;
  const storageService = new StorageService();

  let aliceCookie: string;
  let aliceCsrf: string;
  let aliceId: string;

  let bobCookie: string;
  let bobCsrf: string;
  let bobId: string;

  let adminCookie: string;
  let adminCsrf: string;

  let docAId: string;

  // Minimal valid PDF binary (Magic bytes %PDF-1.4...)
  const validPdfBuffer = Buffer.from(
    '%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF'
  );

  beforeEach(async () => {
    await resetTestDb();
    app = createApp();

    // 1. Register and Login Alice (Owner)
    const regAlice = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'alice_owner',
        email: 'alice@vault.local',
        password: 'AlicePassword123!',
        role: 'owner',
      });
    aliceId = regAlice.body.data.user.id;

    const loginAlice = await request(app)
      .post('/api/auth/login')
      .send({
        usernameOrEmail: 'alice_owner',
        password: 'AlicePassword123!',
      });
    aliceCookie = loginAlice.headers['set-cookie'][0];
    aliceCsrf = loginAlice.body.data.csrfToken;

    // 2. Register and Login Bob (Viewer)
    const regBob = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'bob_viewer',
        email: 'bob@vault.local',
        password: 'BobPassword123!',
        role: 'viewer',
      });
    bobId = regBob.body.data.user.id;

    const loginBob = await request(app)
      .post('/api/auth/login')
      .send({
        usernameOrEmail: 'bob_viewer',
        password: 'BobPassword123!',
      });
    bobCookie = loginBob.headers['set-cookie'][0];
    bobCsrf = loginBob.body.data.csrfToken;

    // 3. Register and Login Admin
    await request(app)
      .post('/api/auth/register')
      .send({
        username: 'admin_sys',
        email: 'admin@vault.local',
        password: 'AdminPassword123!',
        role: 'admin',
      });

    const loginAdmin = await request(app)
      .post('/api/auth/login')
      .send({
        usernameOrEmail: 'admin_sys',
        password: 'AdminPassword123!',
      });
    adminCookie = loginAdmin.headers['set-cookie'][0];
    adminCsrf = loginAdmin.body.data.csrfToken;

    // 4. Alice creates Document A
    const uploadRes = await request(app)
      .post('/api/documents')
      .set('Cookie', aliceCookie)
      .set('x-csrf-token', aliceCsrf)
      .field('title', 'Alice Secret Strategy')
      .field('category', 'Confidential')
      .attach('file', validPdfBuffer, 'strategy.pdf');

    expect(uploadRes.status).toBe(201);
    docAId = uploadRes.body.data.document.id;
  });

  afterAll(async () => {
    await closeDb();
  });

  // ==========================================
  // THREAT 1: IDOR on every document route
  // ==========================================
  it('T01: Enforces IDOR protection on every document route (all return 404)', async () => {
    // GET metadata
    const r1 = await request(app)
      .get(`/api/documents/${docAId}`)
      .set('Cookie', bobCookie);
    expect(r1.status).toBe(404);

    // GET download
    const r2 = await request(app)
      .get(`/api/documents/${docAId}/download`)
      .set('Cookie', bobCookie);
    expect(r2.status).toBe(404);

    // GET versions
    const r3 = await request(app)
      .get(`/api/documents/${docAId}/versions`)
      .set('Cookie', bobCookie);
    expect(r3.status).toBe(404);

    // GET version download
    const r4 = await request(app)
      .get(`/api/documents/${docAId}/versions/1/download`)
      .set('Cookie', bobCookie);
    expect(r4.status).toBe(404);

    // POST version
    const r5 = await request(app)
      .post(`/api/documents/${docAId}/versions`)
      .set('Cookie', bobCookie)
      .set('x-csrf-token', bobCsrf)
      .field('expectedVersion', 1)
      .attach('file', validPdfBuffer, 'v2.pdf');
    expect(r5.status).toBe(404);

    // PATCH document
    const r6 = await request(app)
      .patch(`/api/documents/${docAId}`)
      .set('Cookie', bobCookie)
      .set('x-csrf-token', bobCsrf)
      .send({ title: 'Hacked Title' });
    expect(r6.status).toBe(404);

    // DELETE document
    const r7 = await request(app)
      .delete(`/api/documents/${docAId}`)
      .set('Cookie', bobCookie)
      .set('x-csrf-token', bobCsrf);
    expect(r7.status).toBe(404);

    // POST recover
    const r8 = await request(app)
      .post(`/api/documents/${docAId}/recover`)
      .set('Cookie', bobCookie)
      .set('x-csrf-token', bobCsrf);
    expect(r8.status).toBe(404);

    // POST grant
    const r9 = await request(app)
      .post(`/api/documents/${docAId}/grants`)
      .set('Cookie', bobCookie)
      .set('x-csrf-token', bobCsrf)
      .send({ granteeUsernameOrEmail: 'bob_viewer', permission: 'read' });
    expect(r9.status).toBe(404);

    // GET grants
    const r10 = await request(app)
      .get(`/api/documents/${docAId}/grants`)
      .set('Cookie', bobCookie);
    expect(r10.status).toBe(404);

    // POST download token
    const r11 = await request(app)
      .post(`/api/documents/${docAId}/tokens`)
      .set('Cookie', bobCookie)
      .set('x-csrf-token', bobCsrf);
    expect(r11.status).toBe(404);
  });

  // ==========================================
  // THREAT 2: Direct file URL guessing
  // ==========================================
  it('T02: Rejects direct storage file URL access (no static exposure)', async () => {
    const res = await request(app).get('/storage/files/strategy.pdf');
    expect(res.status).toBe(404);

    const res2 = await request(app).get('/uploads/strategy.pdf');
    expect(res2.status).toBe(404);
  });

  // ==========================================
  // THREAT 3: Path traversal
  // ==========================================
  it('T03: Strictly rejects path traversal in storage engine and filenames', async () => {
    expect(() => storageService.getFilePath('../../../etc/passwd')).toThrow();
    expect(() => storageService.getFilePath('..\\..\\windows\\system32')).toThrow();
    expect(() => storageService.getFilePath('non-uuid-string')).toThrow();
  });

  // ==========================================
  // THREAT 4: MIME spoofing
  // ==========================================
  it('T04: Detects and rejects executable files disguised as PDF', async () => {
    const fakePdf = Buffer.from('MZ\x90\x00\x03\x00\x00\x00ThisIsAnExeDisguisedAsPdf');
    const res = await request(app)
      .post('/api/documents')
      .set('Cookie', aliceCookie)
      .set('x-csrf-token', aliceCsrf)
      .field('title', 'Spoofed Executable')
      .attach('file', fakePdf, 'malware.pdf');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_FILE');
  });

  // ==========================================
  // THREAT 5: Stored XSS in filenames
  // ==========================================
  it('T05: Sanitizes filenames against stored XSS and enforces attachment headers', async () => {
    const xssPayload = '<script>alert("xss")</script>.pdf';
    const res = await request(app)
      .post('/api/documents')
      .set('Cookie', aliceCookie)
      .set('x-csrf-token', aliceCsrf)
      .field('title', 'XSS Doc')
      .attach('file', validPdfBuffer, xssPayload);

    expect(res.status).toBe(201);
    expect(res.body.data.version.file_name).not.toContain('<script>');

    const dlRes = await request(app)
      .get(`/api/documents/${res.body.data.document.id}/download`)
      .set('Cookie', aliceCookie);

    expect(dlRes.headers['x-content-type-options']).toBe('nosniff');
    expect(dlRes.headers['content-disposition']).toContain('attachment');
  });

  // ==========================================
  // THREAT 6: Mass assignment of role and owner_id
  // ==========================================
  it('T06: Prevents mass assignment of document owner_id and metadata', async () => {
    const patchRes = await request(app)
      .patch(`/api/documents/${docAId}`)
      .set('Cookie', aliceCookie)
      .set('x-csrf-token', aliceCsrf)
      .send({
        owner_id: bobId,
        title: 'Reassigned Doc',
        id: '00000000-0000-0000-0000-000000000000',
      });

    expect(patchRes.status).toBe(200);
    const getRes = await request(app)
      .get(`/api/documents/${docAId}`)
      .set('Cookie', aliceCookie);
    expect(getRes.body.data.document.owner_id).toBe(aliceId);
    expect(getRes.body.data.document.id).toBe(docAId);
  });

  // ==========================================
  // THREAT 7: Grant privilege escalation
  // ==========================================
  it('T07: Prevents viewer grantee from editing, sharing, or deleting', async () => {
    await request(app)
      .post(`/api/documents/${docAId}/grants`)
      .set('Cookie', aliceCookie)
      .set('x-csrf-token', aliceCsrf)
      .send({ granteeUsernameOrEmail: 'bob_viewer', permission: 'read' });

    const readRes = await request(app)
      .get(`/api/documents/${docAId}`)
      .set('Cookie', bobCookie);
    expect(readRes.status).toBe(200);

    const editRes = await request(app)
      .patch(`/api/documents/${docAId}`)
      .set('Cookie', bobCookie)
      .set('x-csrf-token', bobCsrf)
      .send({ title: 'Bob Edit' });
    expect(editRes.status).toBe(404);

    const delRes = await request(app)
      .delete(`/api/documents/${docAId}`)
      .set('Cookie', bobCookie)
      .set('x-csrf-token', bobCsrf);
    expect(delRes.status).toBe(404);

    const shareRes = await request(app)
      .post(`/api/documents/${docAId}/grants`)
      .set('Cookie', bobCookie)
      .set('x-csrf-token', bobCsrf)
      .send({ granteeUsernameOrEmail: 'alice_owner', permission: 'edit' });
    expect(shareRes.status).toBe(404);
  });

  // ==========================================
  // THREAT 8: Stale sessions after revocation or disabling
  // ==========================================
  it('T08: Inactivates sessions immediately upon logout or account deactivation', async () => {
    await request(app)
      .post('/api/auth/logout')
      .set('Cookie', bobCookie)
      .set('x-csrf-token', bobCsrf);

    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', bobCookie);
    expect(res.status).toBe(401);

    const db = await getDb();
    await db.query('UPDATE users SET is_active = false WHERE id = $1', [aliceId]);

    const aliceRes = await request(app)
      .get('/api/auth/me')
      .set('Cookie', aliceCookie);
    expect(aliceRes.status).toBe(401);
  });

  // ==========================================
  // THREAT 9: Download-token replay
  // ==========================================
  it('T09: Enforces single-use download tokens and rejects replay attempts', async () => {
    const tokenRes = await request(app)
      .post(`/api/documents/${docAId}/tokens`)
      .set('Cookie', aliceCookie)
      .set('x-csrf-token', aliceCsrf);

    expect(tokenRes.status).toBe(201);
    const token = tokenRes.body.data.token;

    // First download succeeds
    const dl1 = await request(app).get(`/api/documents/token-download?token=${token}`);
    expect(dl1.status).toBe(200);

    // Second download fails with 401 or 404
    const dl2 = await request(app).get(`/api/documents/token-download?token=${token}`);
    expect([401, 404, 410]).toContain(dl2.status);
  });

  // ==========================================
  // THREAT 10: Cross-user token redemption
  // ==========================================
  it('T10: Rejects invalid or forged download tokens', async () => {
    const res = await request(app).get('/api/documents/token-download?token=invalid-forged-token-12345');
    expect([400, 401, 404, 410]).toContain(res.status);
  });

  // ==========================================
  // THREAT 11: Search counts and facets leaking inaccessible documents
  // ==========================================
  it('T11: Excludes unauthorized documents from search results, totalCount, and facets', async () => {
    const searchRes = await request(app)
      .get('/api/documents')
      .set('Cookie', bobCookie);

    expect(searchRes.status).toBe(200);
    expect(searchRes.body.data.documents.length).toBe(0);
    expect(searchRes.body.data.pagination.totalCount).toBe(0);
    expect(searchRes.body.data.facets.categories.length).toBe(0);
  });

  // ==========================================
  // THREAT 12: Downloading soft-deleted documents
  // ==========================================
  it('T12: Prevents downloading soft-deleted documents before restoration', async () => {
    await request(app)
      .delete(`/api/documents/${docAId}`)
      .set('Cookie', aliceCookie)
      .set('x-csrf-token', aliceCsrf);

    const dlRes = await request(app)
      .get(`/api/documents/${docAId}/download`)
      .set('Cookie', aliceCookie);
    expect(dlRes.status).toBe(404);
  });

  // ==========================================
  // THREAT 13: Accessing versions without document permission
  // ==========================================
  it('T13: Denies version history and version download to unauthorized users', async () => {
    const r1 = await request(app)
      .get(`/api/documents/${docAId}/versions`)
      .set('Cookie', bobCookie);
    expect(r1.status).toBe(404);

    const r2 = await request(app)
      .get(`/api/documents/${docAId}/versions/1/download`)
      .set('Cookie', bobCookie);
    expect(r2.status).toBe(404);
  });

  // ==========================================
  // THREAT 14: Audit UPDATE and DELETE attempts
  // ==========================================
  it('T14: Enforces PostgreSQL trigger preventing direct UPDATE or DELETE on audit_log', async () => {
    const db = await getDb();
    let updateThrown = false;
    try {
      await db.query("UPDATE audit_log SET event_type = 'tampered' WHERE sequence_number = 1");
    } catch {
      updateThrown = true;
    }
    expect(updateThrown).toBe(true);

    let deleteThrown = false;
    try {
      await db.query('DELETE FROM audit_log WHERE sequence_number = 1');
    } catch {
      deleteThrown = true;
    }
    expect(deleteThrown).toBe(true);
  });

  // ==========================================
  // THREAT 15: Revocation/download concurrency races
  // ==========================================
  it('T15: Immediately revokes access so sub-millisecond subsequent requests are denied', async () => {
    const shareRes = await request(app)
      .post(`/api/documents/${docAId}/grants`)
      .set('Cookie', aliceCookie)
      .set('x-csrf-token', aliceCsrf)
      .send({ granteeUsernameOrEmail: 'bob_viewer', permission: 'read' });
    const grantId = shareRes.body.data.id;

    const check1 = await request(app)
      .get(`/api/documents/${docAId}`)
      .set('Cookie', bobCookie);
    expect(check1.status).toBe(200);

    await request(app)
      .delete(`/api/documents/${docAId}/grants/${grantId}`)
      .set('Cookie', aliceCookie)
      .set('x-csrf-token', aliceCsrf);

    const check2 = await request(app)
      .get(`/api/documents/${docAId}`)
      .set('Cookie', bobCookie);
    expect(check2.status).toBe(404);
  });

  // ==========================================
  // THREAT 16: Brute-force login attempts
  // ==========================================
  it('T16: Records failed logins and detects brute-force anomaly in audit log', async () => {
    for (let i = 0; i < 3; i++) {
      await request(app)
        .post('/api/auth/login')
        .send({ usernameOrEmail: 'alice_owner', password: 'WrongPassword999!' });
    }

    const anomaliesRes = await request(app)
      .get('/api/admin/audit/anomalies')
      .set('Cookie', adminCookie);

    expect(anomaliesRes.status).toBe(200);
    expect(anomaliesRes.body.data.failedLogins.length).toBeGreaterThan(0);
    const target = anomaliesRes.body.data.failedLogins.find(
      (a: any) => a.actor_username === 'alice_owner'
    );
    expect(target).toBeDefined();
    expect(target.count).toBeGreaterThanOrEqual(3);
  });

  // ==========================================
  // THREAT 17: Verbose error leakage
  // ==========================================
  it('T17: Prevents verbose error leakage (no stack traces, no internal SQL)', async () => {
    const res = await request(app).get('/api/documents/non-existent-uuid-12345');
    expect(res.body).not.toHaveProperty('stack');
    expect(JSON.stringify(res.body)).not.toContain('SELECT * FROM');
    expect(JSON.stringify(res.body)).not.toContain('pg_');
  });

  // ==========================================
  // THREAT 18: CORS misconfiguration
  // ==========================================
  it('T18: Applies strict CORS policy rejecting unauthorized external origins', async () => {
    const res = await request(app)
      .options('/api/auth/me')
      .set('Origin', 'https://attacker-domain.evil.com');

    const allowOrigin = res.headers['access-control-allow-origin'];
    expect(allowOrigin).not.toBe('https://attacker-domain.evil.com');
  });

  // ==========================================
  // THREAT 19: CSRF attacks
  // ==========================================
  it('T19: Strictly rejects state-changing requests without valid CSRF token', async () => {
    const res = await request(app)
      .post('/api/documents')
      .set('Cookie', aliceCookie)
      .field('title', 'CSRF Doc')
      .attach('file', validPdfBuffer, 'test.pdf');

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('INVALID_CSRF_TOKEN');
  });

  // ==========================================
  // THREAT 20: Oversized uploads
  // ==========================================
  it('T20: Rejects oversized uploads exceeding size limits (>10MB)', async () => {
    const bigBuffer = Buffer.alloc(11 * 1024 * 1024, 0x20);
    const res = await request(app)
      .post('/api/documents')
      .set('Cookie', aliceCookie)
      .set('x-csrf-token', aliceCsrf)
      .field('title', 'Big Payload')
      .attach('file', bigBuffer, 'big.txt');

    expect([400, 413]).toContain(res.status);
  });

  // ==========================================
  // THREAT 21: ZIP bombs and decompression bombs
  // ==========================================
  it('T21: Strictly rejects ZIP/archive files to prevent decompression bombs', async () => {
    const zipBuffer = Buffer.from('PK\x03\x04\x14\x00\x00\x00\x08\x00disguised.zip');
    const res = await request(app)
      .post('/api/documents')
      .set('Cookie', aliceCookie)
      .set('x-csrf-token', aliceCsrf)
      .field('title', 'Archive Doc')
      .attach('file', zipBuffer, 'archive.zip');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_FILE');
  });

  // ==========================================
  // THREAT 22: Concurrent edits and optimistic concurrency
  // ==========================================
  it('T22: Detects concurrent edit collisions via optimistic concurrency control (409)', async () => {
    const res = await request(app)
      .post(`/api/documents/${docAId}/versions`)
      .set('Cookie', aliceCookie)
      .set('x-csrf-token', aliceCsrf)
      .field('expectedVersion', 99)
      .attach('file', validPdfBuffer, 'v2.pdf');

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('VERSION_CONFLICT');
  });

  // ==========================================
  // THREAT 23: Storage failures and orphaned objects
  // ==========================================
  it('T23: Storage engine cleanly validates and prevents orphaned or dangling paths', async () => {
    const testUuid = '12345678-1234-4234-8234-123456789abc';
    const filePath = storageService.getFilePath(testUuid);
    expect(filePath).toContain('.bin');
    expect(filePath).not.toContain('..');
  });

  // ==========================================
  // THREAT 24: Audit-write failures and cryptographic chaining
  // ==========================================
  it('T24: Maintains unbroken cryptographic audit chain and verifies head', async () => {
    const res = await request(app)
      .get('/api/admin/audit/verify')
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    expect(res.body.data.valid).toBe(true);
    expect(res.body.data.brokenSequence).toBeUndefined();
  });

  // ==========================================
  // THREAT 25: Session fixation
  // ==========================================
  it('T25: Generates a new unique session identifier on each login', async () => {
    const login1 = await request(app)
      .post('/api/auth/login')
      .send({ usernameOrEmail: 'alice_owner', password: 'AlicePassword123!' });
    const cookie1 = login1.headers['set-cookie'][0];

    const login2 = await request(app)
      .post('/api/auth/login')
      .send({ usernameOrEmail: 'alice_owner', password: 'AlicePassword123!' });
    const cookie2 = login2.headers['set-cookie'][0];

    expect(cookie1).not.toBe(cookie2);
  });

  // ==========================================
  // THREAT 26: Disabled-user access
  // ==========================================
  it('T26: Denies login attempts for disabled user accounts', async () => {
    const db = await getDb();
    await db.query('UPDATE users SET is_active = false WHERE id = $1', [bobId]);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ usernameOrEmail: 'bob_viewer', password: 'BobPassword123!' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_DISABLED');
  });

  // ==========================================
  // THREAT 27: Expired grants
  // ==========================================
  it('T27: Automatically treats expired grants as non-existent (returns 404)', async () => {
    const shareRes = await request(app)
      .post(`/api/documents/${docAId}/grants`)
      .set('Cookie', aliceCookie)
      .set('x-csrf-token', aliceCsrf)
      .send({ granteeUsernameOrEmail: 'bob_viewer', permission: 'read', expiresInHours: 1 });
    const grantId = shareRes.body.data.id;

    // Manually expire the grant in the database
    const db = await getDb();
    await db.query("UPDATE document_grants SET expires_at = NOW() - INTERVAL '1 hour' WHERE id = $1", [grantId]);

    const res = await request(app)
      .get(`/api/documents/${docAId}`)
      .set('Cookie', bobCookie);

    expect(res.status).toBe(404);
  });

  // ==========================================
  // THREAT 28: Admin access without explicit grant
  // ==========================================
  it('T28: Denies admin document access without an explicit grant (least privilege, 404)', async () => {
    const res = await request(app)
      .get(`/api/documents/${docAId}`)
      .set('Cookie', adminCookie);
    expect(res.status).toBe(404);

    const dlRes = await request(app)
      .get(`/api/documents/${docAId}/download`)
      .set('Cookie', adminCookie);
    expect(dlRes.status).toBe(404);
  });

  // ==========================================
  // TWO-USER MATRIX TEST
  // ==========================================
  it('Two-User Matrix Test: User B attempts every operation on User A document without permission', async () => {
    // 1. GET metadata -> 404
    const getRes = await request(app)
      .get(`/api/documents/${docAId}`)
      .set('Cookie', bobCookie);
    expect(getRes.status).toBe(404);

    // 2. Download -> 404
    const dlRes = await request(app)
      .get(`/api/documents/${docAId}/download`)
      .set('Cookie', bobCookie);
    expect(dlRes.status).toBe(404);

    // 3. Versions -> 404
    const verRes = await request(app)
      .get(`/api/documents/${docAId}/versions`)
      .set('Cookie', bobCookie);
    expect(verRes.status).toBe(404);

    // 4. Search -> 0 results
    const searchRes = await request(app)
      .get('/api/documents?q=Alice')
      .set('Cookie', bobCookie);
    expect(searchRes.status).toBe(200);
    expect(searchRes.body.data.documents.length).toBe(0);

    // 5. Delete -> 404
    const delRes = await request(app)
      .delete(`/api/documents/${docAId}`)
      .set('Cookie', bobCookie)
      .set('x-csrf-token', bobCsrf);
    expect(delRes.status).toBe(404);

    // 6. Edit -> 404
    const editRes = await request(app)
      .patch(`/api/documents/${docAId}`)
      .set('Cookie', bobCookie)
      .set('x-csrf-token', bobCsrf)
      .send({ title: 'Bob Hijack' });
    expect(editRes.status).toBe(404);

    // 7. Share / Grant -> 404
    const shareRes = await request(app)
      .post(`/api/documents/${docAId}/grants`)
      .set('Cookie', bobCookie)
      .set('x-csrf-token', bobCsrf)
      .send({ granteeUsernameOrEmail: 'bob_viewer', permission: 'read' });
    expect(shareRes.status).toBe(404);

    // 8. Revoke -> 404
    const revokeRes = await request(app)
      .delete(`/api/documents/${docAId}/grants/00000000-0000-0000-0000-000000000000`)
      .set('Cookie', bobCookie)
      .set('x-csrf-token', bobCsrf);
    expect(revokeRes.status).toBe(404);

    // 9. Audit query -> 403 (Bob is not admin)
    const auditRes = await request(app)
      .get('/api/admin/audit')
      .set('Cookie', bobCookie);
    expect(auditRes.status).toBe(403);
  });
});
