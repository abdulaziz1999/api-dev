import { Router } from 'express';
import { UserController } from '../controllers/UserController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// Basic CRUD routes
router.get('/', authenticateToken, UserController.getAllUsers);
router.get('/with-relations', UserController.getUsersWithRelations);
router.get('/search', UserController.searchUsers);
router.get('/advanced', UserController.advancedQuery);

export default router;