import { Router } from 'express';
import { AuthController } from '../controllers/AuthController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

router.post('/register', AuthController.register);
router.post('/login', AuthController.login);
router.post('/verify', AuthController.verifyToken);
router.post('/refresh', AuthController.refreshToken);
router.get('/me', authenticateToken, AuthController.getProfile);

export default router;