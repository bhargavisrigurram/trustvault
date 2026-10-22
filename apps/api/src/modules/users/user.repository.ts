import { getDb, DbClient } from '../../db/index.js';
import type { User, UserRoleType } from '@trustvault/shared';

export interface UserWithPassword extends User {
  password_hash: string;
  failed_login_attempts: number;
  locked_until: Date | string | null;
}

export class UserRepository {
  constructor(private client?: DbClient) {}

  private async getClient(): Promise<DbClient> {
    return this.client || (await getDb());
  }

  async findById(id: string): Promise<User | null> {
    const db = await this.getClient();
    const result = await db.query<User>(
      `SELECT id, username, email, role, is_active, created_at, updated_at
       FROM users WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }

  async findByUsername(username: string): Promise<UserWithPassword | null> {
    const db = await this.getClient();
    const result = await db.query<UserWithPassword>(
      `SELECT id, username, email, password_hash, role, is_active, failed_login_attempts, locked_until, created_at, updated_at
       FROM users WHERE LOWER(username) = LOWER($1)`,
      [username]
    );
    return result.rows[0] || null;
  }

  async findByEmail(email: string): Promise<UserWithPassword | null> {
    const db = await this.getClient();
    const result = await db.query<UserWithPassword>(
      `SELECT id, username, email, password_hash, role, is_active, failed_login_attempts, locked_until, created_at, updated_at
       FROM users WHERE LOWER(email) = LOWER($1)`,
      [email]
    );
    return result.rows[0] || null;
  }

  async findByUsernameOrEmail(identifier: string): Promise<UserWithPassword | null> {
    const db = await this.getClient();
    const result = await db.query<UserWithPassword>(
      `SELECT id, username, email, password_hash, role, is_active, failed_login_attempts, locked_until, created_at, updated_at
       FROM users WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($1)`,
      [identifier]
    );
    return result.rows[0] || null;
  }

  async create(data: {
    username: string;
    email: string;
    passwordHash: string;
    role: UserRoleType;
  }): Promise<User> {
    const db = await this.getClient();
    const result = await db.query<User>(
      `INSERT INTO users (username, email, password_hash, role, is_active)
       VALUES ($1, $2, $3, $4, TRUE)
       RETURNING id, username, email, role, is_active, created_at, updated_at`,
      [data.username, data.email, data.passwordHash, data.role]
    );
    return result.rows[0];
  }

  async recordFailedAttempt(userId: string, lockoutMinutes: number): Promise<void> {
    const db = await this.getClient();
    const lockDuration = `${lockoutMinutes} minutes`;
    await db.query(
      `UPDATE users
       SET failed_login_attempts = failed_login_attempts + 1,
           locked_until = CASE
             WHEN failed_login_attempts + 1 >= 5 THEN CURRENT_TIMESTAMP + $2::interval
             ELSE locked_until
           END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [userId, lockDuration]
    );
  }

  async resetFailedAttempts(userId: string): Promise<void> {
    const db = await this.getClient();
    await db.query(
      `UPDATE users
       SET failed_login_attempts = 0,
           locked_until = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [userId]
    );
  }

  async updateActiveStatus(userId: string, isActive: boolean): Promise<void> {
    const db = await this.getClient();
    await db.query(
      `UPDATE users
       SET is_active = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [userId, isActive]
    );
  }
}
