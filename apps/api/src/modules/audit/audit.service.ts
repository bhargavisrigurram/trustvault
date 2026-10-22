import crypto from 'node:crypto';
import { getDb, DbClient } from '../../db/index.js';
import type { AuditRecord, AuditOutcomeType } from '@trustvault/shared';

export const GENESIS_HASH = '0'.repeat(64);

export interface AppendAuditParams {
  eventType: string;
  actorId?: string | null;
  actorUsername?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  outcome: AuditOutcomeType;
  correlationId?: string;
  details?: Record<string, any> | null;
  timestamp?: string;
}

export interface VerificationResult {
  valid: boolean;
  recordCount: number;
  genesisHash: string;
  headHash: string | null;
  brokenSequence?: number;
  error?: string;
}

export class AuditService {
  constructor(private client?: DbClient) {}

  private async getClient(): Promise<DbClient> {
    return this.client || (await getDb());
  }

  /**
   * Deterministic canonical JSON serialization.
   * Recursively sorts object keys so identical data yields identical byte strings.
   */
  static canonicalStringify(obj: any): string {
    if (obj === null || typeof obj !== 'object') {
      return JSON.stringify(obj);
    }
    if (Array.isArray(obj)) {
      return '[' + obj.map((item) => AuditService.canonicalStringify(item)).join(',') + ']';
    }
    const keys = Object.keys(obj).sort();
    const parts = keys.map(
      (key) => JSON.stringify(key) + ':' + AuditService.canonicalStringify(obj[key])
    );
    return '{' + parts.join(',') + '}';
  }

  /**
   * Compute deterministic SHA-256 hash chaining previous hash and event payload
   */
  static computeHash(previousHash: string, payload: Record<string, any>): string {
    const canonical = AuditService.canonicalStringify(payload);
    return crypto
      .createHash('sha256')
      .update(previousHash + canonical)
      .digest('hex');
  }

  /**
   * Append an immutable audit event to the cryptographically linked chain
   */
  async recordEvent(
    params: AppendAuditParams,
    options?: { client?: DbClient }
  ): Promise<AuditRecord> {
    const db = options?.client || (await this.getClient());

    // 1. Fetch latest record in chain to determine next sequence and previous hash
    const latestRes = await db.query<{ sequence_number: string | number; current_hash: string }>(
      `SELECT sequence_number, current_hash
       FROM audit_log
       ORDER BY sequence_number DESC
       LIMIT 1`
    );

    let nextSequence = 1;
    let previousHash = GENESIS_HASH;

    if (latestRes.rows.length > 0) {
      nextSequence = Number(latestRes.rows[0].sequence_number) + 1;
      previousHash = latestRes.rows[0].current_hash;
    }

    const timestamp = params.timestamp || new Date().toISOString();
    const correlationId = params.correlationId || crypto.randomUUID();

    // 2. Canonical payload for hash calculation
    const payloadForHashing = {
      sequence_number: nextSequence,
      timestamp,
      event_type: params.eventType,
      actor_id: params.actorId || null,
      actor_username: params.actorUsername || null,
      target_type: params.targetType || null,
      target_id: params.targetId || null,
      outcome: params.outcome,
      correlation_id: correlationId,
      details: params.details || null,
    };

    const currentHash = AuditService.computeHash(previousHash, payloadForHashing);

    // 3. Insert record into database
    const insertRes = await db.query<AuditRecord>(
      `INSERT INTO audit_log (
         sequence_number, timestamp, event_type, actor_id, actor_username,
         target_type, target_id, outcome, correlation_id, details,
         previous_hash, current_hash
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id, sequence_number, timestamp, event_type, actor_id, actor_username,
                 target_type, target_id, outcome, correlation_id, details,
                 previous_hash, current_hash`,
      [
        nextSequence,
        timestamp,
        params.eventType,
        params.actorId || null,
        params.actorUsername || null,
        params.targetType || null,
        params.targetId || null,
        params.outcome,
        correlationId,
        params.details ? JSON.stringify(params.details) : null,
        previousHash,
        currentHash,
      ]
    );

    return insertRes.rows[0];
  }

  /**
   * Verify mathematical integrity of the entire audit chain from Genesis to Head
   */
  async verifyChain(): Promise<VerificationResult> {
    const db = await this.getClient();
    const res = await db.query<AuditRecord>(
      `SELECT id, sequence_number, timestamp, event_type, actor_id, actor_username,
              target_type, target_id, outcome, correlation_id, details,
              previous_hash, current_hash
       FROM audit_log
       ORDER BY sequence_number ASC`
    );

    const records = res.rows;
    if (records.length === 0) {
      return {
        valid: true,
        recordCount: 0,
        genesisHash: GENESIS_HASH,
        headHash: null,
      };
    }

    let expectedPrevHash = GENESIS_HASH;

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const seq = Number(record.sequence_number);

      // Verify sequence monotonicity
      if (seq !== i + 1) {
        return {
          valid: false,
          recordCount: records.length,
          genesisHash: GENESIS_HASH,
          headHash: records[records.length - 1].current_hash,
          brokenSequence: seq,
          error: `Broken sequence continuity: expected #${i + 1}, found #${seq}`,
        };
      }

      // Verify previous hash pointer
      if (record.previous_hash !== expectedPrevHash) {
        return {
          valid: false,
          recordCount: records.length,
          genesisHash: GENESIS_HASH,
          headHash: records[records.length - 1].current_hash,
          brokenSequence: seq,
          error: `Tamper detected: previous_hash mismatch at sequence #${seq}`,
        };
      }

      // Recompute payload hash
      const payload = {
        sequence_number: seq,
        timestamp: new Date(record.timestamp).toISOString(),
        event_type: record.event_type,
        actor_id: record.actor_id || null,
        actor_username: record.actor_username || null,
        target_type: record.target_type || null,
        target_id: record.target_id || null,
        outcome: record.outcome,
        correlation_id: record.correlation_id,
        details: typeof record.details === 'string' ? JSON.parse(record.details) : record.details || null,
      };

      const computed = AuditService.computeHash(record.previous_hash, payload);

      if (record.current_hash !== computed) {
        return {
          valid: false,
          recordCount: records.length,
          genesisHash: GENESIS_HASH,
          headHash: records[records.length - 1].current_hash,
          brokenSequence: seq,
          error: `Tamper detected: content hash mismatch at sequence #${seq}`,
        };
      }

      expectedPrevHash = record.current_hash;
    }

    return {
      valid: true,
      recordCount: records.length,
      genesisHash: GENESIS_HASH,
      headHash: records[records.length - 1].current_hash,
    };
  }

  /**
   * Query audit logs with pagination and filters
   */
  async queryLogs(filters: {
    eventType?: string;
    outcome?: string;
    actorId?: string;
    targetId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ records: AuditRecord[]; totalCount: number }> {
    const db = await this.getClient();
    const clauses: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (filters.eventType) {
      clauses.push(`event_type = $${idx++}`);
      params.push(filters.eventType);
    }
    if (filters.outcome) {
      clauses.push(`outcome = $${idx++}`);
      params.push(filters.outcome);
    }
    if (filters.actorId) {
      clauses.push(`actor_id = $${idx++}`);
      params.push(filters.actorId);
    }
    if (filters.targetId) {
      clauses.push(`target_id = $${idx++}`);
      params.push(filters.targetId);
    }

    const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';

    const countRes = await db.query<{ count: string | number }>(
      `SELECT count(*) as count FROM audit_log ${whereClause}`,
      params
    );
    const totalCount = Number(countRes.rows[0]?.count ?? 0);

    const limit = Math.min(filters.limit || 50, 200);
    const offset = filters.offset || 0;

    const queryParams = [...params, limit, offset];
    const logRes = await db.query<AuditRecord>(
      `SELECT id, sequence_number, timestamp, event_type, actor_id, actor_username,
              target_type, target_id, outcome, correlation_id, details,
              previous_hash, current_hash
       FROM audit_log
       ${whereClause}
       ORDER BY sequence_number DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      queryParams
    );

    return {
      records: logRes.rows,
      totalCount,
    };
  }

  /**
   * Anomaly detection analysis for security dashboard
   */
  async getSecurityAnomalies(): Promise<{
    repeatedDeniedAttempts: Array<{ actor_username: string; count: number; last_attempt: Date }>;
    failedLogins: Array<{ actor_username: string; count: number; last_attempt: Date }>;
    unusualDownloads: Array<{ actor_username: string; count: number }>;
  }> {
    const db = await this.getClient();

    // 1. Repeated denied attempts in the last 24 hours
    const deniedRes = await db.query<{ actor_username: string; count: string; last_attempt: Date }>(
      `SELECT actor_username, count(*) as count, max(timestamp) as last_attempt
       FROM audit_log
       WHERE outcome = 'DENIED'
         AND timestamp > CURRENT_TIMESTAMP - interval '24 hours'
       GROUP BY actor_username
       HAVING count(*) >= 3
       ORDER BY count DESC`
    );

    // 2. Failed logins in the last 24 hours
    const failedLoginsRes = await db.query<{ actor_username: string; count: string; last_attempt: Date }>(
      `SELECT actor_username, count(*) as count, max(timestamp) as last_attempt
       FROM audit_log
       WHERE event_type = 'auth.login.failure'
         AND timestamp > CURRENT_TIMESTAMP - interval '24 hours'
       GROUP BY actor_username
       HAVING count(*) >= 3
       ORDER BY count DESC`
    );

    // 3. High volume download activity in the last 24 hours
    const downloadsRes = await db.query<{ actor_username: string; count: string }>(
      `SELECT actor_username, count(*) as count
       FROM audit_log
       WHERE event_type IN ('document.download', 'token.redeem')
         AND timestamp > CURRENT_TIMESTAMP - interval '24 hours'
       GROUP BY actor_username
       HAVING count(*) >= 10
       ORDER BY count DESC`
    );

    return {
      repeatedDeniedAttempts: deniedRes.rows.map((r) => ({
        actor_username: r.actor_username || 'anonymous',
        count: Number(r.count),
        last_attempt: r.last_attempt,
      })),
      failedLogins: failedLoginsRes.rows.map((r) => ({
        actor_username: r.actor_username || 'unknown',
        count: Number(r.count),
        last_attempt: r.last_attempt,
      })),
      unusualDownloads: downloadsRes.rows.map((r) => ({
        actor_username: r.actor_username || 'anonymous',
        count: Number(r.count),
      })),
    };
  }
}
