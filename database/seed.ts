import { getDb, runMigrations, closeDb } from '../apps/api/src/db/index.js';
import { hashPassword } from '../apps/api/src/modules/auth/password.js';

export async function seedDatabase() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Database seeding is strictly forbidden in production!');
  }

  console.log('[Seed] Ensuring migrations are applied...');
  await runMigrations();

  const db = await getDb();

  console.log('[Seed] Seeding development accounts...');

  const devAccounts = [
    {
      username: 'admin_user',
      email: 'admin@trustvault.local',
      password: 'AdminPassword123!',
      role: 'admin',
    },
    {
      username: 'owner_user',
      email: 'owner@trustvault.local',
      password: 'OwnerPassword123!',
      role: 'owner',
    },
    {
      username: 'viewer_user',
      email: 'viewer@trustvault.local',
      password: 'ViewerPassword123!',
      role: 'viewer',
    },
  ];

  for (const acc of devAccounts) {
    const existing = await db.query('SELECT id FROM users WHERE username = $1', [acc.username]);
    if (existing.rows.length === 0) {
      const passwordHash = await hashPassword(acc.password);
      await db.query(
        `INSERT INTO users (username, email, password_hash, role, is_active)
         VALUES ($1, $2, $3, $4, TRUE)`,
        [acc.username, acc.email, passwordHash, acc.role]
      );
      console.log(`[Seed] Created account: ${acc.username} (${acc.role})`);
    } else {
      console.log(`[Seed] Account ${acc.username} already exists. Skipping.`);
    }
  }

  console.log('[Seed] Completed successfully.');
}

if (process.argv[1]?.includes('seed.ts')) {
  seedDatabase()
    .catch((err) => {
      console.error('[Seed Error]:', err);
      process.exit(1);
    })
    .finally(() => closeDb());
}
