import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../apps/api/src/app.js';
import { getDb, resetTestDb, closeDb } from '../../apps/api/src/db/index.js';
import { AuditService, GENESIS_HASH } from '../../apps/api/src/modules/audit/audit.service.js';
import { AuditEventType, AuditOutcome } from '@trustvault/shared';

describe('Append-Only Cryptographic Audit Log & Admin Dashboard Security Tests [Phase 4]', () => {
  let app: any;

  let adminCookie: string;
  let adminCsrf: string;
  let adminId: string;

  let ownerCookie: string;
  let ownerCsrf: string;
  let ownerId: string;

  let viewerCookie: string;
  let viewerCsrf: string;
  let viewerId: string;

  let sampleDocId: string;

  beforeEach(async () => {
    await resetTestDb();
    app = createApp();

    // 1. Admin User
    const regAdmin = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'admin_security',
        email: 'admin@vault.local',
        password: 'AdminPassword123!',
        role: 'admin',
      });
    adminId = regAdmin.body.data.user.id;

    const loginAdmin = await request(app)
      .post('/api/auth/login')
      .send({
        usernameOrEmail: 'admin_security',
        password: 'AdminPassword123!',
      });
    adminCookie = loginAdmin.headers['set-cookie'][0];
    adminCsrf = loginAdmin.body.data.csrfToken;

    // 2. Owner User
    const regOwner = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'alice_owner',
        email: 'alice@vault.local',
        password: 'AlicePassword123!',
        role: 'owner',
      });
    ownerId = regOwner.body.data.user.id;

    const loginOwner = await request(app)
      .post('/api/auth/login')
      .send({
        usernameOrEmail: 'alice_owner',
        password: 'AlicePassword123!',
      });
    ownerCookie = loginOwner.headers['set-cookie'][0];
    ownerCsrf = loginOwner.body.data.csrfToken;

    // 3. Viewer User
    const regViewer = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'bob_viewer',
        email: 'bob@vault.local',
        password: 'BobPassword123!',
        role: 'viewer',
      });
    viewerId = regViewer.body.data.user.id;

    const loginViewer = await request(app)
      .post('/api/auth/login')
      .send({
        usernameOrEmail: 'bob_viewer',
        password: 'BobPassword123!',
      });
    viewerCookie = loginViewer.headers['set-cookie'][0];
    viewerCsrf = loginViewer.body.data.csrfToken;

    // 4. Create sample document uploaded by Owner
    const validPdfBuffer = Buffer.concat([
      Buffer.from('%PDF-1.7\n', 'utf8'),
      Buffer.from('Security Audit Verification Document', 'utf8'),
      Buffer.from('\n%%EOF', 'utf8'),
    ]);

    const uploadRes = await request(app)
      .post('/api/documents')
      .set('Cookie', ownerCookie)
      .set('x-csrf-token', ownerCsrf)
      .field('title', 'Financial Quarterly Report')
      .field('category', 'Finance')
      .attach('file', validPdfBuffer, 'Q3_Financials.pdf');

    sampleDocId = uploadRes.body.data.document.id;
  });

  afterAll(async () => {
    await closeDb();
  });

  describe('Database-Level Append-Only Immutability Defense', () => {
    it('strictly forbids UPDATE operations on audit_log via PostgreSQL trigger', async () => {
      const db = await getDb();

      // Ensure at least one audit record exists
      const rowsRes = await db.query('SELECT sequence_number FROM audit_log LIMIT 1');
      expect(rowsRes.rows.length).toBeGreaterThan(0);
      const seq = rowsRes.rows[0].sequence_number;

      // Attempt direct SQL UPDATE on the immutable audit log table
      let errorThrown = false;
      try {
        await db.query(
          `UPDATE audit_log SET event_type = 'auth.login.tampered' WHERE sequence_number = $1`,
          [seq]
        );
      } catch (err: any) {
        errorThrown = true;
        expect(err.message).toMatch(/Security Violation: audit_log records are strictly immutable and cannot be updated/i);
      }

      expect(errorThrown).toBe(true);
    });

    it('strictly forbids DELETE operations on audit_log via PostgreSQL trigger', async () => {
      const db = await getDb();

      const rowsRes = await db.query('SELECT sequence_number FROM audit_log LIMIT 1');
      expect(rowsRes.rows.length).toBeGreaterThan(0);
      const seq = rowsRes.rows[0].sequence_number;

      // Attempt direct SQL DELETE on the immutable audit log table
      let errorThrown = false;
      try {
        await db.query(`DELETE FROM audit_log WHERE sequence_number = $1`, [seq]);
      } catch (err: any) {
        errorThrown = true;
        expect(err.message).toMatch(/Security Violation: audit_log records are strictly immutable and cannot be deleted/i);
      }

      expect(errorThrown).toBe(true);
    });
  });

  describe('Cryptographic Hash Chaining & Chain Verification', () => {
    it('verifies untampered chain from Genesis to Head successfully', async () => {
      const res = await request(app)
        .get('/api/admin/audit/verify')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.valid).toBe(true);
      expect(res.body.data.recordCount).toBeGreaterThan(0);
      expect(res.body.data.genesisHash).toBe(GENESIS_HASH);
      expect(res.body.data.headHash).toHaveLength(64);
    });

    it('enforces previous_hash mathematical continuity across all sequence numbers', async () => {
      const db = await getDb();
      const logsRes = await db.query<any>(
        `SELECT sequence_number, previous_hash, current_hash
         FROM audit_log
         ORDER BY sequence_number ASC`
      );

      const records = logsRes.rows;
      expect(records.length).toBeGreaterThan(1);

      // Genesis record check
      expect(Number(records[0].sequence_number)).toBe(1);
      expect(records[0].previous_hash).toBe(GENESIS_HASH);

      // Verify chain link for every record i > 0
      for (let i = 1; i < records.length; i++) {
        expect(records[i].previous_hash).toBe(records[i - 1].current_hash);
      }
    });

    it('detects tampering and identifies exact sequence number if payload is modified', async () => {
      const db = await getDb();

      // Temporarily disable the immutability trigger to simulate an attacker/disk corruption
      await db.query(`ALTER TABLE audit_log DISABLE TRIGGER trg_audit_log_immutable;`);

      // Tamper with record #2 details
      await db.query(
        `UPDATE audit_log
         SET details = '{"tampered_by_adversary": true}'
         WHERE sequence_number = 2`
      );

      // Re-enable trigger
      await db.query(`ALTER TABLE audit_log ENABLE TRIGGER trg_audit_log_immutable;`);

      // Call verification endpoint
      const res = await request(app)
        .get('/api/admin/audit/verify')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.valid).toBe(false);
      expect(res.body.data.brokenSequence).toBe(2);
      expect(res.body.data.error).toContain('Tamper detected: content hash mismatch at sequence #2');
    });

    it('detects tampering if a sequence number is deleted or skipped', async () => {
      const db = await getDb();

      // Temporarily disable trigger
      await db.query(`ALTER TABLE audit_log DISABLE TRIGGER trg_audit_log_immutable;`);

      // Delete record #2 to create sequence gap: 1, 3, 4...
      await db.query(`DELETE FROM audit_log WHERE sequence_number = 2`);

      // Re-enable trigger
      await db.query(`ALTER TABLE audit_log ENABLE TRIGGER trg_audit_log_immutable;`);

      // Call verification endpoint
      const res = await request(app)
        .get('/api/admin/audit/verify')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.valid).toBe(false);
      expect(res.body.data.brokenSequence).toBe(3);
      expect(res.body.data.error).toContain('Broken sequence continuity: expected #2, found #3');
    });
  });

  describe('Admin Authorization Boundary & Principle of Least Privilege', () => {
    it('denies unauthenticated access to audit endpoints with 401', async () => {
      const res = await request(app).get('/api/admin/audit/verify');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('denies viewer role access to audit endpoints with 403', async () => {
      const res = await request(app)
        .get('/api/admin/audit/verify')
        .set('Cookie', viewerCookie);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('denies owner role access to audit endpoints with 403', async () => {
      const res = await request(app)
        .get('/api/admin/audit')
        .set('Cookie', ownerCookie);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('LEAST PRIVILEGE: Admin CANNOT view or download document contents without explicit grant (returns 404)', async () => {
      // Admin attempts to get Alice's document metadata
      const metaRes = await request(app)
        .get(`/api/documents/${sampleDocId}`)
        .set('Cookie', adminCookie);

      expect(metaRes.status).toBe(404);
      expect(metaRes.body.error.code).toBe('NOT_FOUND');

      // Admin attempts to download Alice's document
      const downloadRes = await request(app)
        .get(`/api/documents/${sampleDocId}/download`)
        .set('Cookie', adminCookie);

      expect(downloadRes.status).toBe(404);
      expect(downloadRes.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('Security Anomaly Detection Engine', () => {
    it('detects repeated failed logins as a brute-force anomaly', async () => {
      // Trigger 3 failed logins for target user
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({
            usernameOrEmail: 'alice_owner',
            password: 'WrongPassword999!',
          });
      }

      const res = await request(app)
        .get('/api/admin/audit/anomalies')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.failedLogins.length).toBeGreaterThan(0);

      const target = res.body.data.failedLogins.find((a: any) => a.actor_username === 'alice_owner');
      expect(target).toBeDefined();
      expect(target.count).toBeGreaterThanOrEqual(3);
    });

    it('detects repeated denied access attempts as an IDOR/probing anomaly', async () => {
      // Bob probes Alice's document 3 times (each denied with 404/ACCESS_DENIED)
      for (let i = 0; i < 3; i++) {
        await request(app)
          .get(`/api/documents/${sampleDocId}/download`)
          .set('Cookie', viewerCookie);
      }

      const res = await request(app)
        .get('/api/admin/audit/anomalies')
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.repeatedDeniedAttempts.length).toBeGreaterThan(0);

      const bobAnomaly = res.body.data.repeatedDeniedAttempts.find(
        (a: any) => a.actor_username === 'bob_viewer'
      );
      expect(bobAnomaly).toBeDefined();
      expect(bobAnomaly.count).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Audit Query & Traceability across User Lifecycle', () => {
    it('queries audit logs with eventType filter and verifies document creation event', async () => {
      const res = await request(app)
        .get(`/api/admin/audit?eventType=${AuditEventType.DOCUMENT_CREATE}`)
        .set('Cookie', adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.records.length).toBeGreaterThan(0);

      const creationRecord = res.body.data.records[0];
      expect(creationRecord.event_type).toBe(AuditEventType.DOCUMENT_CREATE);
      expect(creationRecord.actor_id).toBe(ownerId);
      expect(creationRecord.actor_username).toBe('alice_owner');
      expect(creationRecord.target_id).toBe(sampleDocId);
      expect(creationRecord.outcome).toBe(AuditOutcome.SUCCESS);
      expect(creationRecord.previous_hash).toHaveLength(64);
      expect(creationRecord.current_hash).toHaveLength(64);
    });

    it('records document sharing grants and grant revocation in the audit chain', async () => {
      // 1. Alice grants READ to Bob
      const grantRes = await request(app)
        .post(`/api/documents/${sampleDocId}/grants`)
        .set('Cookie', ownerCookie)
        .set('x-csrf-token', ownerCsrf)
        .send({
          granteeUsernameOrEmail: 'bob_viewer',
          permission: 'read',
          expiresInHours: 24,
        });

      expect(grantRes.status).toBe(201);
      const grantId = grantRes.body.data.id;

      // 2. Alice revokes grant
      const revokeRes = await request(app)
        .delete(`/api/documents/${sampleDocId}/grants/${grantId}`)
        .set('Cookie', ownerCookie)
        .set('x-csrf-token', ownerCsrf);

      expect(revokeRes.status).toBe(200);

      // 3. Query audit logs for grant events
      const auditGrants = await request(app)
        .get(`/api/admin/audit?eventType=${AuditEventType.GRANT_CREATE}`)
        .set('Cookie', adminCookie);

      expect(auditGrants.body.data.records.length).toBeGreaterThan(0);
      const grantRecord = auditGrants.body.data.records[0];
      expect(grantRecord.actor_id).toBe(ownerId);
      expect(grantRecord.target_id).toBe(grantId);

      const auditRevokes = await request(app)
        .get(`/api/admin/audit?eventType=${AuditEventType.GRANT_REVOKE}`)
        .set('Cookie', adminCookie);

      expect(auditRevokes.body.data.records.length).toBeGreaterThan(0);
      const revokeRecord = auditRevokes.body.data.records[0];
      expect(revokeRecord.actor_id).toBe(ownerId);
      expect(revokeRecord.target_id).toBe(grantId);
    });
  });
});
