import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { getDb, saveDb, Document, DocumentChunk, ensureDocumentCleanText } from '../db';
import { authenticateToken, AuthRequest } from '../auth';
import { extractTextFromFile, splitIntoChunks } from '../parser';
import { normalizeUploadedFilename } from '../filename';

export const documentRouter = Router();

// Configure multer memory storage with 25MB limit and broader formats
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024 // 25MB limit
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowed = ['.pdf', '.docx', '.doc', '.pptx', '.ppt', '.txt', '.md', '.markdown', '.text', '.rtf'];
    if (allowed.includes(ext) || !ext) {
      cb(null, true);
    } else {
      cb(new Error(`Định dạng tệp "${ext}" không được hỗ trợ. Vui lòng chọn PDF, DOCX, PPTX, TXT hoặc MD.`));
    }
  }
});

// Middleware wrapper to intercept multer errors and return JSON instead of HTML
const handleUploadFile = (req: any, res: Response, next: any) => {
  upload.single('file')(req, res, (err: any) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            status: 'error',
            message: 'Tệp tải lên vượt quá dung lượng tối đa 25MB.'
          });
        }
        return res.status(400).json({
          status: 'error',
          message: `Lỗi tải tệp: ${err.message}`
        });
      }
      return res.status(400).json({
        status: 'error',
        message: err.message || 'Tệp tải lên không hợp lệ.'
      });
    }
    next();
  });
};

// GET /api/documents - List documents for current user
documentRouter.get('/', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const { search, subject } = req.query;
    const db = getDb();

    let docs = db.documents.filter(d => d.user_id === user.id);

    if (subject && typeof subject === 'string' && subject.trim() !== '') {
      docs = docs.filter(d => d.subject.toLowerCase() === subject.trim().toLowerCase());
    }

    if (search && typeof search === 'string' && search.trim() !== '') {
      const q = search.toLowerCase();
      docs = docs.filter(d =>
        d.title.toLowerCase().includes(q) ||
        d.file_name.toLowerCase().includes(q) ||
        d.subject.toLowerCase().includes(q)
      );
    }

    // Sort by created_at DESC
    docs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // Map response with chunks count
    const responseData = docs.map(d => {
      const chunksCount = db.document_chunks.filter(c => c.document_id === d.id).length;
      return {
        id: d.id,
        title: d.title,
        subject: d.subject,
        file_name: normalizeUploadedFilename(d.file_name),
        file_type: d.file_type,
        file_size: d.file_size,
        status: d.status,
        chunks_count: chunksCount,
        created_at: d.created_at
      };
    });

    return res.status(200).json({
      status: 'success',
      data: responseData
    });
  } catch (error: any) {
    return res.status(500).json({
      status: 'error',
      message: 'Lỗi khi tải danh sách tài liệu.',
      error: error?.message
    });
  }
});

// GET /api/documents/:id - Get detail & chunks info
documentRouter.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const db = getDb();

    const doc = db.documents.find(d => d.id === id && (d.user_id === user.id || user.role === 'admin'));
    if (!doc) {
      return res.status(404).json({
        status: 'error',
        message: 'Không tìm thấy tài liệu này trong hệ thống.'
      });
    }

    // Auto-heal text if document was previously stored as binary or corrupted
    await ensureDocumentCleanText(doc);

    const chunks = db.document_chunks
      .filter(c => c.document_id === doc.id)
      .sort((a, b) => a.chunk_index - b.chunk_index);

    return res.status(200).json({
      status: 'success',
      data: {
        ...doc,
        chunks_count: chunks.length,
        sample_chunks: chunks.slice(0, 3)
      }
    });
  } catch (error: any) {
    return res.status(500).json({
      status: 'error',
      message: 'Lỗi khi lấy thông tin tài liệu.',
      error: error?.message
    });
  }
});

// POST /api/documents/upload - Upload file and ingest chunks
documentRouter.post('/upload', authenticateToken, handleUploadFile, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        status: 'error',
        message: 'Vui lòng đính kèm file tài liệu cần upload.'
      });
    }

    const originalName = normalizeUploadedFilename(file.originalname);

    const title = (req.body.title || path.parse(originalName).name).trim();
    const subject = (req.body.subject || 'Chung').trim();
    const fileExt = path.extname(originalName).toLowerCase().replace('.', '') || 'bin';

    const docId = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const uploadsDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const safeFileName = `${docId}_${Date.now()}.${fileExt}`;
    const filePath = path.join(uploadsDir, safeFileName);
    fs.writeFileSync(filePath, file.buffer);

    // Text Extraction & Chunking
    let extractedText = '';
    let status: 'ready' | 'error' = 'ready';

    try {
      extractedText = await extractTextFromFile(file.buffer, fileExt);
      if (!extractedText || extractedText.trim().length === 0) {
        extractedText = `Tài liệu: ${title} (Nội dung trích xuất từ tệp ${originalName})`;
      }
    } catch (parseErr) {
      console.warn('Extraction warning:', parseErr);
      extractedText = `Tài liệu: ${title}. Tệp đã được tải lên thành công.`;
    }

    const chunks = splitIntoChunks(extractedText, 600, 100);
    if (chunks.length === 0) {
      chunks.push({
        chunk_index: 0,
        content: extractedText.slice(0, 600) || `Tài liệu: ${title}`,
        char_count: Math.min(extractedText.length, 600)
      });
    }

    const newDoc: Document = {
      id: docId,
      user_id: user.id,
      title,
      subject,
      file_name: originalName,
      file_type: fileExt,
      file_size: file.size,
      file_path: `/uploads/${safeFileName}`,
      status,
      raw_text: extractedText,
      created_at: new Date().toISOString()
    };

    const db = getDb();
    db.documents.push(newDoc);

    // Save Chunks to database
    chunks.forEach((chunk, index) => {
      const chunkRecord: DocumentChunk = {
        id: `chk_${docId}_${index}`,
        document_id: docId,
        chunk_index: chunk.chunk_index,
        content: chunk.content,
        char_count: chunk.char_count,
        vector_id: `vec_${docId}_${index}`
      };
      db.document_chunks.push(chunkRecord);
    });

    // Update student's learning progress
    let progress = db.learning_progress.find(p => p.user_id === user.id);
    if (!progress) {
      progress = {
        id: `prog_${user.id}`,
        user_id: user.id,
        total_documents: 0,
        total_questions_asked: 0,
        total_quizzes_completed: 0,
        average_score: 0,
        last_active_at: new Date().toISOString()
      };
      db.learning_progress.push(progress);
    }
    progress.total_documents = db.documents.filter(d => d.user_id === user.id).length;
    progress.last_active_at = new Date().toISOString();

    saveDb();

    return res.status(201).json({
      status: 'success',
      message: 'Tài liệu đã được tải lên, phân tích và lập chỉ mục RAG thành công!',
      data: {
        id: newDoc.id,
        title: newDoc.title,
        subject: newDoc.subject,
        file_name: newDoc.file_name,
        file_type: newDoc.file_type,
        file_size: newDoc.file_size,
        status: newDoc.status,
        chunk_count: chunks.length,
        chunks_created: chunks.length,
        created_at: newDoc.created_at
      }
    });
  } catch (error: any) {
    return res.status(500).json({
      status: 'error',
      message: 'Lỗi trong quá trình upload và băm chunk tài liệu.',
      error: error?.message
    });
  }
});

// DELETE /api/documents/:id - Delete document & chunks & associated quizzes
documentRouter.delete('/:id', authenticateToken, (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const { id } = req.params;
    const db = getDb();

    // Check if document exists
    const docIndex = db.documents.findIndex(d => d.id === id);
    if (docIndex === -1) {
      return res.status(404).json({
        status: 'error',
        message: 'Tài liệu không tồn tại hoặc đã bị xóa trước đó.'
      });
    }

    const doc = db.documents[docIndex];

    // Remove physical file from disk if exists
    if (doc.file_path) {
      const fullPath = path.join(process.cwd(), doc.file_path);
      if (fs.existsSync(fullPath)) {
        try { fs.unlinkSync(fullPath); } catch (e) { /* ignore unlink error */ }
      }
    }

    // 1. Cascade delete vector chunks
    db.document_chunks = db.document_chunks.filter(c => c.document_id !== id);

    // 2. Cascade delete quizzes generated from this document
    const quizzesToDelete = db.quizzes.filter(q => q.document_id === id);
    const quizIds = quizzesToDelete.map(q => q.id);
    if (quizIds.length > 0) {
      db.quizzes = db.quizzes.filter(q => q.document_id !== id);
      db.questions = db.questions.filter(q => !quizIds.includes(q.quiz_id));

      const attemptsToDelete = db.quiz_attempts.filter(a => quizIds.includes(a.quiz_id));
      const attemptIds = attemptsToDelete.map(a => a.id);
      db.quiz_attempts = db.quiz_attempts.filter(a => !quizIds.includes(a.quiz_id));
      db.quiz_answers = db.quiz_answers.filter(a => !attemptIds.includes(a.attempt_id));
    }

    // 3. Cascade delete chat sessions referencing this document
    const sessionsToDelete = db.chat_sessions.filter(s => s.document_id === id);
    const sessionIds = sessionsToDelete.map(s => s.id);
    if (sessionIds.length > 0) {
      db.chat_sessions = db.chat_sessions.filter(s => s.document_id !== id);
      db.chat_messages = db.chat_messages.filter(m => !sessionIds.includes(m.session_id));
    }

    // 4. Delete document
    db.documents.splice(docIndex, 1);

    // 5. Update user progress
    db.learning_progress.forEach(progress => {
      progress.total_documents = db.documents.filter(d => d.user_id === progress.user_id).length;
      progress.last_active_at = new Date().toISOString();
    });

    saveDb();

    return res.status(200).json({
      status: 'success',
      message: 'Đã xóa tài liệu và đồng bộ dọn dẹp các dữ liệu liên quan thành công.'
    });
  } catch (error: any) {
    return res.status(500).json({
      status: 'error',
      message: 'Lỗi khi xóa tài liệu.',
      error: error?.message
    });
  }
});
