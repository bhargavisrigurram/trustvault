import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { config } from '../config/index.js';

export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'", config.frontendUrl, 'https:', 'wss:'],
      fontSrc: ["'self'", 'data:'],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: null,
    },
  },

  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'same-origin' },
  dnsPrefetchControl: { allow: false },
  frameguard: { action: 'deny' },
  hidePoweredBy: true,
  hsts: config.env === 'production' ? { maxAge: 31536000, includeSubDomains: true } : false,
  ieNoOpen: true,
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xssFilter: true,
});

export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);

    const allowedOrigins = [
      config.frontendUrl,
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:5173',
      'http://127.0.0.1:5173',
    ];

    const isAllowedCloudOrTunnel =
      origin.endsWith('.onrender.com') ||
      origin.endsWith('.railway.app') ||
      origin.endsWith('.vercel.app') ||
      origin.endsWith('.fly.dev') ||
      origin.endsWith('.loca.lt') ||
      origin.endsWith('.trycloudflare.com') ||
      origin.endsWith('.ngrok-free.app') ||
      origin.endsWith('.ngrok.io');

    if (allowedOrigins.includes(origin) || isAllowedCloudOrTunnel) {
      callback(null, true);
    } else {
      callback(new Error('CORS request rejected: Origin not allowed'));
    }


  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-CSRF-Token', 'Authorization'],
  exposedHeaders: ['Content-Disposition'],
});

export const loginRateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxAttempts,
  skipSuccessfulRequests: true, // Legitimate logins never consume brute-force quota
  skip: () => config.env === 'test' || process.env.NODE_ENV === 'test',
  keyGenerator: (req) => {
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const target = req.body?.usernameOrEmail ? String(req.body.usernameOrEmail).toLowerCase().trim() : '';
    return `${ip}:${target}`;
  },
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many failed login attempts. Please wait a moment and try again.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});
