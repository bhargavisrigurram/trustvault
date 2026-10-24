import { Router } from 'express';
import { AiController } from './ai.controller.js';
import { requireAuth } from '../../middleware/auth.middleware.js';

const router = Router();

// All AI operations require authentication
router.use(requireAuth);

router.get('/status', AiController.getStatus);
router.post('/summarize', AiController.summarize);
router.post('/security-scan', AiController.securityScan);
router.post('/chat', AiController.chat);
router.post('/quick-scan', AiController.quickScan);

export const aiRoutes = router;
