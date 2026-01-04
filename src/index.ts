import cors from 'cors';
import express from 'express';
import { AuthController } from '../controllers/AuthController.js';
import { authenticateToken } from '../middleware/auth.js';
import routeUser from '../routes/users.js';
import routeAuth from '../routes/auth.js';

const app = express()

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/v1/users', routeUser);
app.use('/api/v1/auth', routeAuth);

// app.post('/api/register', AuthController.register);
// app.post('/api/login', AuthController.login);
// app.post('/api/verify', AuthController.verifyToken);
// app.post('/api/refresh', AuthController.refreshToken);
// app.get('/api/me', authenticateToken, AuthController.getProfile);


// app.get('/api/users/:id', (_req, res) => {
//   res.json({ id: _req.params.id })
// })

// app.get('/api/posts/:postId/comments/:commentId', (_req, res) => {
//   res.json({ postId: _req.params.postId, commentId: _req.params.commentId })
// })

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
// const port = process.env.PORT || 3001;
// app.listen(port, () => {
//   console.log(`Example app listening on port ${port}`);
// });
export default app
