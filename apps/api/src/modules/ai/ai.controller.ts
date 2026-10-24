import { Request, Response, NextFunction } from 'express';
import { AiService } from './ai.service.js';
import { DocumentRepository } from '../documents/document.repository.js';
import { AuditService } from '../audit/audit.service.js';
import { authorize } from '../authorization/index.js';
import {
  DocumentAction,
  AuditEventType,
  AuditOutcome,
  AiDocumentSummaryRequestSchema,
  AiSecurityScanRequestSchema,
  AiChatRequestSchema,
  AiQuickScanRequestSchema,
} from '@trustvault/shared';

const aiService = new AiService();
const docRepo = new DocumentRepository();
const auditService = new AuditService();

export class AiController {
  /**
   * Get AI engine status & availability
   */
  static async getStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const customKey = (req.query.key as string) || (req.headers['x-gemini-key'] as string);
      const status = aiService.getEngineStatus(customKey);
      res.status(200).json({
        success: true,
        data: status,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * AI Document Summarization & Key Insights
   */
  static async summarize(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = AiDocumentSummaryRequestSchema.parse(req.body);
      const user = req.user!;
      const customKey = (req.headers['x-gemini-key'] as string) || undefined;

      // 1. Fetch document metadata
      const doc = await docRepo.findById(validated.documentId);
      if (!doc || doc.is_deleted) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Document not found',
          },
        });
        return;
      }

      // 2. Mandatory central authorization check: READ permission required
      const authRes = await authorize(user, doc, DocumentAction.READ);
      if (!authRes.allowed) {
        await auditService.recordEvent({
          eventType: AuditEventType.ACCESS_DENIED,
          actorId: user.id,
          actorUsername: user.username,
          targetType: 'document',
          targetId: doc.id,
          outcome: AuditOutcome.DENIED,
          details: {
            action: 'ai.summarize',
            reason: authRes.reason,
          },
        });

        res.status(authRes.statusCode || 404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: authRes.reason || 'Document not found',
          },
        });
        return;
      }

      // 3. Resolve version and extract text
      const verNum = validated.versionNumber ?? doc.current_version_number;
      const version = await docRepo.findVersionByNumber(doc.id, verNum);
      if (!version) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Document version not found',
          },
        });
        return;
      }

      const content = await aiService.extractDocumentContent(
        version.storage_key,
        version.mime_type,
        version.file_name
      );

      // 4. Run AI Summarizer
      const result = await aiService.summarizeDocument(
        content,
        { title: doc.title, category: doc.category },
        customKey
      );

      // 5. Append-only audit record
      await auditService.recordEvent({
        eventType: AuditEventType.AI_DOCUMENT_ANALYSIS,
        actorId: user.id,
        actorUsername: user.username,
        targetType: 'document',
        targetId: doc.id,
        outcome: AuditOutcome.SUCCESS,
        details: {
          action: 'ai.summarize',
          engine: result.sourceEngine,
          versionNumber: verNum,
        },
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * AI Security & Privacy DLP Scan
   */
  static async securityScan(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = AiSecurityScanRequestSchema.parse(req.body);
      const user = req.user!;
      const customKey = (req.headers['x-gemini-key'] as string) || undefined;

      // 1. Fetch document metadata
      const doc = await docRepo.findById(validated.documentId);
      if (!doc || doc.is_deleted) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Document not found',
          },
        });
        return;
      }

      // 2. Mandatory central authorization check: READ permission required
      const authRes = await authorize(user, doc, DocumentAction.READ);
      if (!authRes.allowed) {
        await auditService.recordEvent({
          eventType: AuditEventType.ACCESS_DENIED,
          actorId: user.id,
          actorUsername: user.username,
          targetType: 'document',
          targetId: doc.id,
          outcome: AuditOutcome.DENIED,
          details: {
            action: 'ai.security_scan',
            reason: authRes.reason,
          },
        });

        res.status(authRes.statusCode || 404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: authRes.reason || 'Document not found',
          },
        });
        return;
      }

      // 3. Resolve version and extract text
      const verNum = validated.versionNumber ?? doc.current_version_number;
      const version = await docRepo.findVersionByNumber(doc.id, verNum);
      if (!version) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Document version not found',
          },
        });
        return;
      }

      const content = await aiService.extractDocumentContent(
        version.storage_key,
        version.mime_type,
        version.file_name
      );

      // 4. Run Security DLP scanner
      const result = await aiService.scanSecurityDlp(
        content,
        { title: doc.title },
        customKey
      );

      // 5. Append-only audit record
      await auditService.recordEvent({
        eventType: AuditEventType.AI_SECURITY_SCAN,
        actorId: user.id,
        actorUsername: user.username,
        targetType: 'document',
        targetId: doc.id,
        outcome: AuditOutcome.SUCCESS,
        details: {
          action: 'ai.security_scan',
          riskLevel: result.riskLevel,
          riskScore: result.riskScore,
          findingsCount: result.findings.length,
          engine: result.sourceEngine,
        },
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Interactive Vault AI Copilot & Document Q&A
   */
  static async chat(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = AiChatRequestSchema.parse(req.body);
      const user = req.user!;
      const customKey = validated.apiKey || (req.headers['x-gemini-key'] as string) || undefined;

      let documentContext: { title: string; content: string; category: string } | undefined = undefined;

      // If querying against a specific document, verify authorization
      if (validated.documentId) {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(validated.documentId);
        if (!isUuid) {
          res.status(404).json({
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: 'Document not found',
            },
          });
          return;
        }

        const doc = await docRepo.findById(validated.documentId);
        if (!doc || doc.is_deleted) {
          res.status(404).json({
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: 'Document not found',
            },
          });
          return;
        }

        const authRes = await authorize(user, doc, DocumentAction.READ);
        if (!authRes.allowed) {
          await auditService.recordEvent({
            eventType: AuditEventType.ACCESS_DENIED,
            actorId: user.id,
            actorUsername: user.username,
            targetType: 'document',
            targetId: doc.id,
            outcome: AuditOutcome.DENIED,
            details: {
              action: 'ai.chat',
              reason: authRes.reason,
            },
          });

          res.status(authRes.statusCode || 404).json({
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: authRes.reason || 'Document not found',
            },
          });
          return;
        }

        const version = await docRepo.findVersionByNumber(doc.id, doc.current_version_number);
        if (version) {
          const content = await aiService.extractDocumentContent(
            version.storage_key,
            version.mime_type,
            version.file_name
          );
          documentContext = {
            title: doc.title,
            category: doc.category,
            content: content.text,
          };
        }
      }

      const result = await aiService.chatWithCopilot(
        validated.message,
        documentContext,
        validated.history,
        customKey
      );

      // Audit chat interaction
      await auditService.recordEvent({
        eventType: AuditEventType.AI_CHAT_QUERY,
        actorId: user.id,
        actorUsername: user.username,
        targetType: validated.documentId ? 'document' : 'vault',
        targetId: validated.documentId || null,
        outcome: AuditOutcome.SUCCESS,
        details: {
          action: 'ai.chat',
          hasDocumentContext: !!documentContext,
          engine: result.sourceEngine,
        },
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Pre-upload quick scan for uncommitted text/metadata
   */
  static async quickScan(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = AiQuickScanRequestSchema.parse(req.body);
      const result = await aiService.quickScan(validated.text, validated.fileName);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
}
