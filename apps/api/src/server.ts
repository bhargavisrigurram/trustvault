import { createApp } from './app.js';
import { config } from './config/index.js';
import { runMigrations, closeDb } from './db/index.js';

async function main() {
  try {
    console.log(`[TrustVault] Starting in ${config.env} mode...`);

    // Run database migrations on startup
    console.log('[TrustVault] Running database migrations...');
    await runMigrations();
    console.log('[TrustVault] Database schema is up to date.');

    const app = createApp();

    const server = app.listen(config.port, () => {
      console.log(`[TrustVault] Server listening on port ${config.port}`);
      console.log(`[TrustVault] API ready at ${config.apiUrl}`);
    });

    // Graceful shutdown handling
    const shutdown = async (signal: string) => {
      console.log(`\n[TrustVault] Received ${signal}. Starting graceful shutdown...`);
      server.close(async () => {
        console.log('[TrustVault] HTTP server closed.');
        await closeDb();
        console.log('[TrustVault] Database connections closed.');
        process.exit(0);
      });

      // Force shutdown after timeout
      setTimeout(() => {
        console.error('[TrustVault] Forceful shutdown due to timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (error) {
    console.error('[TrustVault] Startup failed:', error);
    process.exit(1);
  }
}

main();
