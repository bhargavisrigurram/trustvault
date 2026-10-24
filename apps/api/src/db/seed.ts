import { getDb } from './index.js';
import { hashPassword } from '../modules/auth/password.js';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config/index.js';

export async function seedDemoAccounts(): Promise<void> {
  const db = await getDb();

  try {
    // Check if admin already exists
    const existing = await db.query('SELECT id FROM users WHERE username = $1', ['admin']);
    if (existing.rows.length > 0) {
      return;
    }

  console.log('[TrustVault Seeder] Seeding default judge/demo accounts...');

  const adminHash = await hashPassword('AdminPass123!');
  const aliceHash = await hashPassword('AlicePass123!');
  const bobHash = await hashPassword('BobPass123!');

  // Insert Admin
  const adminRes = await db.query(
    `INSERT INTO users (username, email, password_hash, role)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    ['admin', 'admin@trustvault.local', adminHash, 'admin']
  );
  const adminId = adminRes.rows[0].id;

  // Insert Alice (Owner)
  const aliceRes = await db.query(
    `INSERT INTO users (username, email, password_hash, role)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    ['alice', 'alice@trustvault.local', aliceHash, 'owner']
  );
  const aliceId = aliceRes.rows[0].id;

  // Insert Bob (Viewer)
  const bobRes = await db.query(
    `INSERT INTO users (username, email, password_hash, role)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    ['bob', 'bob@trustvault.local', bobHash, 'viewer']
  );
  const bobId = bobRes.rows[0].id;

  // Seed sample secure file for Alice
  const sampleDocId = crypto.randomUUID();
  const storageKey = crypto.randomUUID();
  const storageDir = config.storage.filesDir;

  if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true });
  }

  const sampleContent = `%PDF-1.4
% TrustVault Confidential Document
Enterprise Zero-Trust Security Charter & Audit Roadmap 2026.
Author: Alice (CISO Office)
Classification: CONFIDENTIAL & PROPRIETARY

1. Purpose and Scope
This charter establishes the mandatory zero-trust security controls across all internal document processing nodes. All document access queries must verify authorization via central kernel with existence concealment (404 on unauthorized read).

2. Critical Deadlines
All subsidiary units must complete cryptographic token migration by November 15, 2026. Full production compliance audit is scheduled for December 31, 2026.

3. Security Guidelines & DLP Safeguards
No hardcoded API credentials or unmasked social security numbers (SSN) may be committed. All documents must be encrypted and hashed via SHA-256 CAS content addressing.

Approved by: Security Governance Board
Signature: [CRYPTOGRAPHICALLY_VERIFIED_SIGNATURE]
`;

  const sampleBuffer = Buffer.from(sampleContent, 'utf8');
  const checksum = crypto.createHash('sha256').update(sampleBuffer).digest('hex');
  fs.writeFileSync(path.join(storageDir, storageKey), sampleBuffer);

  // Insert Document
  await db.query(
    `INSERT INTO documents (id, owner_id, title, category, current_version_number, is_deleted)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [sampleDocId, aliceId, 'Enterprise Zero-Trust Security Charter 2026', 'Compliance', 1, false]
  );

  // Insert Version
  await db.query(
    `INSERT INTO document_versions (document_id, version_number, storage_key, file_name, file_size, mime_type, sha256_checksum, uploaded_by_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      sampleDocId,
      1,
      storageKey,
      'Enterprise_Security_Charter_2026.pdf',
      sampleBuffer.length,
      'application/pdf',
      checksum,
      aliceId,
    ]
  );

  // Grant Bob Read access
  await db.query(
    `INSERT INTO document_grants (document_id, grantee_id, permission, granted_by_id)
     VALUES ($1, $2, $3, $4)`,
    [sampleDocId, bobId, 'read', aliceId]
  );

  // Initialize Genesis Audit Log through AuditService to ensure unbroken SHA-256 hash chaining
  const { AuditService } = await import('../modules/audit/audit.service.js');
  const auditService = new AuditService(db);
  await auditService.recordEvent({
    eventType: 'system.genesis',
    actorId: adminId,
    actorUsername: 'admin',
    outcome: 'SUCCESS',
    details: {
      action: 'system.initialization',
      version: '1.0.0',
      seededAccounts: ['admin', 'alice', 'bob'],
    },
  });

  console.log('[TrustVault Seeder] Successfully seeded demo accounts (admin, alice, bob) and sample document.');
} catch (seedErr: any) {
  console.warn('[TrustVault Seeder] Non-fatal seeding notice:', seedErr.message);
}
}
