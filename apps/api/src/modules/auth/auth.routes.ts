import { Router } from 'express';
import { AuthController } from './auth.controller.js';
import { authenticate, requireAuth } from '../../middleware/auth.middleware.js';
import { loginRateLimiter } from '../../middleware/security.middleware.js';

const router = Router();

router.post('/register', AuthController.register);
router.post('/login', loginRateLimiter, AuthController.login);
router.post('/logout', authenticate, AuthController.logout);
router.get('/me', authenticate, requireAuth, AuthController.me);

export const authRoutes = router;
