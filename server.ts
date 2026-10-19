import 'dotenv/config';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { authRouter } from './server/routes/authRoutes';
import { documentRouter } from './server/routes/documentRoutes';
import { dashboardRouter } from './server/routes/dashboardRoutes';
import { chatRouter } from './server/routes/chatRoutes';
import { quizRouter } from './server/routes/quizRoutes';
import { getDb } from './server/db';
import { requireAuth, AuthRequest } from './src/middleware/auth.ts';
import { getUsers } from './src/db/users.ts';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Initialize DB in memory/disk
  getDb();

  // Middleware
  app.use(express.json({ limit: '20mb' }));
  app.use(express.urlencoded({ extended: true, limit: '20mb' }));

  // Request logger for API calls
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    }
    next();
  });

  // API Health Check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'AuraStudy Backend Engine',
      version: '1.0.0',
      timestamp: new Date().toISOString()
    });
  });

  // API Routes
  app.use('/api/auth', authRouter);
  app.use('/api/documents', documentRouter);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/chat', chatRouter);
  app.use('/api/quizzes', quizRouter);

  // Cloud SQL Database Users API endpoint
  app.get('/api/users', requireAuth, async (req: AuthRequest, res) => {
    try {
      const users = await getUsers();
      res.json(users);
    } catch (error: any) {
      console.error('Failed to fetch users from Cloud SQL:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch users' });
    }
  });

  // Catch-all for API routes to never return HTML fallback
  app.all('/api/*', (req, res) => {
    res.status(404).json({
      status: 'error',
      message: `API endpoint không tồn tại: ${req.method} ${req.path}`
    });
  });

  // Global API error handler ensuring JSON is always returned for API errors
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.path.startsWith('/api') || req.xhr) {
      console.error(`[API Error] ${req.method} ${req.path}:`, err);
      const statusCode = err.status || err.statusCode || 500;
      return res.status(statusCode).json({
        status: 'error',
        message: err.message || 'Lỗi xử lý nội bộ máy chủ.'
      });
    }
    next(err);
  });

  // Static uploads directory
  const uploadsDir = path.join(process.cwd(), 'uploads');
  app.use('/uploads', express.static(uploadsDir));

  // Vite middleware for development vs static build for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 AuraStudy Server is running at http://localhost:${PORT}`);
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim() === '') {
      console.warn('⚠️ [AuraStudy] CẢNH BÁO: Chưa tìm thấy GEMINI_API_KEY hợp lệ trong file .env!');
      console.warn('⚠️ Hệ thống sẽ tự động dùng bộ sinh dự phòng cục bộ (Heuristic). Để tạo câu hỏi chất lượng cao bằng Gemini AI chuẩn NotebookLM, vui lòng tạo file .env và điền: GEMINI_API_KEY="AIzaSy..."');
    } else {
      console.log('✅ [AuraStudy] Đã phát hiện GEMINI_API_KEY. Sẵn sàng tạo Quiz chuẩn NotebookLM bằng Gemini AI!');
    }
  });
}

startServer();
