import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { extractTextFromFile, splitIntoChunks, cleanText } from './parser';
import { createPool } from '../src/db/index.ts';

export interface User {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  role: 'student' | 'admin';
  avatar_url?: string;
  school?: string;
  is_active: boolean;
  created_at: string;
}

export interface Document {
  id: string;
  user_id: string;
  title: string;
  subject: string;
  file_name: string;
  file_type: string;
  file_size: number;
  file_path: string;
  status: 'processing' | 'ready' | 'error';
  raw_text?: string;
  created_at: string;
}

export interface DocumentChunk {
  id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  char_count: number;
  vector_id?: string;
}

export interface ChatSession {
  id: string;
  user_id: string;
  document_id?: string;
  title: string;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  sender_type: 'user' | 'ai';
  content: string;
  context_sources?: Array<{
    document_id?: string;
    document_title?: string;
    chunk_index: number;
    similarity_score: number;
    content: string;
  }>;
  created_at: string;
}

export interface Quiz {
  id: string;
  document_id: string;
  user_id: string;
  title: string;
  difficulty: 'easy' | 'medium' | 'hard';
  total_questions: number;
  created_at: string;
}

export interface Question {
  id: string;
  quiz_id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  options?: string[];
  correct_ans: string;
  explanation: string;
  concept_tested?: string;
}

export interface QuizAttempt {
  id: string;
  quiz_id: string;
  user_id: string;
  score: number;
  correct_count: number;
  total_questions: number;
  time_spent_sec: number;
  completed_at: string;
}

export interface QuizAnswer {
  id: string;
  attempt_id: string;
  question_id: string;
  selected_option: string;
  is_correct: boolean;
}

export interface LearningProgress {
  id: string;
  user_id: string;
  total_documents: number;
  total_questions_asked: number;
  total_quizzes_completed: number;
  average_score: number;
  last_active_at: string;
}

export interface FlashcardSet {
  id: string; user_id: string; document_id?: string; title: string; subject: string;
  description?: string; creation_method: 'manual' | 'ai'; created_at: string; updated_at: string;
}
export interface Flashcard {
  id: string; set_id: string; front_text: string; back_text: string; position: number;
  created_at: string; updated_at: string;
}
export interface FlashcardProgress {
  id: string; user_id: string; flashcard_id: string; status: 'new' | 'learning' | 'known';
  review_count: number; last_reviewed_at?: string; updated_at: string;
}

export interface DatabaseState {
  users: User[];
  documents: Document[];
  document_chunks: DocumentChunk[];
  chat_sessions: ChatSession[];
  chat_messages: ChatMessage[];
  quizzes: Quiz[];
  questions: Question[];
  quiz_attempts: QuizAttempt[];
  quiz_answers: QuizAnswer[];
  learning_progress: LearningProgress[];
  flashcard_sets: FlashcardSet[];
  flashcards: Flashcard[];
  flashcard_progress: FlashcardProgress[];
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initial Seed Data generator
function initializeSeedData(): DatabaseState {
  const salt = bcrypt.genSaltSync(10);
  const adminHash = bcrypt.hashSync('Admin123@', salt);

  const adminUser: User = {
    id: 'usr_admin_01',
    email: 'admin@aurastudy.edu.vn',
    password_hash: adminHash,
    full_name: 'Trần Quản Trị',
    role: 'admin',
    avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    is_active: true,
    created_at: new Date(Date.now() - 30 * 86400000).toISOString()
  };

  // Sample Documents with complete CS content
  const doc1Id = 'doc_db_norm_01';
  const doc1Content = `HỆ QUẢN TRỊ CƠ SỞ DỮ LIỆU - CHƯƠNG 5: CHUẨN HÓA DỮ LIỆU (DATABASE NORMALIZATION)
1. KHÁI NIỆM CHUẨN HÓA:
Chuẩn hóa dữ liệu là quá trình tổ chức lại các bảng và thuộc tính trong cơ sở dữ liệu quan hệ nhằm mục tiêu:
- Giảm thiểu tối đa dư thừa dữ liệu (Data Redundancy).
- Tránh các dị thường (Anomalies) khi thao tác dữ liệu: Dị thường thêm mới (Insertion Anomaly), Dị thường xóa (Deletion Anomaly) và Dị thường sửa đổi (Update Anomaly).
- Bảo đảm tính toàn vẹn dữ liệu (Data Integrity).

2. CÁC DẠNG CHUẨN (NORMAL FORMS):
- Dạng chuẩn 1 (1NF - First Normal Form): Một quan hệ đạt chuẩn 1NF khi và chỉ khi mọi thuộc tính đều chứa giá trị nguyên tố (Atomic values), không có thuộc tính đa trị (Multivalued) hay thuộc tính phức hợp.
- Dạng chuẩn 2 (2NF - Second Normal Form): Một quan hệ đạt 2NF khi và chỉ khi nó đã đạt 1NF và mọi thuộc tính không khóa đều phụ thuộc hàm đầy đủ (Full Functional Dependency) vào khóa chính, không phụ thuộc vào một phần của khóa chính.
- Dạng chuẩn 3 (3NF - Third Normal Form): Một quan hệ đạt 3NF khi đã đạt 2NF và không có thuộc tính không khóa nào phụ thuộc bắc cầu (Transitive Dependency) vào khóa chính.
- Dạng chuẩn Boyce-Codd (BCNF): Là dạng mở rộng chặt chẽ hơn của 3NF. Quan hệ đạt BCNF nếu với mọi phụ thuộc hàm không tầm thường X -> Y, thì X phải là một siêu khóa (Superkey).

3. TÍNH CHẤT GIAO DỊCH (ACID PROPERTIES):
- Atomicity (Tính nguyên tử): Giao dịch được thực thi trọn vẹn hoặc bị hủy bỏ hoàn toàn ("All or Nothing").
- Consistency (Tính nhất quán): Giao dịch đưa CSDL từ trạng thái hợp lệ này sang trạng thái hợp lệ khác, tuân thủ mọi ràng buộc toàn vẹn.
- Isolation (Tính cô lập): Các giao dịch thực thi đồng thời không được can thiệp lẫn nhau.
- Durability (Tính bền vững): Một khi giao dịch đã Commit thành công, kết quả sẽ được lưu trữ vĩnh viễn ngay cả khi hệ thống gặp sự cố mất điện.`;

  const doc1: Document = {
    id: doc1Id,
    user_id: adminUser.id,
    title: 'Hệ Quản Trị CSDL - Chương 5: Chuẩn Hóa Dữ Liệu & ACID',
    subject: 'Cơ sở dữ liệu',
    file_name: 'Database_Normalization_ACID.pdf',
    file_type: 'pdf',
    file_size: 1048576,
    file_path: '/uploads/Database_Normalization_ACID.pdf',
    status: 'ready',
    raw_text: doc1Content,
    created_at: new Date(Date.now() - 3 * 86400000).toISOString()
  };

  const doc2Id = 'doc_networks_02';
  const doc2Content = `MẠNG MÁY TÍNH CĂN BẢN - CHƯƠNG 3: MÔ HÌNH OSI & GIAO THỨC TCP/IP
1. MÔ HÌNH OSI 7 TẦNG:
- Tầng 7: Application (Ứng dụng) - HTTP, FTP, DNS, SMTP.
- Tầng 6: Presentation (Trình diễn) - Mã hóa, nén dữ liệu, định dạng JPEG, ASCII.
- Tầng 5: Session (Phiên) - Thiết lập, duy trì và đồng bộ phiên giao tiếp.
- Tầng 4: Transport (Vận chuyển) - TCP (hướng kết nối, tin cậy, có bắt tay 3 bước), UDP (phi kết nối, tốc độ cao, dùng cho video stream/DNS).
- Tầng 3: Network (Mạng) - Định tuyến gói tin (Routing), địa chỉ IP (IPv4, IPv6), giao thức ICMP, OSPF, BGP.
- Tầng 2: Data Link (Liên kết dữ liệu) - Khung tin (Frames), địa chỉ MAC, giao thức Ethernet, chuyển mạch Switch.
- Tầng 1: Physical (Vật lý) - Bit truyền qua cáp đồng, cáp quang, sóng vô tuyến.

2. CƠ CHẾ BẮT TAY 3 BƯỚC CỦA TCP (3-WAY HANDSHAKE):
- Bước 1: Client gửi cờ SYN với số thứ tự ngẫu nhiên (Seq = x).
- Bước 2: Server phản hồi gói tin SYN-ACK với Ack = x + 1 và Seq = y.
- Bước 3: Client gửi gói tin ACK với Ack = y + 1. Kết nối chính thức được thiết lập.`;

  const doc2: Document = {
    id: doc2Id,
    user_id: adminUser.id,
    title: 'Mạng Máy Tính - Mô hình OSI 7 Tầng & TCP/IP',
    subject: 'Mạng máy tính',
    file_name: 'Computer_Networks_OSI_TCP.pdf',
    file_type: 'pdf',
    file_size: 2097152,
    file_path: '/uploads/Computer_Networks_OSI_TCP.pdf',
    status: 'ready',
    raw_text: doc2Content,
    created_at: new Date(Date.now() - 5 * 86400000).toISOString()
  };

  // Generate chunks for doc 1
  const doc1Chunks: DocumentChunk[] = [
    {
      id: 'chk_d1_01',
      document_id: doc1Id,
      chunk_index: 0,
      content: '1. KHÁI NIỆM CHUẨN HÓA: Chuẩn hóa dữ liệu là quá trình tổ chức lại các bảng và thuộc tính trong cơ sở dữ liệu quan hệ nhằm mục tiêu: Giảm thiểu tối đa dư thừa dữ liệu (Data Redundancy), Tránh các dị thường khi thao tác dữ liệu (Insertion, Deletion, Update Anomaly) và Bảo đảm tính toàn vẹn dữ liệu.',
      char_count: 310
    },
    {
      id: 'chk_d1_02',
      document_id: doc1Id,
      chunk_index: 1,
      content: '2. CÁC DẠNG CHUẨN: Dạng chuẩn 1 (1NF): Mọi thuộc tính đều chứa giá trị nguyên tố (Atomic values), không có thuộc tính đa trị. Dạng chuẩn 2 (2NF): Đã đạt 1NF và mọi thuộc tính không khóa đều phụ thuộc hàm đầy đủ vào khóa chính. Dạng chuẩn 3 (3NF): Đã đạt 2NF và không có thuộc tính không khóa nào phụ thuộc bắc cầu vào khóa chính. Dạng chuẩn BCNF: Với mọi phụ thuộc hàm X -> Y thì X phải là một siêu khóa.',
      char_count: 418
    },
    {
      id: 'chk_d1_03',
      document_id: doc1Id,
      chunk_index: 2,
      content: '3. TÍNH CHẤT GIAO DỊCH (ACID PROPERTIES): Atomicity (Tính nguyên tử): Tất cả hoặc không có gì (All or Nothing). Consistency (Tính nhất quán): CSDL luôn tuân thủ mọi ràng buộc toàn vẹn trước và sau giao dịch. Isolation (Tính cô lập): Các giao dịch đồng thời không can thiệp lẫn nhau. Durability (Tính bền vững): Dữ liệu Commit được lưu trữ vĩnh viễn ngay cả khi mất điện.',
      char_count: 375
    }
  ];

  // Generate chunks for doc 2
  const doc2Chunks: DocumentChunk[] = [
    {
      id: 'chk_d2_01',
      document_id: doc2Id,
      chunk_index: 0,
      content: '1. MÔ HÌNH OSI 7 TẦNG: Tầng 7 Application (HTTP, DNS). Tầng 6 Presentation (Mã hóa, định dạng JPEG). Tầng 5 Session (Duy trì phiên). Tầng 4 Transport (TCP hướng kết nối tin cậy; UDP phi kết nối tốc độ cao). Tầng 3 Network (Định tuyến, địa chỉ IP). Tầng 2 Data Link (Khung tin Frames, địa chỉ MAC). Tầng 1 Physical (Bit vật lý).',
      char_count: 334
    },
    {
      id: 'chk_d2_02',
      document_id: doc2Id,
      chunk_index: 1,
      content: '2. CƠ CHẾ BẮT TAY 3 BƯỚC CỦA TCP (3-WAY HANDSHAKE): Bước 1: Client gửi cờ SYN với số thứ tự ngẫu nhiên (Seq = x). Bước 2: Server phản hồi gói tin SYN-ACK với Ack = x + 1 và Seq = y. Bước 3: Client gửi gói tin ACK với Ack = y + 1. Kết nối chính thức được thiết lập.',
      char_count: 268
    }
  ];

  // Seed sample Quiz
  const quiz1Id = 'quiz_db_01';
  const quiz1: Quiz = {
    id: quiz1Id,
    document_id: doc1Id,
    user_id: adminUser.id,
    title: 'Kiểm tra Chuẩn hóa CSDL & ACID (5 câu)',
    difficulty: 'medium',
    total_questions: 5,
    created_at: new Date(Date.now() - 2 * 86400000).toISOString()
  };

  const questions: Question[] = [
    {
      id: 'q_01',
      quiz_id: quiz1Id,
      question_text: 'Điều kiện tiên quyết để một quan hệ đạt Dạng chuẩn 1 (1NF) là gì?',
      option_a: 'Không có phụ thuộc bắc cầu vào khóa chính.',
      option_b: 'Tất cả các thuộc tính chỉ chứa giá trị nguyên tố (Atomic values).',
      option_c: 'Khóa chính phải là khóa đơn vị một cột.',
      option_d: 'Mọi phụ thuộc hàm X -> Y thì X phải là siêu khóa.',
      correct_ans: 'B',
      explanation: 'Theo định nghĩa 1NF, tất cả các thuộc tính phải chứa giá trị nguyên tố, không cho phép thuộc tính đa trị hoặc phức hợp.'
    },
    {
      id: 'q_02',
      quiz_id: quiz1Id,
      question_text: 'Một quan hệ đạt 1NF cần thêm điều kiện gì để đạt Dạng chuẩn 2 (2NF)?',
      option_a: 'Mọi thuộc tính không khóa phải phụ thuộc hàm đầy đủ vào khóa chính.',
      option_b: 'Không chứa thuộc tính khóa ngoại.',
      option_c: 'Loại bỏ toàn bộ phụ thuộc bắc cầu.',
      option_d: 'Bảng phải có ít nhất 3 thuộc tính.',
      correct_ans: 'A',
      explanation: 'Dạng chuẩn 2NF loại bỏ các phụ thuộc bộ phận; mọi thuộc tính không khóa phải phụ thuộc hàm đầy đủ vào toàn bộ khóa chính.'
    },
    {
      id: 'q_03',
      quiz_id: quiz1Id,
      question_text: 'Trong tính chất ACID của hệ quản trị cơ sở dữ liệu, chữ "A" đại diện cho tính chất nào?',
      option_a: 'Availability (Tính sẵn sàng cao).',
      option_b: 'Accuracy (Tính chính xác tuyệt đối).',
      option_c: 'Atomicity (Tính nguyên tử - All or Nothing).',
      option_d: 'Authentication (Tính xác thực người dùng).',
      correct_ans: 'C',
      explanation: 'Chữ A trong ACID đại diện cho Atomicity (Tính nguyên tử), đảm bảo giao dịch thực thi trọn vẹn hoặc bị hủy bỏ hoàn toàn nếu có lỗi.'
    },
    {
      id: 'q_04',
      quiz_id: quiz1Id,
      question_text: 'Dạng chuẩn nào khắt khe hơn 3NF bằng cách yêu cầu mọi định thức X trong phụ thuộc hàm X -> Y phải là siêu khóa?',
      option_a: '1NF',
      option_b: '2NF',
      option_c: '4NF',
      option_d: 'Boyce-Codd Normal Form (BCNF)',
      correct_ans: 'D',
      explanation: 'BCNF yêu cầu nghiêm ngặt hơn 3NF: Với mọi phụ thuộc hàm không tầm thường X -> Y, X bắt buộc phải là một siêu khóa (Superkey).'
    },
    {
      id: 'q_05',
      quiz_id: quiz1Id,
      question_text: 'Tính chất nào trong ACID bảo đảm rằng một khi giao dịch đã Commit, dữ liệu sẽ tồn tại bền vững ngay cả khi mất điện?',
      option_a: 'Consistency',
      option_b: 'Durability',
      option_c: 'Isolation',
      option_d: 'Atomicity',
      correct_ans: 'B',
      explanation: 'Durability (Tính bền vững) đảm bảo các thay đổi của giao dịch đã commit sẽ không bị mất kể cả khi hệ điều hành hoặc máy chủ bị tắt nguồn đột ngột.'
    }
  ];

  const attempt1: QuizAttempt = {
    id: 'att_01',
    quiz_id: quiz1Id,
    user_id: adminUser.id,
    score: 100,
    correct_count: 5,
    total_questions: 5,
    time_spent_sec: 145,
    completed_at: new Date(Date.now() - 1 * 86400000).toISOString()
  };

  const progress: LearningProgress = {
    id: `prog_${adminUser.id}`,
    user_id: adminUser.id,
    total_documents: 2,
    total_questions_asked: 14,
    total_quizzes_completed: 1,
    average_score: 100.0,
    last_active_at: new Date().toISOString()
  };

  return {
    users: [adminUser],
    documents: [doc1, doc2],
    document_chunks: [...doc1Chunks, ...doc2Chunks],
    chat_sessions: [],
    chat_messages: [],
    quizzes: [quiz1],
    questions,
    quiz_attempts: [attempt1],
    quiz_answers: [],
    learning_progress: [progress],
    flashcard_sets: [], flashcards: [], flashcard_progress: []
  };
}

let db: DatabaseState | null = null;

// Load or initialize DB
export function getDb(): DatabaseState {
  if (db) {
    return db;
  }

  if (fs.existsSync(DB_FILE)) {
    try {
      const data = fs.readFileSync(DB_FILE, 'utf-8');
      db = JSON.parse(data);
      if (db) {
        db.flashcard_sets = db.flashcard_sets || [];
        db.flashcards = db.flashcards || [];
        db.flashcard_progress = db.flashcard_progress || [];
        // Purge any legacy demo student account
        db.users = (db.users || []).filter(u => u.id !== 'usr_student_01' && u.email !== 'student@aurastudy.edu.vn');
        db.learning_progress = (db.learning_progress || []).filter(p => p.user_id !== 'usr_student_01');
        db.quiz_attempts = (db.quiz_attempts || []).filter(a => a.user_id !== 'usr_student_01');
        db.chat_sessions = (db.chat_sessions || []).filter(s => s.user_id !== 'usr_student_01');
        (db.documents || []).forEach(d => {
          if (d.user_id === 'usr_student_01') d.user_id = 'usr_admin_01';
        });
        (db.quizzes || []).forEach(q => {
          if (q.user_id === 'usr_student_01') q.user_id = 'usr_admin_01';
        });
      }
    } catch (e) {
      console.warn('Could not read db.json, re-initializing seed data:', e);
      db = initializeSeedData();
      saveDb();
    }
  } else {
    db = initializeSeedData();
    saveDb();
  }
  return db!;
}

export function saveDb(): void {
  if (!db) return;
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
    syncToPostgres().catch(err => {
      console.warn('Background Supabase/PostgreSQL sync notice:', err?.message || err);
    });
  } catch (err) {
    console.error('Failed to write database file:', err);
  }
}

export async function syncToPostgres(): Promise<void> {
  if (!db) return;
  try {
    const pool = createPool();
    await pool.query('ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "options" jsonb');
    // 1. Sync users
    for (const u of db.users) {
      if (u.id === 'usr_student_01' || u.email === 'student@aurastudy.edu.vn') continue;
      await pool.query(
        `INSERT INTO "users" (id, uid, email, password_hash, full_name, school, role, avatar_url, is_active, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (id) DO UPDATE SET
           email = EXCLUDED.email,
           password_hash = COALESCE(EXCLUDED.password_hash, users.password_hash),
           full_name = EXCLUDED.full_name,
           school = EXCLUDED.school;`,
        [u.id, u.id, u.email, u.password_hash || '', u.full_name || u.email, u.school || '', u.role || 'student', u.avatar_url || '', u.is_active ?? true, u.created_at || new Date().toISOString()]
      );
    }

    // 2. Sync documents
    for (const doc of db.documents) {
      await pool.query(
        `INSERT INTO "documents" (id, user_id, title, subject, file_name, file_type, file_size, file_path, status, raw_text, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (id) DO NOTHING;`,
        [doc.id, doc.user_id, doc.title, doc.subject || 'General', doc.file_name, doc.file_type, doc.file_size || 0, doc.file_path, doc.status || 'ready', doc.raw_text || '', doc.created_at || new Date().toISOString()]
      );
    }

    // 3. Sync quizzes and questions
    for (const q of db.quizzes) {
      await pool.query(
        `INSERT INTO "quizzes" (id, document_id, user_id, title, difficulty, total_questions, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO NOTHING;`,
        [q.id, q.document_id, q.user_id, q.title, q.difficulty || 'medium', q.total_questions || 0, q.created_at || new Date().toISOString()]
      );
    }

    for (const item of (db.questions || [])) {
      await pool.query(
        `INSERT INTO "questions" (id, quiz_id, question_text, option_a, option_b, option_c, option_d, correct_ans, explanation, options)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
         ON CONFLICT (id) DO NOTHING;`,
        [item.id, item.quiz_id, item.question_text, item.option_a || '', item.option_b || '', item.option_c || '', item.option_d || '', item.correct_ans || 'A', item.explanation || '', item.options ? JSON.stringify(item.options) : null]
      );
    }

    // 4. Sync quiz attempts
    for (const att of (db.quiz_attempts || [])) {
      await pool.query(
        `INSERT INTO "quiz_attempts" (id, quiz_id, user_id, score, correct_count, total_questions, time_spent_sec, completed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO NOTHING;`,
        [att.id, att.quiz_id, att.user_id, att.score, att.correct_count, att.total_questions, att.time_spent_sec || 0, att.completed_at || new Date().toISOString()]
      );
    }

    // 5. Sync learning progress
    for (const prog of (db.learning_progress || [])) {
      await pool.query(
        `INSERT INTO "learning_progress" (id, user_id, total_documents, total_questions_asked, total_quizzes_completed, average_score, last_active_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (user_id) DO UPDATE SET total_documents = EXCLUDED.total_documents, average_score = EXCLUDED.average_score, last_active_at = EXCLUDED.last_active_at;`,
        [prog.id, prog.user_id, prog.total_documents || 0, prog.total_questions_asked || 0, prog.total_quizzes_completed || 0, prog.average_score || 0, prog.last_active_at || new Date().toISOString()]
      );
    }

    // Flashcards use the same PostgreSQL database as the existing application.
    for (const set of (db.flashcard_sets || [])) {
      await pool.query(`INSERT INTO flashcard_sets (id,user_id,document_id,title,subject,description,creation_method,created_at,updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title,subject=EXCLUDED.subject,description=EXCLUDED.description,document_id=EXCLUDED.document_id,updated_at=EXCLUDED.updated_at`,
      [set.id,set.user_id,set.document_id || null,set.title,set.subject,set.description || null,set.creation_method,set.created_at,set.updated_at]);
    }
    for (const card of (db.flashcards || [])) {
      await pool.query(`INSERT INTO flashcards (id,set_id,front_text,back_text,position,created_at,updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO UPDATE SET front_text=EXCLUDED.front_text,back_text=EXCLUDED.back_text,position=EXCLUDED.position,updated_at=EXCLUDED.updated_at`,
      [card.id,card.set_id,card.front_text,card.back_text,card.position,card.created_at,card.updated_at]);
    }
    for (const progress of (db.flashcard_progress || [])) {
      await pool.query(`INSERT INTO flashcard_progress (id,user_id,flashcard_id,status,review_count,last_reviewed_at,updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (user_id,flashcard_id) DO UPDATE SET status=EXCLUDED.status,review_count=EXCLUDED.review_count,last_reviewed_at=EXCLUDED.last_reviewed_at,updated_at=EXCLUDED.updated_at`,
      [progress.id,progress.user_id,progress.flashcard_id,progress.status,progress.review_count,progress.last_reviewed_at || null,progress.updated_at]);
    }
    await pool.query('DELETE FROM flashcard_sets WHERE NOT (id = ANY($1::text[]))', [(db.flashcard_sets || []).map(item => item.id)]);
    await pool.query('DELETE FROM flashcards WHERE NOT (id = ANY($1::text[]))', [(db.flashcards || []).map(item => item.id)]);
    await pool.query('DELETE FROM flashcard_progress WHERE NOT (id = ANY($1::text[]))', [(db.flashcard_progress || []).map(item => item.id)]);
  } catch (error) {
    // Non-blocking log to ensure normal app operations proceed
    console.debug('syncToPostgres error:', error);
  }
}

/**
 * Self-healing helper: ensures a document has clean, human-readable text
 * and regenerates RAG chunks if it was previously corrupted by binary stream fallback.
 */
export async function ensureDocumentCleanText(doc: Document): Promise<string> {
  const needsRepair =
    !doc.raw_text ||
    doc.raw_text.startsWith('%PDF-') ||
    doc.raw_text.startsWith('PK\x03\x04') ||
    doc.raw_text.includes('\uFFFD') ||
    doc.raw_text.length > 500000;

  if (needsRepair) {
    const fullPath = path.join(process.cwd(), doc.file_path);
    if (fs.existsSync(fullPath)) {
      try {
        const fileBuffer = fs.readFileSync(fullPath);
        const clean = await extractTextFromFile(fileBuffer, doc.file_type || 'pdf');
        doc.raw_text = clean;

        // Rebuild clean chunks for this document
        const currentDb = getDb();
        currentDb.document_chunks = currentDb.document_chunks.filter(c => c.document_id !== doc.id);
        const newChunks = splitIntoChunks(clean, 600, 100);
        newChunks.forEach((chunk, index) => {
          currentDb.document_chunks.push({
            id: `chk_${doc.id}_${index}`,
            document_id: doc.id,
            chunk_index: chunk.chunk_index,
            content: chunk.content,
            char_count: chunk.char_count,
            vector_id: `vec_${doc.id}_${index}`
          });
        });

        // Also clean out any legacy quizzes associated with this corrupt document
        currentDb.quizzes = currentDb.quizzes.filter(q => q.document_id !== doc.id);

        saveDb();
        console.log(`[Self-Healing] Repaired document "${doc.title}" with ${clean.length} clean characters and ${newChunks.length} chunks.`);
        return clean;
      } catch (err) {
        console.warn(`[Self-Healing] Failed to re-extract document ${doc.id}:`, err);
      }
    }
  }
  return cleanText(doc.raw_text || '');
}
