import { Request, Response, NextFunction } from 'express';
import { RegisterRequestSchema, LoginRequestSchema } from '@trustvault/shared';
import { UserRepository } from '../users/user.repository.js';
import { SessionService } from './session.service.js';
import { hashPassword, verifyPassword } from './password.js';
import { AuditService } from '../audit/audit.service.js';
import { config } from '../../config/index.js';
import { AuditEventType, AuditOutcome } from '@trustvault/shared';

const userRepo = new UserRepository();
const sessionService = new SessionService();
const auditService = new AuditService();

export class AuthController {
  /**
   * User Registration
   */
  static async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = RegisterRequestSchema.parse(req.body);

      // Check for existing username or email
      const existingUser = await userRepo.findByUsernameOrEmail(validated.username);
      if (existingUser) {
        res.status(409).json({
          success: false,
          error: {
            code: 'USER_EXISTS',
            message: 'A user with that username or email already exists',
          },
        });
        return;
      }

      const existingEmail = await userRepo.findByEmail(validated.email);
      if (existingEmail) {
        res.status(409).json({
          success: false,
          error: {
            code: 'USER_EXISTS',
            message: 'A user with that username or email already exists',
          },
        });
        return;
      }

      const passwordHash = await hashPassword(validated.password);

      const user = await userRepo.create({
        username: validated.username,
        email: validated.email,
        passwordHash,
        role: validated.role,
      });

      res.status(201).json({
        success: true,
        data: {
          user,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * User Login with Session Rotation and Brute-Force Lockout
   */
  static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = LoginRequestSchema.parse(req.body);

      const userWithPassword = await userRepo.findByUsernameOrEmail(validated.usernameOrEmail);

      // Generic login failure message to prevent username enumeration
      const genericInvalid = async () => {
        await auditService.recordEvent({
          eventType: AuditEventType.AUTH_LOGIN_FAILURE,
          actorUsername: validated.usernameOrEmail,
          outcome: AuditOutcome.DENIED,
          details: { ip: req.ip || req.socket.remoteAddress },
        });

        res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid username or password',
          },
        });
      };

      if (!userWithPassword) {
        // Run dummy verify to mitigate timing attacks
        await verifyPassword(
          '$argon2id$v=19$m=65536,t=3,p=4$dummyhashdummyhashdummyhash$dummyhashdummyhash',
          validated.password
        );
        await genericInvalid();
        return;
      }

      // Check account active status
      if (!userWithPassword.is_active) {
        await auditService.recordEvent({
          eventType: AuditEventType.AUTH_LOGIN_FAILURE,
          actorId: userWithPassword.id,
          actorUsername: userWithPassword.username,
          outcome: AuditOutcome.DENIED,
          details: { reason: 'account_disabled' },
        });

        res.status(403).json({
          success: false,
          error: {
            code: 'ACCOUNT_DISABLED',
            message: 'Account is disabled. Please contact an administrator.',
          },
        });
        return;
      }

      // Check account lockout
      if (userWithPassword.locked_until) {
        const lockedUntil = new Date(userWithPassword.locked_until).getTime();
        if (Date.now() < lockedUntil) {
          const remainingMinutes = Math.ceil((lockedUntil - Date.now()) / (60 * 1000));
          await auditService.recordEvent({
            eventType: AuditEventType.USER_LOCKED,
            actorId: userWithPassword.id,
            actorUsername: userWithPassword.username,
            outcome: AuditOutcome.DENIED,
            details: { remainingMinutes },
          });

          res.status(429).json({
            success: false,
            error: {
              code: 'ACCOUNT_LOCKED',
              message: `Account is temporarily locked due to repeated failed logins. Please try again in ${remainingMinutes} minute(s).`,
            },
          });
          return;
        }
      }

      // Verify Argon2id password
      const isMatch = await verifyPassword(userWithPassword.password_hash, validated.password);

      if (!isMatch) {
        await userRepo.recordFailedAttempt(userWithPassword.id, config.rateLimit.lockoutMinutes);
        await genericInvalid();
        return;
      }

      // Reset failed attempts on successful login
      await userRepo.resetFailedAttempts(userWithPassword.id);

      // Rotate session: destroy any existing session and generate a fresh session ID
      const oldSessionId = req.cookies[config.session.cookieName];
      const metadata = {
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip || req.socket.remoteAddress,
      };

      const { sessionId, csrfToken } = await sessionService.rotateSession(
        oldSessionId,
        userWithPassword.id,
        metadata
      );

      // Record successful login in audit chain
      await auditService.recordEvent({
        eventType: AuditEventType.AUTH_LOGIN_SUCCESS,
        actorId: userWithPassword.id,
        actorUsername: userWithPassword.username,
        outcome: AuditOutcome.SUCCESS,
        details: { ip: metadata.ipAddress },
      });

      // Set HttpOnly, Secure, SameSite session cookie
      res.cookie(config.session.cookieName, sessionId, {
        httpOnly: true,
        secure: config.session.cookieSecure,
        sameSite: config.session.sameSite,
        maxAge: config.session.idleTimeoutMs,
        path: '/',
      });

      const user = {
        id: userWithPassword.id,
        username: userWithPassword.username,
        email: userWithPassword.email,
        role: userWithPassword.role,
        is_active: userWithPassword.is_active,
        created_at: userWithPassword.created_at,
        updated_at: userWithPassword.updated_at,
      };

      res.status(200).json({
        success: true,
        data: {
          user,
          csrfToken,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * User Logout: Invalidate server-side session and clear cookie
   */
  static async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const sessionId = req.cookies[config.session.cookieName];
      if (sessionId) {
        await sessionService.destroySession(sessionId);
      }

      if (req.user) {
        await auditService.recordEvent({
          eventType: AuditEventType.AUTH_LOGOUT,
          actorId: req.user.id,
          actorUsername: req.user.username,
          outcome: AuditOutcome.SUCCESS,
        });
      }

      res.clearCookie(config.session.cookieName, {
        httpOnly: true,
        secure: config.session.cookieSecure,
        sameSite: config.session.sameSite,
        path: '/',
      });

      res.status(200).json({
        success: true,
        data: {
          message: 'Logged out successfully',
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Current Authenticated User & CSRF Token
   */
  static async me(req: Request, res: Response): Promise<void> {
    if (!req.user || !req.session) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Not authenticated',
        },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        user: req.user,
        csrfToken: req.session.csrf_token,
      },
    });
  }
}
