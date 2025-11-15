import express from 'express';
import { UserController } from '../controllers/UserController.js';

const app = express()

app.get('/api/users', UserController.getAllUsers);
app.get('/api/users/with-relations', UserController.getUsersWithRelations);
// router.get('/search', UserController.searchUsers);
// router.get('/advanced', UserController.advancedQuery);
app.get('/', (_req, res) => {
  res.send('Hello Express!')
})

app.get('/api/users/:id', (_req, res) => {
  res.json({ id: _req.params.id })
})

app.get('/api/posts/:postId/comments/:commentId', (_req, res) => {
  res.json({ postId: _req.params.postId, commentId: _req.params.commentId })
})

// Health check
app.get('/health', (_req, res) => {
  res.json({
    success: true, 
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

export default app
