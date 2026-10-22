import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config();

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  apiUrl: process.env.API_URL || 'http://localhost:3000',

  session: {
    secret: process.env.SESSION_SECRET || 'dev-secret-minimum-32-characters-required-for-vault',
    cookieName: 'trustvault_session',
    idleTimeoutMs: parseInt(process.env.SESSION_IDLE_TIMEOUT_MINUTES || '30', 10) * 60 * 1000,
    absoluteTimeoutMs: parseInt(process.env.SESSION_ABSOLUTE_TIMEOUT_HOURS || '12', 10) * 60 * 60 * 1000,
    cookieSecure: process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production',
    sameSite: (process.env.NODE_ENV === 'production' ? 'strict' : 'lax') as 'strict' | 'lax',
  },

  storage: {
    filesDir: path.resolve(process.env.STORAGE_DIR || './storage/files'),
    tempDir: path.resolve(process.env.STORAGE_TEMP_DIR || './storage/temp'),
    maxFileSizeBytes: parseInt(process.env.MAX_FILE_SIZE_BYTES || '10485760', 10), // 10MB
  },

  rateLimit: {
    windowMs: parseInt(process.env.LOGIN_RATE_LIMIT_WINDOW_MS || '900000', 10),
    maxAttempts: parseInt(process.env.LOGIN_RATE_LIMIT_MAX_ATTEMPTS || '5', 10),
    lockoutMinutes: parseInt(process.env.LOGIN_LOCKOUT_MINUTES || '15', 10),
  },
};
