import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { PGlite } from '@electric-sql/pglite';

export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
}

export interface DbClient {
  query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>>;
  exec(sql: string): Promise<void>;
}

let pool: pg.Pool | null = null;
let pgliteInstance: PGlite | null = null;

export async function getDb(): Promise<DbClient> {
  const dbUrl = process.env.DATABASE_URL;

  if (dbUrl && dbUrl.trim() !== '') {
    if (!pool) {
      pool = new pg.Pool({
        connectionString: dbUrl,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });
    }
    return {
      async query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
        const res = await pool!.query(text, params);
        return { rows: res.rows, rowCount: res.rowCount ?? 0 };
      },
      async exec(sql: string): Promise<void> {
        await pool!.query(sql);
      },
    };
  }

  // Fallback to in-memory / file-based PGlite for local testing or dev without Postgres daemon
  if (!pgliteInstance) {
    pgliteInstance = new PGlite();
  }

  return {
    async query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
      const res = await pgliteInstance!.query<T>(text, params);
      return {
        rows: res.rows,
        rowCount: (res as any).affectedRows ?? (res as any).rowCount ?? res.rows.length,
      };
    },
    async exec(sql: string): Promise<void> {
      await pgliteInstance!.exec(sql);
    },
  };
}

export async function transaction<T>(callback: (client: DbClient) => Promise<T>): Promise<T> {
  const dbUrl = process.env.DATABASE_URL;

  if (dbUrl && dbUrl.trim() !== '') {
    if (!pool) {
      await getDb();
    }
    const client = await pool!.connect();
    try {
      await client.query('BEGIN');
      const wrappedClient: DbClient = {
        async query<R = any>(text: string, params?: any[]): Promise<QueryResult<R>> {
          const res = await client.query(text, params);
          return { rows: res.rows, rowCount: res.rowCount ?? 0 };
        },
        async exec(sql: string): Promise<void> {
          await client.query(sql);
        },
      };
      const result = await callback(wrappedClient);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // PGlite transaction
  if (!pgliteInstance) {
    await getDb();
  }
  return await pgliteInstance!.transaction(async (tx) => {
    const wrappedClient: DbClient = {
      async query<R = any>(text: string, params?: any[]): Promise<QueryResult<R>> {
        const res = await tx.query<R>(text, params);
        return {
          rows: res.rows,
          rowCount: (res as any).affectedRows ?? (res as any).rowCount ?? res.rows.length,
        };
      },
      async exec(sql: string): Promise<void> {
        await tx.exec(sql);
      },
    };
    return await callback(wrappedClient);
  });
}

export async function runMigrations(): Promise<void> {
  const db = await getDb();
  
  // Find migrations directory
  const possiblePaths = [
    path.resolve(process.cwd(), 'database/migrations'),
    path.resolve(process.cwd(), '../database/migrations'),
    path.resolve(process.cwd(), '../../database/migrations'),
  ];

  let migrationsDir = possiblePaths.find((p) => fs.existsSync(p));
  if (!migrationsDir) {
    throw new Error('Migrations directory not found');
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const fullPath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(fullPath, 'utf8');
    await db.exec(sql);
  }
}

export async function resetTestDb(): Promise<void> {
  if (pgliteInstance) {
    await pgliteInstance.close();
    pgliteInstance = null;
  }
  await getDb();
  await runMigrations();
}

export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
  if (pgliteInstance) {
    await pgliteInstance.close();
    pgliteInstance = null;
  }
}
