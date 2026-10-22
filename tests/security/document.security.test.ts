import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import fs from 'node:fs';
import path from 'node:path';
import { createApp } from '../../apps/api/src/app.js';
import { getDb, resetTestDb, closeDb } from '../../apps/api/src/db/index.js';
import { StorageService } from '../../apps/api/src/modules/storage/storage.service.js';

describe('Document Lifecycle & Storage Security Tests [Phase 2]', () => {
  let app: any;
  const storageService = new StorageService();

  // Test credentials & sessions
  let aliceCookie: string;
  let aliceCsrf: string;
  let aliceId: string;

  let bobCookie: string;
  let bobCsrf: string;
  let bobId: string;

  beforeEach(async () => {
    await resetTestDb();
    app = createApp();

    // 1. Register and login Alice (Owner)
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

    // 2. Register and login Bob (Attacker / Unprivileged User)
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
  });

  afterAll(async () => {
    await closeDb();
  });

  describe('Upload & File Signature Validation', () => {
    it('accepts valid PDF document and stores SHA-256 checksum', async () => {
      const validPdfBuffer = Buffer.from('%PDF-1.4\n%âãÏÓ\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF');

      const res = await request(app)
        .post('/api/documents')
        .set('Cookie', [aliceCookie])
        .set('X-CSRF-Token', aliceCsrf)
        .field('title', 'Annual Financial Report')
        .field('category', 'Finance')
        .attach('file', validPdfBuffer, 'financial_report.pdf');

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.document.title).toBe('Annual Financial Report');
      expect(res.body.data.version.version_number).toBe(1);
      expect(res.body.data.version.mime_type).toBe('application/pdf');
      expect(res.body.data.version.sha256_checksum).toHaveLength(64);

      // Verify physical file exists in private storage under UUID key
      const storageKey = res.body.data.version.storage_key;
      expect(storageService.fileExists(storageKey)).toBe(true);
    });

    it('rejects MIME spoofing: executable file disguised as .pdf', async () => {
      // Windows PE executable header (MZ)
      const fakePdfBuffer = Buffer.from('MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff\x00\x00');

      const res = await request(app)
        .post('/api/documents')
        .set('Cookie', [aliceCookie])
        .set('X-CSRF-Token', aliceCsrf)
        .field('title', 'Trojan Payload')
        .attach('file', fakePdfBuffer, 'trojan.pdf');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_FILE');
      expect(res.body.error.message).toContain('Executable files');
    });

    it('rejects ELF Linux binary disguised as text or PDF', async () => {
      const elfBuffer = Buffer.from('\x7fELF\x02\x01\x01\x00\x00\x00\x00\x00');

      const res = await request(app)
        .post('/api/documents')
        .set('Cookie', [aliceCookie])
        .set('X-CSRF-Token', aliceCsrf)
        .field('title', 'Linux Rootkit')
        .attach('file', elfBuffer, 'report.pdf');

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('ELF binaries');
    });

    it('rejects ZIP/archive files in standard upload', async () => {
      // PK signature
      const zipBuffer = Buffer.from('PK\x03\x04\x14\x00\x00\x00\x08\x00');

      const res = await request(app)
        .post('/api/documents')
        .set('Cookie', [aliceCookie])
        .set('X-CSRF-Token', aliceCsrf)
        .field('title', 'Archive Upload')
        .attach('file', zipBuffer, 'data.png');

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Archive files');
    });

    it('sanitizes dangerous filenames against stored XSS and path traversal', async () => {
      const validTextBuffer = Buffer.from('Safe text document content');

      const res = await request(app)
        .post('/api/documents')
        .set('Cookie', [aliceCookie])
        .set('X-CSRF-Token', aliceCsrf)
        .field('title', 'XSS Filename Test')
        .attach('file', validTextBuffer, '../../<script>alert(1)</script>.txt');

      expect(res.status).toBe(201);
      const savedFilename = res.body.data.version.file_name;
      expect(savedFilename).not.toContain('<script>');
      expect(savedFilename).not.toContain('../');
      expect(savedFilename).not.toContain('..\\');
    });
  });

  describe('IDOR & Document Isolation Boundary', () => {
    let aliceDocId: string;

    beforeEach(async () => {
      // Alice creates a private document
      const validPdfBuffer = Buffer.from('%PDF-1.4 Alice Secret Document Content %%EOF');
      const createRes = await request(app)
        .post('/api/documents')
        .set('Cookie', [aliceCookie])
        .set('X-CSRF-Token', aliceCsrf)
        .field('title', 'Alice Private Strategy')
        .attach('file', validPdfBuffer, 'strategy.pdf');

      aliceDocId = createRes.body.data.document.id;
    });

    it('Bob attempting to GET Alice document metadata receives 404 (hides existence)', async () => {
      const res = await request(app)
        .get(`/api/documents/${aliceDocId}`)
        .set('Cookie', [bobCookie]);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
      expect(res.body.data).toBeUndefined();
    });

    it('Bob attempting to DOWNLOAD Alice document receives 404', async () => {
      const res = await request(app)
        .get(`/api/documents/${aliceDocId}/download`)
        .set('Cookie', [bobCookie]);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('Bob attempting to upload a new version to Alice document receives 404', async () => {
      const newPdfBuffer = Buffer.from('%PDF-1.4 Bob Malicious Overwrite %%EOF');
      const res = await request(app)
        .post(`/api/documents/${aliceDocId}/versions`)
        .set('Cookie', [bobCookie])
        .set('X-CSRF-Token', bobCsrf)
        .attach('file', newPdfBuffer, 'overwrite.pdf');

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('Bob attempting to edit Alice document metadata receives 404', async () => {
      const res = await request(app)
        .patch(`/api/documents/${aliceDocId}`)
        .set('Cookie', [bobCookie])
        .set('X-CSRF-Token', bobCsrf)
        .send({ title: 'Hacked Title' });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('Bob attempting to delete Alice document receives 404', async () => {
      const res = await request(app)
        .delete(`/api/documents/${aliceDocId}`)
        .set('Cookie', [bobCookie])
        .set('X-CSRF-Token', bobCsrf);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('Bob attempting to recover Alice document receives 404', async () => {
      const res = await request(app)
        .post(`/api/documents/${aliceDocId}/recover`)
        .set('Cookie', [bobCookie])
        .set('X-CSRF-Token', bobCsrf);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('Download Streaming & Security Headers', () => {
    it('sets strict security headers preventing inline rendering or caching', async () => {
      const validPdfBuffer = Buffer.from('%PDF-1.4 Test Download Headers %%EOF');
      const createRes = await request(app)
        .post('/api/documents')
        .set('Cookie', [aliceCookie])
        .set('X-CSRF-Token', aliceCsrf)
        .field('title', 'Download Header Test')
        .attach('file', validPdfBuffer, 'test.pdf');

      const docId = createRes.body.data.document.id;

      const downloadRes = await request(app)
        .get(`/api/documents/${docId}/download`)
        .set('Cookie', [aliceCookie]);

      expect(downloadRes.status).toBe(200);
      expect(downloadRes.headers['content-type']).toBe('application/pdf');
      expect(downloadRes.headers['content-disposition']).toContain('attachment');
      expect(downloadRes.headers['x-content-type-options']).toBe('nosniff');
      expect(downloadRes.headers['cache-control']).toContain('no-store');
      expect(downloadRes.headers['x-file-checksum-sha256']).toHaveLength(64);
      expect(downloadRes.body.length).toBeGreaterThan(0);
    });
  });

  describe('Versions & Optimistic Concurrency Control', () => {
    it('allows owner to upload successive versions and download specific versions', async () => {
      // Version 1
      const v1Buffer = Buffer.from('Plain text version 1');
      const createRes = await request(app)
        .post('/api/documents')
        .set('Cookie', [aliceCookie])
        .set('X-CSRF-Token', aliceCsrf)
        .field('title', 'Versioned Document')
        .attach('file', v1Buffer, 'doc.txt');

      const docId = createRes.body.data.document.id;

      // Version 2
      const v2Buffer = Buffer.from('Plain text version 2 with more details');
      const v2Res = await request(app)
        .post(`/api/documents/${docId}/versions`)
        .set('Cookie', [aliceCookie])
        .set('X-CSRF-Token', aliceCsrf)
        .field('expectedVersion', 1)
        .attach('file', v2Buffer, 'doc_v2.txt');

      expect(v2Res.status).toBe(201);
      expect(v2Res.body.data.version.version_number).toBe(2);

      // Verify metadata returns both versions
      const metaRes = await request(app)
        .get(`/api/documents/${docId}`)
        .set('Cookie', [aliceCookie]);

      expect(metaRes.status).toBe(200);
      expect(metaRes.body.data.document.current_version_number).toBe(2);
      expect(metaRes.body.data.versions).toHaveLength(2);

      // Download specific version 1
      const dlV1 = await request(app)
        .get(`/api/documents/${docId}/download?version=1`)
        .set('Cookie', [aliceCookie]);
      expect(dlV1.text).toBe('Plain text version 1');

      // Download specific version 2
      const dlV2 = await request(app)
        .get(`/api/documents/${docId}/download?version=2`)
        .set('Cookie', [aliceCookie]);
      expect(dlV2.text).toBe('Plain text version 2 with more details');
    });

    it('rejects version upload with 409 Conflict if expectedVersion does not match current version', async () => {
      const v1Buffer = Buffer.from('Plain text v1');
      const createRes = await request(app)
        .post('/api/documents')
        .set('Cookie', [aliceCookie])
        .set('X-CSRF-Token', aliceCsrf)
        .field('title', 'Concurrency Doc')
        .attach('file', v1Buffer, 'doc.txt');

      const docId = createRes.body.data.document.id;

      // Client thinks current version is 999
      const v2Buffer = Buffer.from('Conflicting edit');
      const conflictRes = await request(app)
        .post(`/api/documents/${docId}/versions`)
        .set('Cookie', [aliceCookie])
        .set('X-CSRF-Token', aliceCsrf)
        .field('expectedVersion', 999)
        .attach('file', v2Buffer, 'conflict.txt');

      expect(conflictRes.status).toBe(409);
      expect(conflictRes.body.error.code).toBe('VERSION_CONFLICT');
    });
  });

  describe('Soft-Deletion Lifecycle', () => {
    it('soft-deleted documents cannot be downloaded or viewed, but can be recovered by owner', async () => {
      const v1Buffer = Buffer.from('Important contract text');
      const createRes = await request(app)
        .post('/api/documents')
        .set('Cookie', [aliceCookie])
        .set('X-CSRF-Token', aliceCsrf)
        .field('title', 'Legal Contract')
        .attach('file', v1Buffer, 'contract.txt');

      const docId = createRes.body.data.document.id;

      // 1. Owner soft-deletes document
      const delRes = await request(app)
        .delete(`/api/documents/${docId}`)
        .set('Cookie', [aliceCookie])
        .set('X-CSRF-Token', aliceCsrf);
      expect(delRes.status).toBe(200);

      // 2. Fetching deleted document returns 404
      const getRes = await request(app)
        .get(`/api/documents/${docId}`)
        .set('Cookie', [aliceCookie]);
      expect(getRes.status).toBe(404);

      // 3. Downloading deleted document returns 404
      const dlRes = await request(app)
        .get(`/api/documents/${docId}/download`)
        .set('Cookie', [aliceCookie]);
      expect(dlRes.status).toBe(404);

      // 4. Owner recovers document
      const recoverRes = await request(app)
        .post(`/api/documents/${docId}/recover`)
        .set('Cookie', [aliceCookie])
        .set('X-CSRF-Token', aliceCsrf);
      expect(recoverRes.status).toBe(200);

      // 5. Document is accessible again
      const postRecoverGet = await request(app)
        .get(`/api/documents/${docId}`)
        .set('Cookie', [aliceCookie]);
      expect(postRecoverGet.status).toBe(200);
      expect(postRecoverGet.body.data.document.title).toBe('Legal Contract');
    });
  });

  describe('Path Traversal Prevention in Storage Engine', () => {
    it('throws error when storage key contains directory traversal attempts', () => {
      expect(() => storageService.getFilePath('../../etc/passwd')).toThrow();
      expect(() => storageService.getFilePath('..\\..\\windows\\system32')).toThrow();
      expect(() => storageService.getFilePath('non-uuid-string')).toThrow();
    });
  });
});
