import { Request, Response, NextFunction } from 'express';
import { GrantService } from './grant.service.js';
import { DownloadTokenService } from './download-token.service.js';
import {
  CreateGrantRequestSchema,
  CreateDownloadTokenRequestSchema,
} from '@trustvault/shared';

const grantService = new GrantService();
const tokenService = new DownloadTokenService();

export class SharingController {
  /**
   * Create document grant
   */
  static async createGrant(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const documentId = req.params.id;
      const validated = CreateGrantRequestSchema.parse(req.body);

      const result = await grantService.createGrant(req.user!, documentId, {
        granteeUsernameOrEmail: validated.granteeUsernameOrEmail,
        permission: validated.permission,
        expiresInHours: validated.expiresInHours,
      });

      if (!result.success) {
        res.status(result.statusCode || 400).json({
          success: false,
          error: {
            code: result.errorCode || 'GRANT_FAILED',
            message: result.errorMessage || 'Failed to create grant',
          },
        });
        return;
      }

      res.status(201).json({
        success: true,
        data: result.data,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * List document grants
   */
  static async listGrants(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const documentId = req.params.id;
      const result = await grantService.listGrants(req.user!, documentId);

      if (!result.success) {
        res.status(result.statusCode || 404).json({
          success: false,
          error: {
            code: result.errorCode || 'NOT_FOUND',
            message: result.errorMessage || 'Document not found',
          },
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: result.data,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Revoke document grant
   */
  static async revokeGrant(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id: documentId, grantId } = req.params;
      const result = await grantService.revokeGrant(req.user!, documentId, grantId);

      if (!result.success) {
        res.status(result.statusCode || 404).json({
          success: false,
          error: {
            code: result.errorCode || 'REVOKE_FAILED',
            message: result.errorMessage || 'Failed to revoke grant',
          },
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          message: 'Grant revoked successfully',
          grant: result.data,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Issue a 60-second single-use download token
   */
  static async createDownloadToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const documentId = req.params.id;
      const parsed = CreateDownloadTokenRequestSchema.parse(req.body);

      const result = await tokenService.issueToken(req.user!, documentId, parsed.versionNumber);

      if (!result.success) {
        res.status(result.statusCode || 400).json({
          success: false,
          error: {
            code: result.errorCode || 'TOKEN_ISSUE_FAILED',
            message: result.errorMessage || 'Failed to issue download token',
          },
        });
        return;
      }

      res.status(201).json({
        success: true,
        data: {
          token: result.token,
          expiresAt: result.expiresAt,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Redeem one-time download token and stream file
   */
  static async downloadWithToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const token = req.query.token as string;
      const result = await tokenService.redeemToken(token, req.user);

      if (!result.success || !result.stream) {
        res.status(result.statusCode || 400).json({
          success: false,
          error: {
            code: result.errorCode || 'REDEMPTION_FAILED',
            message: result.errorMessage || 'Failed to redeem token',
          },
        });
        return;
      }

      res.setHeader('Content-Type', result.mimeType || 'application/octet-stream');
      if (result.fileSize) {
        res.setHeader('Content-Length', result.fileSize);
      }
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(result.fileName || 'download')}"`);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      if (result.sha256Checksum) {
        res.setHeader('X-File-Checksum-SHA256', result.sha256Checksum);
      }

      result.stream.pipe(res);
    } catch (err) {
      next(err);
    }
  }
}
