import crypto from 'node:crypto';
import { getDb, DbClient } from '../../db/index.js';
import { config } from '../../config/index.js';
import type { User } from '@trustvault/shared';

export interface DbSession {
  id: string;
  user_id: string;
  csrf_token: string;
  user_agent: string | null;
  ip_address: string | null;
  created_at: Date;
  last_active_at: Date;
  expires_at: Date;
}

export interface SessionValidationResult {
  valid: boolean;
  user?: User;
  session?: DbSession;
  error?: 'EXPIRED_IDLE' | 'EXPIRED_ABSOLUTE' | 'NOT_FOUND' | 'USER_INACTIVE';
}

export class SessionService {
  constructor(private client?: DbClient) {}

  private async getClient(): Promise<DbClient> {
    return this.client || (await getDb());
  }

  /**
   * Generate a cryptographically random opaque token
   */
  private generateRandomToken(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  /**
   * Create a new server-side session in PostgreSQL
   */
  async createSession(
    userId: string,
    metadata: { userAgent?: string; ipAddress?: string } = {}
  ): Promise<{ sessionId: string; csrfToken: string }> {
    const db = await this.getClient();
    const sessionId = this.generateRandomToken();
    const csrfToken = this.generateRandomToken();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + config.session.idleTimeoutMs);

    await db.query(
      `INSERT INTO sessions (id, user_id, csrf_token, user_agent, ip_address, created_at, last_active_at, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $6, $7)`,
      [
        sessionId,
        userId,
        csrfToken,
        metadata.userAgent || null,
        metadata.ipAddress || null,
        now.toISOString(),
        expiresAt.toISOString(),
      ]
    );

    return { sessionId, csrfToken };
  }

  /**
   * Rotate a session upon privilege change or login (prevention of session fixation)
   */
  async rotateSession(
    oldSessionId: string | undefined,
    userId: string,
    metadata: { userAgent?: string; ipAddress?: string } = {}
  ): Promise<{ sessionId: string; csrfToken: string }> {
    if (oldSessionId) {
      await this.destroySession(oldSessionId);
    }
    return await this.createSession(userId, metadata);
  }

  /**
   * Validate a session by ID:
   * - Checks existence
   * - Checks idle timeout
   * - Checks absolute timeout
   * - Checks user active status
   * - Updates last_active_at and extends idle timeout if valid
   */
  async validateSession(sessionId: string): Promise<SessionValidationResult> {
    if (!sessionId || typeof sessionId !== 'string') {
      return { valid: false, error: 'NOT_FOUND' };
    }

    const db = await this.getClient();
    const sessionRes = await db.query<DbSession & {
      user_id: string;
      username: string;
      email: string;
      role: 'admin' | 'owner' | 'viewer';
      is_active: boolean;
      user_created_at: Date;
      user_updated_at: Date;
    }>(
      `SELECT s.id, s.user_id, s.csrf_token, s.user_agent, s.ip_address,
              s.created_at, s.last_active_at, s.expires_at,
              u.id as user_id, u.username, u.email, u.role, u.is_active,
              u.created_at as user_created_at, u.updated_at as user_updated_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.id = $1`,
      [sessionId]
    );

    const row = sessionRes.rows[0];
    if (!row) {
      return { valid: false, error: 'NOT_FOUND' };
    }

    if (!row.is_active) {
      // Invalidate session if user is disabled/inactive
      await this.destroySession(sessionId);
      return { valid: false, error: 'USER_INACTIVE' };
    }

    const now = Date.now();
    const createdAt = new Date(row.created_at).getTime();
    const lastActiveAt = new Date(row.last_active_at).getTime();

    // Check Absolute Timeout
    if (now - createdAt > config.session.absoluteTimeoutMs) {
      await this.destroySession(sessionId);
      return { valid: false, error: 'EXPIRED_ABSOLUTE' };
    }

    // Check Idle Timeout
    if (now - lastActiveAt > config.session.idleTimeoutMs) {
      await this.destroySession(sessionId);
      return { valid: false, error: 'EXPIRED_IDLE' };
    }

    // Update last_active_at and bump idle expiration
    const newExpiresAt = new Date(now + config.session.idleTimeoutMs);
    await db.query(
      `UPDATE sessions
       SET last_active_at = CURRENT_TIMESTAMP,
           expires_at = $2
       WHERE id = $1`,
      [sessionId, newExpiresAt.toISOString()]
    );

    const user: User = {
      id: row.user_id,
      username: row.username,
      email: row.email,
      role: row.role,
      is_active: row.is_active,
      created_at: row.user_created_at,
      updated_at: row.user_updated_at,
    };

    return {
      valid: true,
      user,
      session: row,
    };
  }

  /**
   * Invalidate/destroy a session (logout)
   */
  async destroySession(sessionId: string): Promise<void> {
    const db = await this.getClient();
    await db.query('DELETE FROM sessions WHERE id = $1', [sessionId]);
  }

  /**
   * Invalidate all sessions for a user (e.g. account disabled or password reset)
   */
  async destroyAllUserSessions(userId: string): Promise<void> {
    const db = await this.getClient();
    await db.query('DELETE FROM sessions WHERE user_id = $1', [userId]);
  }
}
