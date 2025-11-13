import express from 'express';

const app = express()

// Health check
// app.get('/health', (_req, res) => {
//   res.json({ 
//     success: true, 
//     message: 'Server is running',
//     timestamp: new Date().toISOString()
//   });
// });

// 404 handler
// app.use('*', (_req, res) => {
//   res.status(404).json({
//     success: false,
//     message: 'Route not found'
//   });
// });

app.get('/', (_req, res) => {
  res.send('Hello Express!')
})

app.get('/api/users/:id', (_req, res) => {
  res.json({ id: _req.params.id })
})

app.get('/api/posts/:postId/comments/:commentId', (_req, res) => {
  res.json({ postId: _req.params.postId, commentId: _req.params.commentId })
})

export default app
