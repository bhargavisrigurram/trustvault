import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 20000,
    hookTimeout: 20000,
    env: {
      NODE_ENV: 'test',
    },
    include: ['tests/**/*.test.ts'],
    alias: {
      '@trustvault/shared': path.resolve(__dirname, './packages/shared/src/index.ts'),
    },
  },
});
