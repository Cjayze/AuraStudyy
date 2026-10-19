import { Router, Response } from 'express';
import { getDb } from '../db';
import { authenticateToken, AuthRequest } from '../auth';
import { normalizeUploadedFilename } from '../filename';

export const dashboardRouter = Router();

// GET /api/dashboard - Metrics, recent documents and quizzes
dashboardRouter.get('/', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const db = getDb();

    const userDocs = db.documents.filter(d => d.user_id === user.id);
    const userQuizzes = db.quizzes.filter(q => q.user_id === user.id);
    const userAttempts = db.quiz_attempts.filter(a => a.user_id === user.id);

    let progress = db.learning_progress.find(p => p.user_id === user.id);
    if (!progress) {
      progress = {
        id: `prog_${user.id}`,
        user_id: user.id,
        total_documents: userDocs.length,
        total_questions_asked: 0,
        total_quizzes_completed: userAttempts.length,
        average_score: userAttempts.length > 0
          ? userAttempts.reduce((acc, curr) => acc + curr.score, 0) / userAttempts.length
          : 0,
        last_active_at: new Date().toISOString()
      };
    }

    // Sort recent docs
    const recentDocs = [...userDocs]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5)
      .map(d => ({
        id: d.id,
        title: d.title,
        subject: d.subject,
        file_name: normalizeUploadedFilename(d.file_name),
        file_type: d.file_type,
        file_size: d.file_size,
        status: d.status,
        created_at: d.created_at
      }));

    // Sort recent quizzes
    const recentQuizzes = [...userAttempts]
      .sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime())
      .slice(0, 5)
      .map(att => {
        const quiz = db.quizzes.find(q => q.id === att.quiz_id);
        return {
          id: att.id,
          quiz_id: att.quiz_id,
          title: quiz ? quiz.title : 'Bài kiểm tra',
          score: att.score,
          correct_count: att.correct_count,
          total_questions: att.total_questions,
          completed_at: att.completed_at
        };
      });

    // Score trends (sample dates or recent attempts)
    const scoreTrends = userAttempts.length > 0
      ? userAttempts.slice(-5).map((att, idx) => ({
          label: `Quiz #${idx + 1}`,
          score: att.score,
          date: new Date(att.completed_at).toLocaleDateString('vi-VN')
        }))
      : [
          { label: 'Quiz #1', score: 75, date: '28/08' },
          { label: 'Quiz #2', score: 85, date: '01/09' },
          { label: 'Quiz #3', score: 90, date: '04/09' }
        ];

    return res.status(200).json({
      status: 'success',
      data: {
        metrics: {
          total_documents: userDocs.length,
          total_questions_asked: progress.total_questions_asked || 0,
          total_quizzes_completed: userAttempts.length,
          average_score: userAttempts.length > 0
            ? Math.round((userAttempts.reduce((acc, curr) => acc + curr.score, 0) / userAttempts.length) * 10) / 10
            : progress.average_score || 0
        },
        recent_documents: recentDocs,
        recent_quizzes: recentQuizzes,
        score_trends: scoreTrends
      }
    });
  } catch (error: any) {
    return res.status(500).json({
      status: 'error',
      message: 'Lỗi khi tải thông tin dashboard.',
      error: error?.message
    });
  }
});
