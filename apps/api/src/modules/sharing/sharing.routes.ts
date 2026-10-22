import { Router } from 'express';
import { SharingController } from './sharing.controller.js';
import { requireAuth } from '../../middleware/auth.middleware.js';

const router = Router();

// 1. One-time token download endpoint (authenticated by token parameter, safe GET)
router.get('/token-download', SharingController.downloadWithToken);

// 2. Grant management and token issuance routes (require session authentication)
router.post('/:id/grants', requireAuth, SharingController.createGrant);
router.get('/:id/grants', requireAuth, SharingController.listGrants);
router.delete('/:id/grants/:grantId', requireAuth, SharingController.revokeGrant);
router.post('/:id/tokens', requireAuth, SharingController.createDownloadToken);

export const sharingRoutes = router;
