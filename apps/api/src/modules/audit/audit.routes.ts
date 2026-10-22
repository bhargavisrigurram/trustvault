import { Router } from 'express';
import { AuditController } from './audit.controller.js';
import { requireAuth, requireRole } from '../../middleware/auth.middleware.js';

const router = Router();

// Admin-only audit inspection and chain verification
router.use(requireAuth);
router.use(requireRole(['admin']));

router.get('/verify', AuditController.verify);
router.get('/anomalies', AuditController.getAnomalies);
router.get('/', AuditController.listLogs);

export const auditRoutes = router;
