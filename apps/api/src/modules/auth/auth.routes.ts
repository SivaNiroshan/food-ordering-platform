import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authRateLimit } from '../../middleware/rate-limit.js';
import { authController } from './auth.controller.js';

export const authRouter = Router();
authRouter.post('/register', authRateLimit, authController.register);
authRouter.post('/login', authRateLimit, authController.login);
authRouter.post('/refresh', authController.refresh);
authRouter.post('/logout', authController.logout);

export const meRouter = Router();
meRouter.get('/', authenticate, authController.me);