import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../apps/api/src/app.js';
import { resetTestDb, closeDb } from '../../apps/api/src/db/index.js';

describe('AI Intelligence & Zero-Trust DLP Security Tests [Phase 10]', () => {
  let app: any;

  let aliceCookie: string;
  let aliceCsrf: string;
  let aliceDocId: string;

  let bobCookie: string;
  let bobCsrf: string;

  let adminCookie: string;
  let adminCsrf: string;

  beforeEach(async () => {
    await resetTestDb();
    app = createApp();

    // 1. Register & login Alice (Owner)
    await request(app)
      .post('/api/auth/register')
      .send({
        username: 'alice_ai',
        email: 'alice@vault.local',
        password: 'AlicePassword123!',
        role: 'owner',
      });

    const loginAlice = await request(app)
      .post('/api/auth/login')
      .send({
        usernameOrEmail: 'alice_ai',
        password: 'AlicePassword123!',
      });
    aliceCookie = loginAlice.headers['set-cookie'][0];
    aliceCsrf = loginAlice.body.data.csrfToken;

    // 2. Register & login Bob (Unprivileged User / Attacker)
    await request(app)
      .post('/api/auth/register')
      .send({
        username: 'bob_ai',
        email: 'bob@vault.local',
        password: 'BobPassword123!',
        role: 'viewer',
      });

    const loginBob = await request(app)
      .post('/api/auth/login')
      .send({
        usernameOrEmail: 'bob_ai',
        password: 'BobPassword123!',
      });
    bobCookie = loginBob.headers['set-cookie'][0];
    bobCsrf = loginBob.body.data.csrfToken;

    // 3. Register & login Admin
    await request(app)
      .post('/api/auth/register')
      .send({
        username: 'admin_ai',
        email: 'admin@vault.local',
        password: 'AdminPassword123!',
        role: 'admin',
      });

    const loginAdmin = await request(app)
      .post('/api/auth/login')
      .send({
        usernameOrEmail: 'admin_ai',
        password: 'AdminPassword123!',
      });
    adminCookie = loginAdmin.headers['set-cookie'][0];
    adminCsrf = loginAdmin.body.data.csrfToken;

    // 4. Alice uploads a document with sensitive text
    const sampleText = `Confidential Project Titan Specification.
This architecture outlines the zero-trust microservice communication protocol.
AWS Access Key for deployment: AKIAIOSFODNN7EXAMPLE
Root Database Password: password: SuperSecretP@ssw0rd!
Customer test card: 4111111111111111
All inquiries should be sent to security@acme-corp.com.`;

    const uploadRes = await request(app)
      .post('/api/documents')
      .set('Cookie', aliceCookie)
      .set('x-csrf-token', aliceCsrf)
      .field('title', 'Project Titan Confidential Spec')
      .field('category', 'Engineering')
      .attach('file', Buffer.from(sampleText, 'utf-8'), 'titan_spec.txt');

    aliceDocId = uploadRes.body.data.document.id;
  });

  afterAll(async () => {
    await closeDb();
  });

  it('1. Returns AI engine status and active model for authenticated user', async () => {
    const res = await request(app)
      .get('/api/ai/status')
      .set('Cookie', aliceCookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.activeEngine).toBeDefined();
    expect(res.body.data.model).toBeDefined();
  });

  it('2. Rejects unauthenticated AI requests with 401', async () => {
    const res = await request(app).get('/api/ai/status');
    expect(res.status).toBe(401);
  });

  it('3. Runs pre-upload quick scan and detects exposed secrets', async () => {
    const textWithSecrets = `Sample config file with key AKIAIOSFODNN7EXAMPLE and password: Secret123456!`;

    const res = await request(app)
      .post('/api/ai/quick-scan')
      .set('Cookie', aliceCookie)
      .set('x-csrf-token', aliceCsrf)
      .send({
        text: textWithSecrets,
        fileName: 'config.txt',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.riskLevel).not.toBe('CLEAN');
    expect(res.body.data.detectedSecretsCount).toBeGreaterThanOrEqual(1);
  });

  it('4. Allows owner to generate document summary & key points', async () => {
    const res = await request(app)
      .post('/api/ai/summarize')
      .set('Cookie', aliceCookie)
      .set('x-csrf-token', aliceCsrf)
      .send({
        documentId: aliceDocId,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.summary).toBeDefined();
    expect(Array.isArray(res.body.data.keyPoints)).toBe(true);
    expect(res.body.data.readingTimeMinutes).toBeGreaterThanOrEqual(1);
  });

  it('5. Allows owner to run security DLP scan and detects AWS key, password, credit card, and redacted preview', async () => {
    const res = await request(app)
      .post('/api/ai/security-scan')
      .set('Cookie', aliceCookie)
      .set('x-csrf-token', aliceCsrf)
      .send({
        documentId: aliceDocId,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.riskScore).toBeGreaterThan(0);
    expect(['CRITICAL', 'HIGH']).toContain(res.body.data.riskLevel);

    const findings = res.body.data.findings;
    const types = findings.map((f: any) => f.type);
    expect(types).toContain('EXPOSED_AWS_ACCESS_KEY');
    expect(types).toContain('HARDCODED_PASSWORD');
    expect(types).toContain('PAYMENT_CARD_PAN');

    // Verify redactions
    expect(res.body.data.redactedPreview).toContain('[REDACTED_AWS_KEY]');
    expect(res.body.data.redactedPreview).toContain('[REDACTED_CREDIT_CARD]');
  });

  it('6. Existence Concealment: Unauthorized user (Bob) requesting AI summary receives HTTP 404', async () => {
    const res = await request(app)
      .post('/api/ai/summarize')
      .set('Cookie', bobCookie)
      .set('x-csrf-token', bobCsrf)
      .send({
        documentId: aliceDocId,
      });

    // Mandatory anti-IDOR invariant: return 404 Not Found, NOT 403 Forbidden
    expect(res.status).toBe(404);
  });

  it('7. Existence Concealment: Unauthorized user (Bob) requesting AI security scan receives HTTP 404', async () => {
    const res = await request(app)
      .post('/api/ai/security-scan')
      .set('Cookie', bobCookie)
      .set('x-csrf-token', bobCsrf)
      .send({
        documentId: aliceDocId,
      });

    expect(res.status).toBe(404);
  });

  it('8. Admin Least Privilege: Admin without explicit grant receives HTTP 404 on AI analysis', async () => {
    const res = await request(app)
      .post('/api/ai/summarize')
      .set('Cookie', adminCookie)
      .set('x-csrf-token', adminCsrf)
      .send({
        documentId: aliceDocId,
      });

    expect(res.status).toBe(404);
  });

  it('9. Vault Copilot Chat returns answer grounded in document context', async () => {
    const res = await request(app)
      .post('/api/ai/chat')
      .set('Cookie', aliceCookie)
      .set('x-csrf-token', aliceCsrf)
      .send({
        message: 'What is this document about?',
        documentId: aliceDocId,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.reply).toBeDefined();
    expect(res.body.data.citedDocumentTitle).toBe('Project Titan Confidential Spec');
  });

  it('10. Tamper-Evident Audit Trail: Records AI operations and maintains valid cryptographic hash chain', async () => {
    // 1. Trigger AI operations
    await request(app)
      .post('/api/ai/summarize')
      .set('Cookie', aliceCookie)
      .set('x-csrf-token', aliceCsrf)
      .send({ documentId: aliceDocId });

    await request(app)
      .post('/api/ai/security-scan')
      .set('Cookie', aliceCookie)
      .set('x-csrf-token', aliceCsrf)
      .send({ documentId: aliceDocId });

    // 2. Admin verifies cryptographic audit chain
    const verifyRes = await request(app)
      .get('/api/admin/audit/verify')
      .set('Cookie', adminCookie);

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.data.valid).toBe(true);
    expect(verifyRes.body.data.recordCount).toBeGreaterThan(2);
  });
});
