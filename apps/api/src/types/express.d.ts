import { User } from '@trustvault/shared';
import { DbSession } from '../modules/auth/session.service.js';

declare global {
  namespace Express {
    interface Request {
      user?: User;
      session?: DbSession;
      sessionId?: string;
    }
  }
}

export {};
