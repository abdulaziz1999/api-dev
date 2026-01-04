import { Router } from 'express';
import { AuthController } from '../controllers/AuthController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

router.post('/api/register', AuthController.register);
router.post('/api/login', AuthController.login);
router.post('/api/verify', AuthController.verifyToken);
router.post('/api/refresh', AuthController.refreshToken);
router.get('/api/me', authenticateToken, AuthController.getProfile);

export default router;