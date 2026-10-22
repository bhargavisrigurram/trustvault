import { Request, Response, NextFunction } from 'express';
import { SessionService } from '../modules/auth/session.service.js';
import { config } from '../config/index.js';
import type { UserRoleType } from '@trustvault/shared';

const sessionService = new SessionService();

/**
 * Extract and validate session from HttpOnly cookie
 */
export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const sessionId = req.cookies[config.session.cookieName];

  if (!sessionId) {
    req.user = undefined;
    req.session = undefined;
    return next();
  }

  const result = await sessionService.validateSession(sessionId);

  if (result.valid && result.user && result.session) {
    req.user = result.user;
    req.session = result.session;
    req.sessionId = sessionId;
    return next();
  }

  // Clear stale/expired session cookie
  res.clearCookie(config.session.cookieName, {
    httpOnly: true,
    secure: config.session.cookieSecure,
    sameSite: config.session.sameSite,
  });

  req.user = undefined;
  req.session = undefined;
  return next();
}

/**
 * Strict authentication guard
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || !req.session) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required to access this resource',
      },
    });
    return;
  }
  next();
}

/**
 * Role-based authorization guard (for administrative / user management routes)
 */
export function requireRole(allowedRoles: UserRoleType[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to access this administrative resource',
        },
      });
      return;
    }

    next();
  };
}

/**
 * CSRF protection middleware for state-changing requests
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  // Safe HTTP methods do not require CSRF token
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) {
    return next();
  }

  // Skip CSRF check for initial unauthenticated login/register endpoints
  const isAuthEntry = req.path === '/api/auth/login' || req.path === '/api/auth/register';
  if (isAuthEntry) {
    return next();
  }

  if (!req.session) {
    // If not authenticated, requireAuth will handle it later if needed
    return next();
  }

  const clientToken = req.headers['x-csrf-token'];

  if (!clientToken || clientToken !== req.session.csrf_token) {
    res.status(403).json({
      success: false,
      error: {
        code: 'INVALID_CSRF_TOKEN',
        message: 'CSRF token is missing or invalid',
      },
    });
    return;
  }

  next();
}
