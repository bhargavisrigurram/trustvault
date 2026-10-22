import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../apps/api/src/app.js';
import { getDb, resetTestDb, closeDb } from '../../apps/api/src/db/index.js';
import { hashPassword, verifyPassword } from '../../apps/api/src/modules/auth/password.js';
import { SessionService } from '../../apps/api/src/modules/auth/session.service.js';
import { config } from '../../apps/api/src/config/index.js';

describe('Authentication & Session Security Tests', () => {
  let app: any;

  beforeEach(async () => {
    await resetTestDb();
    app = createApp();
  });

  afterAll(async () => {
    await closeDb();
  });

  describe('Argon2id Password Hashing', () => {
    it('uses argon2id with OWASP recommended configuration', async () => {
      const password = 'SuperSecret123!';
      const hash = await hashPassword(password);

      expect(hash).toContain('$argon2id$');
      expect(hash).toContain('m=65536');
      expect(hash).toContain('t=3');
      expect(hash).toContain('p=4');

      const isMatch = await verifyPassword(hash, password);
      expect(isMatch).toBe(true);

      const wrongMatch = await verifyPassword(hash, 'WrongPassword123!');
      expect(wrongMatch).toBe(false);
    });
  });

  describe('Registration & Input Validation', () => {
    it('enforces password complexity via Zod schema', async () => {
      const weakPasswords = [
        'short',
        'nouppercase1!',
        'NOLOWERCASE1!',
        'NoSpecialChar1',
        'NoDigitsHere!',
      ];

      for (const pwd of weakPasswords) {
        const res = await request(app)
          .post('/api/auth/register')
          .send({
            username: 'test_user',
            email: 'test@vault.local',
            password: pwd,
            role: 'viewer',
          });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.error.code).toBe('VALIDATION_ERROR');
      }
    });

    it('successfully registers valid user and defaults to active', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'valid_alice',
          email: 'alice@vault.local',
          password: 'ValidPassword123!',
          role: 'owner',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.username).toBe('valid_alice');
      expect(res.body.data.user.role).toBe('owner');
      expect(res.body.data.user.password_hash).toBeUndefined();
    });

    it('rejects duplicate username or email with 409 Conflict', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({
          username: 'unique_user',
          email: 'unique@vault.local',
          password: 'ValidPassword123!',
        });

      const dupRes = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'unique_user',
          email: 'different@vault.local',
          password: 'ValidPassword123!',
        });

      expect(dupRes.status).toBe(409);
      expect(dupRes.body.error.code).toBe('USER_EXISTS');
    });
  });

  describe('Session Fixation Prevention', () => {
    it('rotates session ID upon login so pre-session tokens are invalidated', async () => {
      // Register user
      await request(app)
        .post('/api/auth/register')
        .send({
          username: 'fixation_user',
          email: 'fixation@vault.local',
          password: 'ValidPassword123!',
        });

      // Login attempt with an attacker-planted session cookie
      const fakeSessionId = 'attacker-planted-session-token-1234567890';
      const loginRes = await request(app)
        .post('/api/auth/login')
        .set('Cookie', [`${config.session.cookieName}=${fakeSessionId}`])
        .send({
          usernameOrEmail: 'fixation_user',
          password: 'ValidPassword123!',
        });

      expect(loginRes.status).toBe(200);

      // Verify a new session cookie was issued
      const cookies = loginRes.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const cookieArray = Array.isArray(cookies) ? cookies : [cookies as unknown as string];
      const sessionCookie = cookieArray.find((c: string) => c.startsWith(`${config.session.cookieName}=`));
      expect(sessionCookie).toBeDefined();
      expect(sessionCookie).not.toContain(fakeSessionId);
      expect(sessionCookie).toContain('HttpOnly');
    });
  });

  describe('Brute-Force Protection & Generic Error Messages', () => {
    it('returns generic error for invalid username and does not reveal non-existence', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          usernameOrEmail: 'non_existent_user',
          password: 'SomePassword123!',
        });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
      expect(res.body.error.message).toBe('Invalid username or password');
    });

    it('locks account after 5 consecutive failed login attempts', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({
          username: 'lockout_target',
          email: 'lockout@vault.local',
          password: 'TargetPassword123!',
        });

      // 5 failed login attempts
      for (let i = 0; i < 5; i++) {
        const failRes = await request(app)
          .post('/api/auth/login')
          .send({
            usernameOrEmail: 'lockout_target',
            password: 'WrongPassword!',
          });
        expect(failRes.status).toBe(401);
      }

      // 6th attempt should be locked out with 429
      const lockRes = await request(app)
        .post('/api/auth/login')
        .send({
          usernameOrEmail: 'lockout_target',
          password: 'TargetPassword123!',
        });

      expect(lockRes.status).toBe(429);
      expect(lockRes.body.error.code).toBe('ACCOUNT_LOCKED');
      expect(lockRes.body.error.message).toContain('Account is temporarily locked');
    });
  });

  describe('Logout & Session Invalidation', () => {
    it('destroys session in database upon logout', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({
          username: 'logout_user',
          email: 'logout@vault.local',
          password: 'ValidPassword123!',
        });

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          usernameOrEmail: 'logout_user',
          password: 'ValidPassword123!',
        });

      const sessionCookie = loginRes.headers['set-cookie'][0];
      const csrfToken = loginRes.body.data.csrfToken;

      // Access /api/auth/me while logged in
      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Cookie', [sessionCookie]);
      expect(meRes.status).toBe(200);

      // Logout
      const logoutRes = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', [sessionCookie])
        .set('X-CSRF-Token', csrfToken);
      expect(logoutRes.status).toBe(200);

      // Subsequent access with the old session cookie must be rejected with 401
      const staleRes = await request(app)
        .get('/api/auth/me')
        .set('Cookie', [sessionCookie]);
      expect(staleRes.status).toBe(401);
    });
  });

  describe('Session Timeouts (Idle & Absolute)', () => {
    it('rejects session when idle timeout has elapsed', async () => {
      const sessionService = new SessionService();
      const db = await getDb();

      // Create a test user directly
      const userRes = await db.query(
        `INSERT INTO users (username, email, password_hash, role, is_active)
         VALUES ('idle_user', 'idle@vault.local', 'hash', 'viewer', TRUE)
         RETURNING id`
      );
      const userId = userRes.rows[0].id;

      const { sessionId } = await sessionService.createSession(userId);

      // Artificially move last_active_at back beyond idle timeout (e.g. 35 mins ago)
      const pastActive = new Date(Date.now() - 35 * 60 * 1000).toISOString();
      await db.query(
        `UPDATE sessions SET last_active_at = $1 WHERE id = $2`,
        [pastActive, sessionId]
      );

      const val = await sessionService.validateSession(sessionId);
      expect(val.valid).toBe(false);
      expect(val.error).toBe('EXPIRED_IDLE');
    });

    it('rejects session when absolute timeout has elapsed', async () => {
      const sessionService = new SessionService();
      const db = await getDb();

      const userRes = await db.query(
        `INSERT INTO users (username, email, password_hash, role, is_active)
         VALUES ('abs_user', 'abs@vault.local', 'hash', 'viewer', TRUE)
         RETURNING id`
      );
      const userId = userRes.rows[0].id;

      const { sessionId } = await sessionService.createSession(userId);

      // Artificially set created_at back beyond absolute timeout (e.g. 13 hours ago)
      const pastCreated = new Date(Date.now() - 13 * 3600 * 1000).toISOString();
      await db.query(
        `UPDATE sessions SET created_at = $1 WHERE id = $2`,
        [pastCreated, sessionId]
      );

      const val = await sessionService.validateSession(sessionId);
      expect(val.valid).toBe(false);
      expect(val.error).toBe('EXPIRED_ABSOLUTE');
    });
  });

  describe('Disabled User Session Invalidation', () => {
    it('rejects active session immediately if user account is disabled', async () => {
      const sessionService = new SessionService();
      const db = await getDb();

      const userRes = await db.query(
        `INSERT INTO users (username, email, password_hash, role, is_active)
         VALUES ('disabled_user', 'disabled@vault.local', 'hash', 'viewer', TRUE)
         RETURNING id`
      );
      const userId = userRes.rows[0].id;

      const { sessionId } = await sessionService.createSession(userId);

      // Verify session is initially valid
      const initialVal = await sessionService.validateSession(sessionId);
      expect(initialVal.valid).toBe(true);

      // Admin disables user
      await db.query(`UPDATE users SET is_active = FALSE WHERE id = $1`, [userId]);

      // Re-validating session must immediately fail with USER_INACTIVE
      const postDisableVal = await sessionService.validateSession(sessionId);
      expect(postDisableVal.valid).toBe(false);
      expect(postDisableVal.error).toBe('USER_INACTIVE');
    });
  });

  describe('CSRF Protection', () => {
    it('rejects state-changing requests when CSRF token is missing or mismatched', async () => {
      // Login to get session
      await request(app)
        .post('/api/auth/register')
        .send({
          username: 'csrf_user',
          email: 'csrf@vault.local',
          password: 'ValidPassword123!',
        });

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          usernameOrEmail: 'csrf_user',
          password: 'ValidPassword123!',
        });

      const sessionCookie = loginRes.headers['set-cookie'][0];

      // POST /api/auth/logout without CSRF token
      const noCsrfRes = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', [sessionCookie]);

      expect(noCsrfRes.status).toBe(403);
      expect(noCsrfRes.body.error.code).toBe('INVALID_CSRF_TOKEN');

      // POST /api/auth/logout with wrong CSRF token
      const wrongCsrfRes = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', [sessionCookie])
        .set('X-CSRF-Token', 'wrong-csrf-token-value');

      expect(wrongCsrfRes.status).toBe(403);
      expect(wrongCsrfRes.body.error.code).toBe('INVALID_CSRF_TOKEN');
    });
  });
});
