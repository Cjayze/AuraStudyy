import { Router, Response } from 'express';
import { getDb, saveDb, ChatSession, ChatMessage } from '../db';
import { authenticateToken, AuthRequest } from '../auth';
import { askAuraAI, summarizeDocument } from '../rag';

export const chatRouter = Router();

// POST /api/chat/ask - Ask question with RAG pipeline
chatRouter.post('/ask', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const { question, document_id, session_id } = req.body;

    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Vui lòng nhập câu hỏi bạn muốn Aura AI giải đáp.'
      });
    }

    const db = getDb();

    // Find or create session
    let session: ChatSession | undefined;
    if (session_id) {
      session = db.chat_sessions.find(s => s.id === session_id && s.user_id === user.id);
    }

    if (!session) {
      // Find document title if document_id provided
      let title = question.trim().slice(0, 45);
      if (question.length > 45) title += '...';

      if (document_id) {
        const doc = db.documents.find(d => d.id === document_id);
        if (doc) {
          title = `${doc.title.slice(0, 30)} - Hỏi đáp`;
        }
      }

      session = {
        id: `sess_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        user_id: user.id,
        document_id: document_id || undefined,
        title,
        created_at: new Date().toISOString()
      };
      db.chat_sessions.push(session);
    }

    // Get previous messages for conversation memory
    const existingMessages = db.chat_messages
      .filter(m => m.session_id === session!.id)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    const history = existingMessages.map(m => ({
      sender_type: m.sender_type,
      content: m.content
    }));

    // Record User Message
    const userMsg: ChatMessage = {
      id: `msg_${Date.now()}_u`,
      session_id: session.id,
      sender_type: 'user',
      content: question.trim(),
      created_at: new Date().toISOString()
    };
    db.chat_messages.push(userMsg);

    // Call RAG Pipeline
    const ragResult = await askAuraAI({
      question: question.trim(),
      documentId: document_id || session.document_id,
      userId: user.id,
      conversationHistory: history
    });

    // Record AI Response Message
    const aiMsg: ChatMessage = {
      id: `msg_${Date.now()}_ai`,
      session_id: session.id,
      sender_type: 'ai',
      content: ragResult.answer,
      context_sources: ragResult.sources,
      created_at: new Date().toISOString()
    };
    db.chat_messages.push(aiMsg);

    // Update student's learning progress
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
    progress.total_questions_asked = (progress.total_questions_asked || 0) + 1;
    progress.last_active_at = new Date().toISOString();

    saveDb();

    return res.status(200).json({
      status: 'success',
      data: {
        session: {
          id: session.id,
          title: session.title,
          document_id: session.document_id
        },
        user_message: userMsg,
        ai_message: aiMsg,
        sources: ragResult.sources
      }
    });
  } catch (error: any) {
    return res.status(500).json({
      status: 'error',
      message: 'Lỗi trong quá trình xử lý câu hỏi với Aura AI.',
      error: error?.message
    });
  }
});

// POST /api/chat/summarize - Summarize document with AI
chatRouter.post('/summarize', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const { document_id } = req.body;

    if (!document_id) {
      return res.status(400).json({
        status: 'error',
        message: 'Vui lòng cung cấp document_id của tài liệu cần tóm tắt.'
      });
    }

    const summaryResult = await summarizeDocument(document_id, user.id);

    return res.status(200).json({
      status: 'success',
      message: 'Tóm tắt tài liệu bằng Aura AI thành công!',
      data: summaryResult
    });
  } catch (error: any) {
    return res.status(500).json({
      status: 'error',
      message: error?.message || 'Lỗi khi tạo bản tóm tắt tài liệu.',
      error: error?.message
    });
  }
});

// GET /api/chat/sessions - List user chat sessions
chatRouter.get('/sessions', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const db = getDb();

    const sessions = db.chat_sessions
      .filter(s => s.user_id === user.id)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const result = sessions.map(s => {
      const messages = db.chat_messages.filter(m => m.session_id === s.id);
      const lastMsg = messages.length > 0
        ? messages.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
        : null;

      const doc = s.document_id ? db.documents.find(d => d.id === s.document_id) : null;

      return {
        id: s.id,
        title: s.title,
        document_id: s.document_id,
        document_title: doc ? doc.title : undefined,
        message_count: messages.length,
        last_message: lastMsg ? {
          content: lastMsg.content.slice(0, 80) + (lastMsg.content.length > 80 ? '...' : ''),
          sender_type: lastMsg.sender_type,
          created_at: lastMsg.created_at
        } : null,
        created_at: s.created_at
      };
    });

    return res.status(200).json({
      status: 'success',
      data: result
    });
  } catch (error: any) {
    return res.status(500).json({
      status: 'error',
      message: 'Lỗi khi tải danh sách các phiên trò chuyện.',
      error: error?.message
    });
  }
});

// GET /api/chat/sessions/:id - Get session messages
chatRouter.get('/sessions/:id', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const db = getDb();

    const session = db.chat_sessions.find(s => s.id === id && s.user_id === user.id);
    if (!session) {
      return res.status(404).json({
        status: 'error',
        message: 'Phiên hỏi đáp không tồn tại.'
      });
    }

    const messages = db.chat_messages
      .filter(m => m.session_id === id)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    const doc = session.document_id ? db.documents.find(d => d.id === session.document_id) : null;

    return res.status(200).json({
      status: 'success',
      data: {
        session: {
          ...session,
          document_title: doc ? doc.title : undefined
        },
        messages
      }
    });
  } catch (error: any) {
    return res.status(500).json({
      status: 'error',
      message: 'Lỗi khi tải tin nhắn của phiên trò chuyện.',
      error: error?.message
    });
  }
});

// DELETE /api/chat/sessions/:id - Delete session
chatRouter.delete('/sessions/:id', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const db = getDb();

    const sIndex = db.chat_sessions.findIndex(s => s.id === id && s.user_id === user.id);
    if (sIndex === -1) {
      return res.status(404).json({
        status: 'error',
        message: 'Phiên hội thoại không tồn tại.'
      });
    }

    // Cascade delete messages
    db.chat_messages = db.chat_messages.filter(m => m.session_id !== id);
    db.chat_sessions.splice(sIndex, 1);
    saveDb();

    return res.status(200).json({
      status: 'success',
      message: 'Đã xóa phiên hỏi đáp và lịch sử hội thoại thành công.'
    });
  } catch (error: any) {
    return res.status(500).json({
      status: 'error',
      message: 'Lỗi khi xóa phiên trò chuyện.',
      error: error?.message
    });
  }
});
