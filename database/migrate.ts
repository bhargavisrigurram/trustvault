import { runMigrations, closeDb } from '../apps/api/src/db/index.js';

async function main() {
  try {
    console.log('[Migrate] Applying PostgreSQL migrations...');
    await runMigrations();
    console.log('[Migrate] Migrations applied successfully.');
  } catch (error) {
    console.error('[Migrate Error]:', error);
    process.exit(1);
  } finally {
    await closeDb();
  }
}

main();
