import { Request, Response, NextFunction } from 'express';
import { AuditService } from './audit.service.js';

const auditService = new AuditService();

export class AuditController {
  /**
   * Verify the cryptographic hash chain from Genesis to Head
   */
  static async verify(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await auditService.verifyChain();
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * List audit logs with optional filters and pagination
   */
  static async listLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const eventType = req.query.eventType as string | undefined;
      const outcome = req.query.outcome as string | undefined;
      const actorId = req.query.actorId as string | undefined;
      const targetId = req.query.targetId as string | undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

      const result = await auditService.queryLogs({
        eventType,
        outcome,
        actorId,
        targetId,
        limit,
        offset,
      });

      res.status(200).json({
        success: true,
        data: {
          records: result.records,
          totalCount: result.totalCount,
          limit,
          offset,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get detected security anomalies
   */
  static async getAnomalies(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const anomalies = await auditService.getSecurityAnomalies();
      res.status(200).json({
        success: true,
        data: anomalies,
      });
    } catch (err) {
      next(err);
    }
  }
}
