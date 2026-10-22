import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../apps/api/src/app.js';
import { resetTestDb, closeDb } from '../../apps/api/src/db/index.js';

describe('Permission-Safe Search & Filtering Security Tests [Phase 5]', () => {
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

  let alicePrivateDocId: string;
  let aliceSharedDocId: string;
  let aliceDeletedDocId: string;
  let bobDocId: string;

  beforeEach(async () => {
    await resetTestDb();
    app = createApp();

    // 1. Alice (Owner of sensitive docs)
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

    // 2. Bob (Viewer / Collaborator)
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

    // 3. Charlie (Unrelated Third Party)
    const regCharlie = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'charlie_third',
        email: 'charlie@vault.local',
        password: 'CharliePassword123!',
        role: 'viewer',
      });
    charlieId = regCharlie.body.data.user.id;

    const loginCharlie = await request(app)
      .post('/api/auth/login')
      .send({
        usernameOrEmail: 'charlie_third',
        password: 'CharliePassword123!',
      });
    charlieCookie = loginCharlie.headers['set-cookie'][0];
    charlieCsrf = loginCharlie.body.data.csrfToken;

    const pdfBuffer = Buffer.concat([
      Buffer.from('%PDF-1.7\n', 'utf8'),
      Buffer.from('Confidential Tax and Audit Payload', 'utf8'),
      Buffer.from('\n%%EOF', 'utf8'),
    ]);

    const pngBuffer = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44,
      0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f,
      0x15, 0xc4, 0x89,
    ]);

    // Alice Doc 1: Confidential Tax Report (Private)
    const doc1Res = await request(app)
      .post('/api/documents')
      .set('Cookie', aliceCookie)
      .set('x-csrf-token', aliceCsrf)
      .field('title', 'Confidential Tax and Audit Report 2026')
      .field('category', 'Finance')
      .attach('file', pdfBuffer, 'tax_audit_2026.pdf');
    alicePrivateDocId = doc1Res.body.data.document.id;

    // Alice Doc 2: Q3 Marketing Strategy Deck (Shared with Bob)
    const doc2Res = await request(app)
      .post('/api/documents')
      .set('Cookie', aliceCookie)
      .set('x-csrf-token', aliceCsrf)
      .field('title', 'Q3 Marketing Strategy Deck')
      .field('category', 'Marketing')
      .attach('file', pdfBuffer, 'marketing_q3.pdf');
    aliceSharedDocId = doc2Res.body.data.document.id;

    // Alice grants Bob READ access to Marketing Deck
    await request(app)
      .post(`/api/documents/${aliceSharedDocId}/grants`)
      .set('Cookie', aliceCookie)
      .set('x-csrf-token', aliceCsrf)
      .send({
        granteeUsernameOrEmail: 'bob_viewer',
        permission: 'read',
      });

    // Alice Doc 3: Deleted Secret Project Notes
    const doc3Res = await request(app)
      .post('/api/documents')
      .set('Cookie', aliceCookie)
      .set('x-csrf-token', aliceCsrf)
      .field('title', 'Secret Project Apollo Architecture')
      .field('category', 'Engineering')
      .attach('file', pdfBuffer, 'apollo_arch.pdf');
    aliceDeletedDocId = doc3Res.body.data.document.id;

    // Alice soft-deletes Doc 3
    await request(app)
      .delete(`/api/documents/${aliceDeletedDocId}`)
      .set('Cookie', aliceCookie)
      .set('x-csrf-token', aliceCsrf);

    // Bob Doc: Bob Personal Budget
    const bobDocRes = await request(app)
      .post('/api/documents')
      .set('Cookie', bobCookie)
      .set('x-csrf-token', bobCsrf)
      .field('title', 'Bob Personal Budget Planner')
      .field('category', 'Finance')
      .attach('file', pngBuffer, 'budget_chart.png');
    bobDocId = bobDocRes.body.data.document.id;
  });

  afterAll(async () => {
    await closeDb();
  });

  describe('Database-Level Isolation & Anti-Information-Leakage', () => {
    it('Bob searching for Alice private document title receives 0 results and zero leaked metadata', async () => {
      // Bob searches specifically for 'Tax and Audit' which only exists in Alice's private doc
      const res = await request(app)
        .get('/api/documents?q=Tax%20and%20Audit')
        .set('Cookie', bobCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.documents).toHaveLength(0);
      expect(res.body.data.pagination.totalCount).toBe(0);

      // Verify facets do not leak category counts of unauthorized documents
      const financeFacet = res.body.data.facets.categories.find(
        (c: any) => c.category === 'Finance'
      );
      // In category Finance, only Bob's own doc should be counted for Bob (count: 0 since q="Tax and Audit" doesn't match Bob's budget)
      expect(financeFacet).toBeUndefined();
    });

    it('Charlie (no grants) querying collection receives only empty list and empty facets', async () => {
      const res = await request(app)
        .get('/api/documents')
        .set('Cookie', charlieCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.documents).toHaveLength(0);
      expect(res.body.data.pagination.totalCount).toBe(0);
      expect(res.body.data.facets.categories).toHaveLength(0);
      expect(res.body.data.facets.mimeTypes).toHaveLength(0);
    });

    it('Bob sees both his owned document and Alice shared document with correct effective permissions', async () => {
      const res = await request(app)
        .get('/api/documents')
        .set('Cookie', bobCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.documents).toHaveLength(2);
      expect(res.body.data.pagination.totalCount).toBe(2);

      const ownedDoc = res.body.data.documents.find((d: any) => d.id === bobDocId);
      expect(ownedDoc).toBeDefined();
      expect(ownedDoc.effective_permission).toBe('owner');
      expect(ownedDoc.owner_username).toBe('bob_viewer');

      const sharedDoc = res.body.data.documents.find((d: any) => d.id === aliceSharedDocId);
      expect(sharedDoc).toBeDefined();
      expect(sharedDoc.effective_permission).toBe('read');
      expect(sharedDoc.owner_username).toBe('alice_owner');
    });

    it('Facets aggregate ONLY across authorized documents for the querying user', async () => {
      // Alice sees 2 active documents: Finance (1) and Marketing (1)
      const aliceRes = await request(app)
        .get('/api/documents')
        .set('Cookie', aliceCookie);

      expect(aliceRes.status).toBe(200);
      const aliceCategories = aliceRes.body.data.facets.categories;
      const aliceFinance = aliceCategories.find((c: any) => c.category === 'Finance');
      expect(aliceFinance.count).toBe(1);

      // Bob sees 2 documents: Finance (1 - his own) and Marketing (1 - shared by Alice)
      const bobRes = await request(app)
        .get('/api/documents')
        .set('Cookie', bobCookie);

      expect(bobRes.status).toBe(200);
      const bobCategories = bobRes.body.data.facets.categories;
      const bobFinance = bobCategories.find((c: any) => c.category === 'Finance');
      expect(bobFinance.count).toBe(1); // Only Bob's doc, NOT Alice's tax report!
    });
  });

  describe('Soft-Deletion Protection in Search', () => {
    it('excludes soft-deleted documents from standard search and counts for owner', async () => {
      const res = await request(app)
        .get('/api/documents')
        .set('Cookie', aliceCookie);

      expect(res.status).toBe(200);
      expect(res.body.data.pagination.totalCount).toBe(2);

      const deletedDoc = res.body.data.documents.find((d: any) => d.id === aliceDeletedDocId);
      expect(deletedDoc).toBeUndefined();
    });

    it('allows owner to query trash specifically with filter=trash', async () => {
      const res = await request(app)
        .get('/api/documents?filter=trash')
        .set('Cookie', aliceCookie);

      expect(res.status).toBe(200);
      expect(res.body.data.documents).toHaveLength(1);
      expect(res.body.data.documents[0].id).toBe(aliceDeletedDocId);
      expect(res.body.data.documents[0].is_deleted).toBe(true);
    });

    it('denies other users from seeing owner trash', async () => {
      const res = await request(app)
        .get('/api/documents?filter=trash')
        .set('Cookie', bobCookie);

      expect(res.status).toBe(200);
      expect(res.body.data.documents).toHaveLength(0);
      expect(res.body.data.pagination.totalCount).toBe(0);
    });
  });

  describe('Filtering by Category, File Type, and Query', () => {
    it('filters by exact category', async () => {
      const res = await request(app)
        .get('/api/documents?category=Marketing')
        .set('Cookie', bobCookie);

      expect(res.status).toBe(200);
      expect(res.body.data.documents).toHaveLength(1);
      expect(res.body.data.documents[0].title).toBe('Q3 Marketing Strategy Deck');
    });

    it('filters by file type', async () => {
      const res = await request(app)
        .get('/api/documents?fileType=png')
        .set('Cookie', bobCookie);

      expect(res.status).toBe(200);
      expect(res.body.data.documents).toHaveLength(1);
      expect(res.body.data.documents[0].file_name).toBe('budget_chart.png');
    });

    it('filters by text query on title or filename', async () => {
      const res = await request(app)
        .get('/api/documents?q=Strategy')
        .set('Cookie', bobCookie);

      expect(res.status).toBe(200);
      expect(res.body.data.documents).toHaveLength(1);
      expect(res.body.data.documents[0].title).toBe('Q3 Marketing Strategy Deck');
    });

    it('supports filter=owned and filter=shared scopes', async () => {
      const ownedRes = await request(app)
        .get('/api/documents?filter=owned')
        .set('Cookie', bobCookie);

      expect(ownedRes.body.data.documents).toHaveLength(1);
      expect(ownedRes.body.data.documents[0].id).toBe(bobDocId);

      const sharedRes = await request(app)
        .get('/api/documents?filter=shared')
        .set('Cookie', bobCookie);

      expect(sharedRes.body.data.documents).toHaveLength(1);
      expect(sharedRes.body.data.documents[0].id).toBe(aliceSharedDocId);
    });
  });

  describe('Sorting and Bounded Pagination', () => {
    it('sorts by title ASC and DESC', async () => {
      const ascRes = await request(app)
        .get('/api/documents?sortBy=title&sortOrder=asc')
        .set('Cookie', bobCookie);

      const titlesAsc = ascRes.body.data.documents.map((d: any) => d.title);
      expect(titlesAsc[0] < titlesAsc[1]).toBe(true);

      const descRes = await request(app)
        .get('/api/documents?sortBy=title&sortOrder=desc')
        .set('Cookie', bobCookie);

      const titlesDesc = descRes.body.data.documents.map((d: any) => d.title);
      expect(titlesDesc[0] > titlesDesc[1]).toBe(true);
    });

    it('paginates results with limit and offset', async () => {
      const page1Res = await request(app)
        .get('/api/documents?limit=1&offset=0')
        .set('Cookie', bobCookie);

      expect(page1Res.body.data.documents).toHaveLength(1);
      expect(page1Res.body.data.pagination.totalCount).toBe(2);
      expect(page1Res.body.data.pagination.hasMore).toBe(true);

      const page2Res = await request(app)
        .get('/api/documents?limit=1&offset=1')
        .set('Cookie', bobCookie);

      expect(page2Res.body.data.documents).toHaveLength(1);
      expect(page2Res.body.data.pagination.hasMore).toBe(false);
      expect(page2Res.body.data.documents[0].id).not.toBe(page1Res.body.data.documents[0].id);
    });
  });
});
