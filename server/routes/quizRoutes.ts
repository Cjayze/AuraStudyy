import { Router, Response } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { getDb, saveDb, ensureDocumentCleanText, Quiz, Question, QuizAttempt, QuizAnswer, LearningProgress } from '../db';
import { getUploadsDir } from '../storage';
import { authenticateToken, AuthRequest } from '../auth';
import { generateQuizFromDocument, analyzeQuizWeaknesses } from '../quizGenerator';
import { extractTextFromFile, splitIntoChunks } from '../parser';
import { normalizeUploadedFilename } from '../filename';
import { parseMultipleChoiceExam } from '../quizImporter';

export const quizRouter = Router();

const importUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.pdf', '.docx', '.txt'].includes(ext)) return cb(null, true);
    return cb(new Error('Định dạng chưa được hỗ trợ. Vui lòng tải lên file PDF, DOCX hoặc TXT.'));
  }
});

const handleImportUpload = (req: any, res: Response, next: any) => {
  importUpload.single('file')(req, res, (err: any) => {
    if (!err) return next();
    const message = err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE'
      ? 'File vượt quá dung lượng tối đa 25MB.'
      : err.message || 'File tải lên không hợp lệ.';
    return res.status(400).json({ status: 'error', message });
  });
};

function saveImportedQuiz(userId: string, documentId: string, title: string, importedQuestions: ReturnType<typeof parseMultipleChoiceExam>) {
  const db = getDb();
  const now = new Date().toISOString();
  const quizId = `quiz_import_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const quiz: Quiz = {
    id: quizId,
    document_id: documentId,
    user_id: userId,
    title,
    difficulty: 'medium',
    total_questions: importedQuestions.length,
    created_at: now
  };
  const questionRecords: Question[] = importedQuestions.map((question, index) => ({
    id: `question_${quizId}_${index + 1}`,
    quiz_id: quizId,
    ...question
  }));

  db.quizzes.push(quiz);
  db.questions.push(...questionRecords);

  let progress = db.learning_progress.find((item) => item.user_id === userId);
  if (!progress) {
    progress = {
      id: `prog_${userId}`,
      user_id: userId,
      total_documents: db.documents.filter((document) => document.user_id === userId).length,
      total_questions_asked: 0,
      total_quizzes_completed: 0,
      average_score: 0,
      last_active_at: now
    };
    db.learning_progress.push(progress);
  }
  progress.total_documents = db.documents.filter((document) => document.user_id === userId).length;
  progress.last_active_at = now;
  saveDb();
  return quiz;
}

// Create a quiz using text already extracted and stored for a library document.
quizRouter.post('/import-document', authenticateToken, async (req: AuthRequest, res: Response) => {
  const documentId = String(req.body?.document_id || '');
  const user = req.user!;
  const db = getDb();
  const document = db.documents.find((item) => item.id === documentId && item.user_id === user.id);
  if (!document) {
    return res.status(404).json({ status: 'error', message: 'Không tìm thấy file trong thư viện tài liệu của bạn.' });
  }

  try {
    const extractedText = await ensureDocumentCleanText(document);
    const importedQuestions = parseMultipleChoiceExam(extractedText);
    const quiz = saveImportedQuiz(user.id, document.id, document.title, importedQuestions);
    return res.status(201).json({
      status: 'success',
      message: `Đã nhập ${importedQuestions.length} câu hỏi từ file đã tải lên.`,
      data: { quiz, question_count: importedQuestions.length }
    });
  } catch (error: any) {
    return res.status(400).json({
      status: 'error',
      message: error?.message || 'Không thể nhận diện câu hỏi trắc nghiệm trong tài liệu này.'
    });
  }
});

// POST /api/quizzes/import - Import every question from a multiple-choice exam file.
quizRouter.post('/import', authenticateToken, handleImportUpload, async (req: AuthRequest, res: Response) => {
  const file = req.file;
  if (!file) {
    return res.status(400).json({ status: 'error', message: 'Vui lòng chọn file đề trắc nghiệm.' });
  }

  const originalName = normalizeUploadedFilename(file.originalname);
  const extension = path.extname(originalName).toLowerCase().slice(1);
  let extractedText: string;
  let importedQuestions;

  try {
    extractedText = await extractTextFromFile(file.buffer, extension);
    importedQuestions = parseMultipleChoiceExam(extractedText);
  } catch (error: any) {
    return res.status(400).json({
      status: 'error',
      message: error?.message || 'Không thể đọc câu hỏi trong file. Hãy kiểm tra định dạng và nội dung đề.'
    });
  }

  const user = req.user!;
  const db = getDb();
  const now = new Date().toISOString();
  const docId = `doc_quiz_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const uploadsDir = getUploadsDir();
  const filePath = `${docId}_${Date.now()}.${extension}`;

  try {
    fs.mkdirSync(uploadsDir, { recursive: true });
    fs.writeFileSync(path.join(uploadsDir, filePath), file.buffer);

    const title = path.parse(originalName).name || 'Imported multiple-choice exam';
    const sourceDocument = {
      id: docId,
      user_id: user.id,
      title,
      subject: 'Đề trắc nghiệm',
      file_name: originalName,
      file_type: extension,
      file_size: file.size,
      file_path: `/uploads/${filePath}`,
      status: 'ready' as const,
      raw_text: extractedText,
      created_at: now
    };
    db.documents.push(sourceDocument);
    splitIntoChunks(extractedText, 600, 100).forEach((chunk) => {
      db.document_chunks.push({
        id: `chunk_${docId}_${chunk.chunk_index}`,
        document_id: docId,
        chunk_index: chunk.chunk_index,
        content: chunk.content,
        char_count: chunk.char_count,
        vector_id: `vector_${docId}_${chunk.chunk_index}`
      });
    });
    const quiz = saveImportedQuiz(user.id, docId, title, importedQuestions);

    return res.status(201).json({
      status: 'success',
      message: `Đã nhập ${importedQuestions.length} câu hỏi từ file.`,
      data: { quiz, question_count: importedQuestions.length }
    });
  } catch (error: any) {
    try { fs.unlinkSync(path.join(uploadsDir, filePath)); } catch { /* Ignore cleanup errors. */ }
    return res.status(500).json({
      status: 'error',
      message: error?.message || 'Không thể lưu đề thi đã nhập.'
    });
  }
});

// POST /api/quizzes/generate - Generate Quiz from Document with AI
quizRouter.post('/generate', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const targetDocId = req.body.document_id || req.body.documentId;
    const targetDifficulty = req.body.difficulty || 'medium';
    const targetQuestionCount = req.body.question_count || req.body.questionCount || 5;
    const targetCustomTopic = req.body.custom_topic || req.body.customTopic;

    if (!targetDocId) {
      return res.status(400).json({
        status: 'error',
        message: 'Vui lòng cung cấp document_id của tài liệu học tập cần tạo đề thi.'
      });
    }

    const countNum = parseInt(String(targetQuestionCount), 10) || 5;
    const validCount = Math.min(Math.max(countNum, 3), 20); // 3 to 20 questions
    const validDiff = ['easy', 'medium', 'hard'].includes(targetDifficulty) ? targetDifficulty : 'medium';

    const result = await generateQuizFromDocument({
      documentId: targetDocId,
      userId: user.id,
      difficulty: validDiff as 'easy' | 'medium' | 'hard',
      questionCount: validCount,
      customTopic: targetCustomTopic
    });

    saveDb();

    return res.status(201).json({
      status: 'success',
      message: `Đã khởi tạo thành công đề thi trắc nghiệm gồm ${result.questions.length} câu hỏi bằng Aura AI!`,
      data: {
        quiz: result.quiz,
        questions: result.questions
      }
    });
  } catch (error: any) {
    return res.status(500).json({
      status: 'error',
      message: error?.message || 'Lỗi trong quá trình tạo bộ câu hỏi trắc nghiệm.',
      error: error?.message
    });
  }
});

// GET /api/quizzes - List quizzes for current user
quizRouter.get('/', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const db = getDb();

    const userQuizzes = db.quizzes.filter(q => q.user_id === user.id);

    const result = userQuizzes.map(q => {
      const doc = db.documents.find(d => d.id === q.document_id);
      const attempts = db.quiz_attempts.filter(a => a.quiz_id === q.id && a.user_id === user.id);
      
      let bestScore: number | null = null;
      let lastAttemptAt: string | null = null;

      if (attempts.length > 0) {
        bestScore = Math.max(...attempts.map(a => a.score));
        const sorted = [...attempts].sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime());
        lastAttemptAt = sorted[0].completed_at;
      }

      return {
        id: q.id,
        title: q.title,
        difficulty: q.difficulty,
        total_questions: q.total_questions,
        created_at: q.created_at,
        document_id: q.document_id,
        document_title: doc ? doc.title : 'Tài liệu không xác định',
        subject: doc ? doc.subject : '',
        attempts_count: attempts.length,
        best_score: bestScore,
        last_attempt_at: lastAttemptAt
      };
    });

    return res.status(200).json({
      status: 'success',
      data: result
    });
  } catch (error: any) {
    return res.status(500).json({
      status: 'error',
      message: 'Lỗi khi tải danh sách đề thi trắc nghiệm.',
      error: error?.message
    });
  }
});

// GET /api/quizzes/:id - Get Quiz details and questions
quizRouter.get('/:id', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const { mode } = req.query; // 'take' (exam mode - no answers) or 'review' (show answers)
    const db = getDb();

    const quiz = db.quizzes.find(q => q.id === id && q.user_id === user.id);
    if (!quiz) {
      return res.status(404).json({
        status: 'error',
        message: 'Bộ đề thi không tồn tại hoặc bạn không có quyền truy cập.'
      });
    }

    const doc = db.documents.find(d => d.id === quiz.document_id);
    const questions = db.questions.filter(q => q.quiz_id === id);

    // Exam anti-cheat mode: Hide correct_ans and explanation when taking exam
    const isReview = mode === 'review';
    const sanitizedQuestions = questions.map(q => ({
      id: q.id,
      quiz_id: q.quiz_id,
      question_text: q.question_text,
      option_a: q.option_a,
      option_b: q.option_b,
      option_c: q.option_c,
      option_d: q.option_d,
      ...(q.options?.length ? { options: q.options } : {}),
      ...(isReview ? { correct_ans: q.correct_ans, explanation: q.explanation } : {})
    }));

    const attempts = db.quiz_attempts.filter(a => a.quiz_id === id && a.user_id === user.id);

    return res.status(200).json({
      status: 'success',
      data: {
        quiz: {
          ...quiz,
          document_title: doc ? doc.title : 'Tài liệu bài học',
          subject: doc ? doc.subject : ''
        },
        questions: sanitizedQuestions,
        previous_attempts_count: attempts.length
      }
    });
  } catch (error: any) {
    return res.status(500).json({
      status: 'error',
      message: 'Lỗi khi tải thông tin bộ đề trắc nghiệm.',
      error: error?.message
    });
  }
});

// POST /api/quizzes/:id/submit - Submit quiz answers & auto-grade
quizRouter.post('/:id/submit', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const { answers = [], time_spent_sec = 0 } = req.body;
    const db = getDb();

    const quiz = db.quizzes.find(q => q.id === id && q.user_id === user.id);
    if (!quiz) {
      return res.status(404).json({
        status: 'error',
        message: 'Bộ đề thi không tồn tại.'
      });
    }

    const questions = db.questions.filter(q => q.quiz_id === id);
    if (questions.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Bộ đề chưa có câu hỏi nào để chấm điểm.'
      });
    }

    // Map answers by question_id
    const answerMap = new Map<string, string>();
    if (Array.isArray(answers)) {
      answers.forEach((ans: any) => {
        if (ans.question_id && ans.selected_option) {
          answerMap.set(ans.question_id, String(ans.selected_option).toUpperCase());
        }
      });
    }

    // Grade each question
    let correctCount = 0;
    const evaluatedResults: Array<{
      question: Question;
      selected_option: string;
      is_correct: boolean;
    }> = [];

    const attemptId = `att_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const quizAnswerRecords: QuizAnswer[] = [];

    for (const q of questions) {
      const selected = answerMap.get(q.id) || '';
      const isCorrect = selected === q.correct_ans.toUpperCase();
      if (isCorrect) {
        correctCount += 1;
      }

      evaluatedResults.push({
        question: q,
        selected_option: selected,
        is_correct: isCorrect
      });

      quizAnswerRecords.push({
        id: `ans_${attemptId}_${q.id}`,
        attempt_id: attemptId,
        question_id: q.id,
        selected_option: selected,
        is_correct: isCorrect
      });
    }

    // Calculate score on 100-point scale
    const totalQuestions = questions.length;
    const score = Math.round((correctCount / totalQuestions) * 1000) / 10; // e.g. 80.0

    // Create QuizAttempt record
    const attempt: QuizAttempt = {
      id: attemptId,
      quiz_id: quiz.id,
      user_id: user.id,
      score,
      correct_count: correctCount,
      total_questions: totalQuestions,
      time_spent_sec: Math.max(time_spent_sec, 1),
      completed_at: new Date().toISOString()
    };

    db.quiz_attempts.unshift(attempt);
    db.quiz_answers.push(...quizAnswerRecords);

    // Update Student Learning Progress
    let progress = db.learning_progress.find(p => p.user_id === user.id);
    if (!progress) {
      progress = {
        id: `prog_${user.id}`,
        user_id: user.id,
        total_documents: db.documents.filter(d => d.user_id === user.id).length,
        total_questions_asked: 0,
        total_quizzes_completed: 0,
        average_score: 0,
        last_active_at: new Date().toISOString()
      };
      db.learning_progress.push(progress);
    }

    const allUserAttempts = db.quiz_attempts.filter(a => a.user_id === user.id);
    progress.total_quizzes_completed = allUserAttempts.length;
    const sumScores = allUserAttempts.reduce((acc, cur) => acc + cur.score, 0);
    progress.average_score = Math.round((sumScores / allUserAttempts.length) * 10) / 10;
    progress.last_active_at = new Date().toISOString();

    saveDb();

    // Generate AI Weakness Analysis
    const weaknessAnalysis = analyzeQuizWeaknesses(quiz, evaluatedResults);

    // Performance Rank
    let rank = 'Cần nỗ lực thêm';
    if (score >= 90) rank = 'Xuất sắc';
    else if (score >= 80) rank = 'Giỏi';
    else if (score >= 65) rank = 'Khá';
    else if (score >= 50) rank = 'Trung bình';

    return res.status(200).json({
      status: 'success',
      message: 'Nộp bài và chấm điểm tự động thành công!',
      data: {
        attempt: {
          id: attempt.id,
          quiz_id: attempt.quiz_id,
          score: attempt.score,
          correct_count: attempt.correct_count,
          total_questions: attempt.total_questions,
          time_spent_sec: attempt.time_spent_sec,
          completed_at: attempt.completed_at,
          rank
        },
        weakness_analysis: weaknessAnalysis,
        results: evaluatedResults.map(r => ({
          question_id: r.question.id,
          question_text: r.question.question_text,
          option_a: r.question.option_a,
          option_b: r.question.option_b,
          option_c: r.question.option_c,
          option_d: r.question.option_d,
          ...(r.question.options?.length ? { options: r.question.options } : {}),
          selected_option: r.selected_option,
          correct_ans: r.question.correct_ans,
          is_correct: r.is_correct,
          explanation: r.question.explanation,
          concept_tested: r.question.concept_tested
        }))
      }
    });
  } catch (error: any) {
    return res.status(500).json({
      status: 'error',
      message: 'Lỗi khi chấm điểm bài thi trắc nghiệm.',
      error: error?.message
    });
  }
});

// GET /api/quizzes/:id/attempts - Get history of attempts for a quiz
quizRouter.get('/:id/attempts', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const db = getDb();

    const attempts = db.quiz_attempts
      .filter(a => a.quiz_id === id && a.user_id === user.id)
      .sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime());

    return res.status(200).json({
      status: 'success',
      data: attempts
    });
  } catch (error: any) {
    return res.status(500).json({
      status: 'error',
      message: 'Lỗi khi tải lịch sử làm bài.',
      error: error?.message
    });
  }
});

// GET /api/quizzes/attempts/:attempt_id - Review a specific attempt with full details
quizRouter.get('/attempts/:attempt_id', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const { attempt_id } = req.params;
    const db = getDb();

    const attempt = db.quiz_attempts.find(a => a.id === attempt_id && a.user_id === user.id);
    if (!attempt) {
      return res.status(404).json({
        status: 'error',
        message: 'Lần làm bài không tồn tại.'
      });
    }

    const quiz = db.quizzes.find(q => q.id === attempt.quiz_id);
    const questions = db.questions.filter(q => q.quiz_id === attempt.quiz_id);
    const answers = db.quiz_answers.filter(a => a.attempt_id === attempt_id);

    const detailedResults = questions.map(q => {
      const userAns = answers.find(a => a.question_id === q.id);
      return {
        question_id: q.id,
        question_text: q.question_text,
        option_a: q.option_a,
        option_b: q.option_b,
        option_c: q.option_c,
        option_d: q.option_d,
        ...(q.options?.length ? { options: q.options } : {}),
        selected_option: userAns ? userAns.selected_option : '',
        correct_ans: q.correct_ans,
        is_correct: userAns ? userAns.is_correct : false,
        explanation: q.explanation
      };
    });

    return res.status(200).json({
      status: 'success',
      data: {
        attempt,
        quiz,
        results: detailedResults
      }
    });
  } catch (error: any) {
    return res.status(500).json({
      status: 'error',
      message: 'Lỗi khi xem lại chi tiết bài làm.',
      error: error?.message
    });
  }
});

// DELETE /api/quizzes/:id - Delete quiz
quizRouter.delete('/:id', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const db = getDb();

    const qIndex = db.quizzes.findIndex(q => q.id === id);
    if (qIndex === -1) {
      return res.status(404).json({
        status: 'error',
        message: 'Bộ đề thi không tồn tại hoặc đã bị xóa.'
      });
    }

    // Cascade delete questions, attempts, and answers
    const quizAttempts = db.quiz_attempts.filter(a => a.quiz_id === id);
    const attemptIds = new Set(quizAttempts.map(a => a.id));

    db.quiz_answers = db.quiz_answers.filter(ans => !attemptIds.has(ans.attempt_id));
    db.quiz_attempts = db.quiz_attempts.filter(a => a.quiz_id !== id);
    db.questions = db.questions.filter(q => q.quiz_id !== id);
    db.quizzes.splice(qIndex, 1);

    // Recalculate learning progress
    const remainingAttempts = db.quiz_attempts.filter(a => a.user_id === user.id);
    const progress = db.learning_progress.find(p => p.user_id === user.id);
    if (progress) {
      progress.total_quizzes_completed = remainingAttempts.length;
      if (remainingAttempts.length > 0) {
        const sum = remainingAttempts.reduce((acc, c) => acc + c.score, 0);
        progress.average_score = Math.round((sum / remainingAttempts.length) * 10) / 10;
      } else {
        progress.average_score = 0;
      }
    }

    saveDb();

    return res.status(200).json({
      status: 'success',
      message: 'Đã xóa bộ đề thi và lịch sử làm bài thành công.'
    });
  } catch (error: any) {
    return res.status(500).json({
      status: 'error',
      message: 'Lỗi khi xóa bộ đề thi.',
      error: error?.message
    });
  }
});
