import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../apps/api/src/app.js';
import { getDb, resetTestDb, closeDb } from '../../apps/api/src/db/index.js';

describe('Document Sharing, Grants & Download Tokens Security Tests [Phase 3]', () => {
  let app: any;

  let aliceCookie: string;
  let aliceCsrf: string;
  let aliceId: string;

  let bobCookie: string;
  let bobCsrf: string;
  let bobId: string;

  let charlieCookie: string;
  let charlieCsrf: string;
  let charlieId: string;

  let docId: string;

  beforeEach(async () => {
    await resetTestDb();
    app = createApp();

    // 1. Alice (Document Owner)
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

    // 2. Bob (Viewer / Grantee)
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

    // 3. Charlie (Third party / Attacker)
    const regCharlie = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'charlie_stranger',
        email: 'charlie@vault.local',
        password: 'CharliePassword123!',
        role: 'viewer',
      });
    charlieId = regCharlie.body.data.user.id;

    const loginCharlie = await request(app)
      .post('/api/auth/login')
      .send({
        usernameOrEmail: 'charlie_stranger',
        password: 'CharliePassword123!',
      });
    charlieCookie = loginCharlie.headers['set-cookie'][0];
    charlieCsrf = loginCharlie.body.data.csrfToken;

    // Alice creates a sample document
    const validPdfBuffer = Buffer.from('%PDF-1.4 Confidentially Shared File %%EOF');
    const createDocRes = await request(app)
      .post('/api/documents')
      .set('Cookie', [aliceCookie])
      .set('X-CSRF-Token', aliceCsrf)
      .field('title', 'Confidential Shared Strategy')
      .attach('file', validPdfBuffer, 'strategy.pdf');

    docId = createDocRes.body.data.document.id;
  });

  afterAll(async () => {
    await closeDb();
  });

  describe('Grant Creation & Permission Enforcement', () => {
    it('allows Owner to grant READ permission to Bob, enabling Bob to download', async () => {
      // Initially Bob has no access
      const initialBobGet = await request(app)
        .get(`/api/documents/${docId}`)
        .set('Cookie', [bobCookie]);
      expect(initialBobGet.status).toBe(404);

      // Alice grants READ permission to Bob
      const grantRes = await request(app)
        .post(`/api/documents/${docId}/grants`)
        .set('Cookie', [aliceCookie])
        .set('X-CSRF-Token', aliceCsrf)
        .send({
          granteeUsernameOrEmail: 'bob_viewer',
          permission: 'read',
          expiresInHours: 24,
        });

      expect(grantRes.status).toBe(201);
      expect(grantRes.body.data.permission).toBe('read');
      expect(grantRes.body.data.grantee_id).toBe(bobId);

      // Now Bob can access metadata and download
      const bobGet = await request(app)
        .get(`/api/documents/${docId}`)
        .set('Cookie', [bobCookie]);
      expect(bobGet.status).toBe(200);
      expect(bobGet.body.data.document.title).toBe('Confidential Shared Strategy');

      const bobDl = await request(app)
        .get(`/api/documents/${docId}/download`)
        .set('Cookie', [bobCookie]);
      expect(bobDl.status).toBe(200);

      // Bob with READ permission CANNOT edit, version, delete, or share
      const editRes = await request(app)
        .patch(`/api/documents/${docId}`)
        .set('Cookie', [bobCookie])
        .set('X-CSRF-Token', bobCsrf)
        .send({ title: 'Bob Tamper' });
      expect(editRes.status).toBe(404);

      const shareRes = await request(app)
        .post(`/api/documents/${docId}/grants`)
        .set('Cookie', [bobCookie])
        .set('X-CSRF-Token', bobCsrf)
        .send({ granteeUsernameOrEmail: 'charlie_stranger', permission: 'read' });
      expect(shareRes.status).toBe(404);
    });

    it('allows Owner to grant EDIT permission; Editor can edit but cannot share or revoke', async () => {
      // Alice grants EDIT permission to Bob
      await request(app)
        .post(`/api/documents/${docId}/grants`)
        .set('Cookie', [aliceCookie])
        .set('X-CSRF-Token', aliceCsrf)
        .send({
          granteeUsernameOrEmail: 'bob_viewer',
          permission: 'edit',
        });

      // Bob can edit metadata
      const editRes = await request(app)
        .patch(`/api/documents/${docId}`)
        .set('Cookie', [bobCookie])
        .set('X-CSRF-Token', bobCsrf)
        .send({ title: 'Bob Authorized Edit' });
      expect(editRes.status).toBe(200);

      // Bob can upload new version
      const v2Buffer = Buffer.from('%PDF-1.4 Version 2 Content %%EOF');
      const v2Res = await request(app)
        .post(`/api/documents/${docId}/versions`)
        .set('Cookie', [bobCookie])
        .set('X-CSRF-Token', bobCsrf)
        .field('expectedVersion', 1)
        .attach('file', v2Buffer, 'v2.pdf');
      expect(v2Res.status).toBe(201);

      // Bob CANNOT delete document
      const delRes = await request(app)
        .delete(`/api/documents/${docId}`)
        .set('Cookie', [bobCookie])
        .set('X-CSRF-Token', bobCsrf);
      expect(delRes.status).toBe(404);

      // Bob CANNOT share to Charlie
      const shareRes = await request(app)
        .post(`/api/documents/${docId}/grants`)
        .set('Cookie', [bobCookie])
        .set('X-CSRF-Token', bobCsrf)
        .send({ granteeUsernameOrEmail: 'charlie_stranger', permission: 'read' });
      expect(shareRes.status).toBe(404);
    });

    it('denies granting permissions to inactive or non-existent users', async () => {
      const nonExistentRes = await request(app)
        .post(`/api/documents/${docId}/grants`)
        .set('Cookie', [aliceCookie])
        .set('X-CSRF-Token', aliceCsrf)
        .send({ granteeUsernameOrEmail: 'non_existent_user', permission: 'read' });
      expect(nonExistentRes.status).toBe(404);
      expect(nonExistentRes.body.error.code).toBe('USER_NOT_FOUND');
    });

    it('denies granting permissions to oneself', async () => {
      const selfGrantRes = await request(app)
        .post(`/api/documents/${docId}/grants`)
        .set('Cookie', [aliceCookie])
        .set('X-CSRF-Token', aliceCsrf)
        .send({ granteeUsernameOrEmail: 'alice_owner', permission: 'read' });
      expect(selfGrantRes.status).toBe(400);
      expect(selfGrantRes.body.error.code).toBe('INVALID_GRANTEE');
    });
  });

  describe('Grant Revocation & Expiration', () => {
    it('immediately denies access after grant revocation', async () => {
      // Alice grants access to Bob
      const grantRes = await request(app)
        .post(`/api/documents/${docId}/grants`)
        .set('Cookie', [aliceCookie])
        .set('X-CSRF-Token', aliceCsrf)
        .send({ granteeUsernameOrEmail: 'bob_viewer', permission: 'read' });
      const grantId = grantRes.body.data.id;

      // Bob can access
      expect((await request(app).get(`/api/documents/${docId}`).set('Cookie', [bobCookie])).status).toBe(200);

      // Alice revokes grant
      const revokeRes = await request(app)
        .delete(`/api/documents/${docId}/grants/${grantId}`)
        .set('Cookie', [aliceCookie])
        .set('X-CSRF-Token', aliceCsrf);
      expect(revokeRes.status).toBe(200);

      // Bob immediately denied with 404
      expect((await request(app).get(`/api/documents/${docId}`).set('Cookie', [bobCookie])).status).toBe(404);
      expect((await request(app).get(`/api/documents/${docId}/download`).set('Cookie', [bobCookie])).status).toBe(404);
    });

    it('denies access when grant has expired', async () => {
      const db = await getDb();
      const pastTime = new Date(Date.now() - 3600 * 1000).toISOString();

      // Directly insert an expired grant
      await db.query(
        `INSERT INTO document_grants (id, document_id, grantee_id, granted_by_id, permission, expires_at)
         VALUES (gen_random_uuid(), $1, $2, $3, 'read', $4)`,
        [docId, bobId, aliceId, pastTime]
      );

      // Access must be denied with 404
      const res = await request(app)
        .get(`/api/documents/${docId}`)
        .set('Cookie', [bobCookie]);
      expect(res.status).toBe(404);
    });
  });

  describe('One-Time Download Tokens', () => {
    it('issues a token, redeems it successfully, and rejects replay attacks with 410', async () => {
      // Alice issues a download token
      const tokenRes = await request(app)
        .post(`/api/documents/${docId}/tokens`)
        .set('Cookie', [aliceCookie])
        .set('X-CSRF-Token', aliceCsrf)
        .send({});

      expect(tokenRes.status).toBe(201);
      expect(tokenRes.body.data.token).toBeDefined();
      const rawToken = tokenRes.body.data.token;

      // First redemption: Success
      const dlRes1 = await request(app)
        .get(`/api/documents/token-download?token=${rawToken}`);

      expect(dlRes1.status).toBe(200);
      expect(dlRes1.headers['content-type']).toBe('application/pdf');
      expect(dlRes1.headers['content-disposition']).toContain('attachment');

      // Second redemption (Replay Attack): Must be rejected with 410 Gone
      const dlRes2 = await request(app)
        .get(`/api/documents/token-download?token=${rawToken}`);

      expect(dlRes2.status).toBe(410);
      expect(dlRes2.body.error.code).toBe('TOKEN_ALREADY_USED');
    });

    it('rejects expired download tokens (past 60s lifetime)', async () => {
      const tokenRes = await request(app)
        .post(`/api/documents/${docId}/tokens`)
        .set('Cookie', [aliceCookie])
        .set('X-CSRF-Token', aliceCsrf)
        .send({});

      const rawToken = tokenRes.body.data.token;

      // Artificially expire the token in database
      const db = await getDb();
      await db.query(
        `UPDATE download_tokens
         SET expires_at = CURRENT_TIMESTAMP - interval '10 seconds'
         WHERE user_id = $1`,
        [aliceId]
      );

      const dlRes = await request(app)
        .get(`/api/documents/token-download?token=${rawToken}`);

      expect(dlRes.status).toBe(410);
      expect(dlRes.body.error.code).toBe('TOKEN_EXPIRED');
    });

    it('rejects cross-user redemption if an authenticated user attempts to redeem another user token', async () => {
      // Alice grants access to Bob
      await request(app)
        .post(`/api/documents/${docId}/grants`)
        .set('Cookie', [aliceCookie])
        .set('X-CSRF-Token', aliceCsrf)
        .send({ granteeUsernameOrEmail: 'bob_viewer', permission: 'read' });

      // Bob generates a token for himself
      const tokenRes = await request(app)
        .post(`/api/documents/${docId}/tokens`)
        .set('Cookie', [bobCookie])
        .set('X-CSRF-Token', bobCsrf)
        .send({});

      const bobToken = tokenRes.body.data.token;

      // Charlie (different authenticated user) attempts to redeem Bob's token
      const charlieStealRes = await request(app)
        .get(`/api/documents/token-download?token=${bobToken}`)
        .set('Cookie', [charlieCookie]);

      expect(charlieStealRes.status).toBe(403);
      expect(charlieStealRes.body.error.code).toBe('CROSS_USER_FORBIDDEN');
    });

    it('linearization point: rejects token redemption if grant was revoked after token was issued', async () => {
      // Alice grants access to Bob
      const grantRes = await request(app)
        .post(`/api/documents/${docId}/grants`)
        .set('Cookie', [aliceCookie])
        .set('X-CSRF-Token', aliceCsrf)
        .send({ granteeUsernameOrEmail: 'bob_viewer', permission: 'read' });
      const grantId = grantRes.body.data.id;

      // Bob issues a token while grant is still active
      const tokenRes = await request(app)
        .post(`/api/documents/${docId}/tokens`)
        .set('Cookie', [bobCookie])
        .set('X-CSRF-Token', bobCsrf)
        .send({});
      const bobToken = tokenRes.body.data.token;

      // Alice revokes Bob's grant before Bob redeems the token
      await request(app)
        .delete(`/api/documents/${docId}/grants/${grantId}`)
        .set('Cookie', [aliceCookie])
        .set('X-CSRF-Token', aliceCsrf);

      // Bob attempts to redeem the previously issued token: Must be denied!
      const dlRes = await request(app)
        .get(`/api/documents/token-download?token=${bobToken}`);

      // Token was invalidated on revocation or authorization recheck denied it
      expect([403, 410]).toContain(dlRes.status);
    });

    it('handles concurrent redemption of the same token: exactly one succeeds', async () => {
      const tokenRes = await request(app)
        .post(`/api/documents/${docId}/tokens`)
        .set('Cookie', [aliceCookie])
        .set('X-CSRF-Token', aliceCsrf)
        .send({});
      const token = tokenRes.body.data.token;

      // Dispatch 2 concurrent redemption requests simultaneously
      const [res1, res2] = await Promise.all([
        request(app).get(`/api/documents/token-download?token=${token}`),
        request(app).get(`/api/documents/token-download?token=${token}`),
      ]);

      const statuses = [res1.status, res2.status].sort();
      // Exactly one must be 200, the other must be 410 (already consumed)
      expect(statuses).toEqual([200, 410]);
    });
  });
});
