import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';
import { getDb, Document, Question, Quiz, ensureDocumentCleanText } from './db';

// Initialize Gemini Client
let geminiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim() === '') {
    console.warn('[QuizGenerator] Chưa tìm thấy GEMINI_API_KEY. Vui lòng cấu hình file .env để dùng Gemini AI.');
    return null;
  }
  if (!geminiClient) {
    geminiClient = new GoogleGenAI({
      apiKey: apiKey.trim()
    });
  }
  return geminiClient;
}

export interface GeneratedQuestionItem {
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_ans: 'A' | 'B' | 'C' | 'D';
  explanation: string;
  concept_tested?: string;
}

export interface GenerateQuizResult {
  quiz: Quiz;
  questions: Question[];
}

/**
 * Filter and sanitize document content:
 * Strictly eliminates cover page metadata, administrative titles, lecturer names,
 * emails, course codes, credit counts, slide counters, and textbook lists.
 */
export function sanitizeContentForQuiz(rawText: string): string {
  if (!rawText) return '';
  const lines = rawText.split('\n');
  const cleanedLines: string[] = [];

  const metaPrefixRegex = /^(trường|đại học|khoa|viện|bộ môn|học viện|giảng viên|gvhd|gv|tiến sĩ|thạc sĩ|ts\.|ths\.|pgs\.|gs\.|email|sđt|điện thoại|biên soạn|tác giả|sinh viên|mã học phần|học phần|mã môn|tín chỉ|tiết|buổi \d+|slide \d+|-- \d+ of \d+ --|cse\d+|học liệu|giáo trình tham khảo|tài liệu tham khảo|mục tiêu bài học|chuẩn đầu ra|nội dung chính của buổi)/i;

  const metadataKeywordsRegex = /(nguyễn văn tánh|tanh\.nguyenvan|phenikaa|bách khoa|duckett|lockhart|hoffman|cse702|@phenikaa|gmail\.com|edu\.vn)/i;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.length < 4) continue;
    if (metaPrefixRegex.test(trimmed)) continue;
    if (metadataKeywordsRegex.test(trimmed)) continue;
    if (/^(http:\/\/|https:\/\/|www\.)/i.test(trimmed)) continue;
    if (/^[•\-*]?\s*(buổi|slide|trang|page)\s*\d+/i.test(trimmed)) continue;
    cleanedLines.push(trimmed);
  }

  return cleanedLines.join('\n');
}

/**
 * Check if a text snippet is genuine human-readable content
 */
function isHumanReadable(str: string): boolean {
  if (!str || str.trim().length < 3) return false;
  if (str.includes('\uFFFD') || str.includes('%PDF-') || str.includes('obj<<')) return false;
  const cleanMatches = str.match(/[\p{L}\p{N}\s.,:;!?'"()\-–—/%_+=<>*&[\]{}]/gu) || [];
  return cleanMatches.length / str.length >= 0.85;
}

// Stop words and pronouns that should never be selected as a question topic
const STOP_WORDS = new Set([
  'đây', 'đó', 'kia', 'chúng', 'nó', 'họ', 'tôi', 'bạn', 'mình', 'ai',
  'bài', 'tài liệu', 'nội dung', 'phần', 'chương', 'mục', 'buổi', 'slide',
  'trang', 'hình', 'bảng', 'ví dụ', 'chú ý', 'lưu ý', 'tổng quan',
  'hiện nay', 'theo đó', 'tuy nhiên', 'ngoài ra', 'do đó', 'vì vậy',
  'bởi vì', 'mặc dù', 'như vậy', 'khi đó', 'nếu như', 'sau đó',
  'các', 'những', 'một', 'mọi', 'tất cả', 'mỗi', 'từng', 'vài',
  'thứ', 'ngày', 'năm', 'tháng', 'thời gian', 'kết quả', 'thực hành',
  'giới thiệu', 'kết luận', 'mục tiêu', 'yêu cầu', 'đề mục', 'tiêu đề'
]);

/**
 * Check if a concept is an authentic academic/technical concept,
 * strictly rejecting personal names, university names, pronouns and administrative markers.
 */
function isAcademicConcept(concept: string): boolean {
  if (!concept) return false;
  const clean = concept.trim().toLowerCase();
  if (clean.length < 3 || clean.length > 50) return false;

  if (STOP_WORDS.has(clean)) return false;

  // Check if starts with a stop word followed by a space
  for (const sw of Array.from(STOP_WORDS)) {
    if (clean === sw || clean.startsWith(sw + ' ')) {
      return false;
    }
  }

  const bannedTerms = [
    'giảng viên', 'gv', 'thầy', 'cô', 'ts.', 'tiến sĩ', 'thạc sĩ', 'pgs', 'gs.',
    'tác giả', 'biên soạn', 'email', 'sđt', 'điện thoại', 'phenikaa', 'bách khoa',
    'đại học', 'trường', 'khoa', 'viện', 'học phần', 'tín chỉ', 'tiết', 'buổi',
    'slide', 'cse', 'học liệu', 'giáo trình', 'duckett', 'lockhart', 'hoffman',
    'tham khảo', 'http', 'sinh viên', 'năm học', 'mục tiêu', 'nội dung buổi',
    'kỳ học', 'thực hành lab', 'mã môn', 'giới thiệu', 'lớp', 'nguyễn văn', 'tanh'
  ];

  for (const term of bannedTerms) {
    if (clean.includes(term)) {
      return false;
    }
  }

  return /[a-zA-Z\p{L}]/u.test(clean);
}

/**
 * Generate Multiple-Choice Quiz questions using Gemini Models
 * with smart heuristic fallback for offline/timeout resilience.
 */
export async function generateQuizFromDocument(options: {
  documentId: string;
  userId: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  questionCount?: number;
  customTopic?: string;
}): Promise<GenerateQuizResult> {
  const {
    documentId,
    userId,
    difficulty = 'medium',
    questionCount = 5,
    customTopic
  } = options;

  const db = getDb();
  const doc = db.documents.find(d => d.id === documentId);
  if (!doc) {
    throw new Error('Tài liệu học tập không tồn tại trong hệ thống.');
  }

  // Ensure document text is clean and not corrupted by binary raw bytecode
  const fullContent = await ensureDocumentCleanText(doc);

  // Filter out headers, lecturer names, emails, and course meta
  const sanitizedContent = sanitizeContentForQuiz(fullContent) || fullContent;

  const ai = getGeminiClient();
  let generatedTitle = `Đề trắc nghiệm: ${doc.title} (${questionCount} câu - ${difficulty.toUpperCase()})`;
  let questionItems: GeneratedQuestionItem[] = [];

  const difficultyDesc = {
    easy: 'Mức độ Cơ bản: Nhận biết, định nghĩa khái niệm cốt lõi, cú pháp cơ bản và tính chất nền tảng.',
    medium: 'Mức độ Trung bình: Thông hiểu, so sánh các cơ chế, phân tích đoạn mã và ứng dụng quy tắc chuẩn.',
    hard: 'Mức độ Nâng cao: Vận dụng cao, phát hiện bẫy trắc nghiệm, tình huống tối ưu hóa và bảo mật chuyên sâu.'
  }[difficulty];

  if (ai && sanitizedContent.trim().length > 0) {
    const prompt = `
Dưới đây là nội dung trọng tâm từ tài liệu học tập:
---
TIÊU ĐỀ TÀI LIỆU: ${doc.title}
MÔN HỌC / CHUYÊN NGÀNH: ${doc.subject || 'Công nghệ thông tin'}
NỘI DUNG TÀI LIỆU NGUỒN:
${sanitizedContent.slice(0, 14000)}
---

YÊU CẦU THIẾT KẾ ĐỀ THI TRẮC NGHIỆM CHUẨN NOTEBOOKLM:
- Số lượng câu hỏi: CHÍNH XÁC ${questionCount} câu hỏi trắc nghiệm khách quan (mỗi câu 4 phương án A, B, C, D).
- Mức độ đánh giá: ${difficulty.toUpperCase()} (${difficultyDesc})
${customTopic ? `- Tập trung trọng tâm vào chuyên đề: ${customTopic}` : ''}

QUY TẮC BẮT BUỘC TUÂN THỦ (NOTEBOOKLM STUDY GUIDE STANDARD):
1. TUYỆT ĐỐI KHÔNG SỬ DỤNG CÁC CỤM TỪ RẬP KHUÔN ĐẦU CÂU:
   - NGHIÊM CẤM bắt đầu câu hỏi bằng: "Theo tài liệu...", "Từ tài liệu...", "Dựa vào bài học...", "Theo như...", "Trong tài liệu...", "Bài giảng đề cập...".
   - Hãy đặt câu hỏi trực diện, sắc sảo, tự nhiên như đề thi đại học chính quy hoặc đề thi chứng chỉ quốc tế uy tín (AWS, Cisco, Oracle, CompTIA).

2. ĐA DẠNG HÓA HÌNH THỨC CÂU HỎI TRỌNG TÂM:
   - Dạng Cơ chế & Tiến trình (How it works): Tập trung vào nguyên lý vận hành, thứ tự các bước kỹ thuật, vai trò chức năng của từng thành phần.
   - Dạng Phân tích So sánh (Comparative): Phân biệt sự khác nhau cốt lõi giữa hai khái niệm, cơ chế hoặc giải pháp trong bài.
   - Dạng Tình huống & Ứng dụng (Scenario / Problem Solving): Đưa ra ngữ cảnh bài toán kỹ thuật thực tế và hỏi giải pháp tối ưu.
   - Dạng Bẫy tư duy / Phát biểu Sai (Exception / Negative): "Phát biểu nào sau đây là KHÔNG CHÍNH XÁC khi nói về...", "Nhận định nào sai lệch về...".
   - Dạng Quy chuẩn & Best Practice: Các nguyên tắc thiết kế, tối ưu hóa và chuẩn mực kiến trúc.

3. ĐÁP ÁN CÓ TÍNH LOGIC CAO VÀ CÂN BẰNG (TUYỆT ĐỐI KHÔNG CẮT VỤN CÂU CHỮ TỪ TÀI LIỆU):
   - Cả 4 phương án A, B, C, D phải là câu văn hoặc mệnh đề hoàn chỉnh, mạch lạc, có cùng cấu trúc ngữ pháp và độ dài tương đương nhau.
   - CÁC ĐÁP ÁN SAI (DISTRACTORS) PHẢI CÓ TÍNH HỢP LÝ VÀ PHÂN LOẠI CAO: Phải là những phương án gây nhiễu thông minh, đại diện cho những ngộ nhận kỹ thuật phổ biến, điều kiện nghịch đảo hoặc hoán đổi vai trò các thành phần liên quan. TUYỆT ĐỐI KHÔNG cắt tạm một câu bất kỳ từ tài liệu hoặc đưa vào đáp án vô nghĩa.

4. GIẢI THÍCH CHI TIẾT & CHỦ ĐỀ ĐÁNH GIÁ (CHUẨN NOTEBOOKLM):
   - "explanation": Nêu rõ vì sao đáp án đúng là chính xác, đồng thời phân tích ngắn gọn lý do các phương án còn lại là sai (chỉ ra sai ở điểm nào hoặc đang mô tả khái niệm nào khác).
   - "concept_tested": Khái niệm hoặc chủ đề trọng tâm được kiểm tra trong câu hỏi.

TRẢ VỀ DUY NHẤT ĐỊNH DẠNG JSON (không kèm bất kỳ văn bản nào ngoài JSON):
{
  "title": "Tiêu đề đề thi trắc nghiệm học thuật súc tích",
  "questions": [
    {
      "question_text": "Nội dung câu hỏi trực diện, sắc sảo...",
      "option_a": "Phương án A hoàn chỉnh, trau chuốt",
      "option_b": "Phương án B hoàn chỉnh, trau chuốt",
      "option_c": "Phương án C hoàn chỉnh, trau chuốt",
      "option_d": "Phương án D hoàn chỉnh, trau chuốt",
      "correct_ans": "A",
      "concept_tested": "Tên khái niệm kỹ thuật cốt lõi",
      "explanation": "Giải thích chi tiết theo chuẩn NotebookLM vì sao đáp án này đúng và các đáp án khác sai..."
    }
  ]
}
`;

    // Prioritize gemini-3.1-flash-lite (fast, highly available) with fallback hierarchy
    const candidateModels = ['gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.8-flash', 'gemini-3.1-pro-preview'];

    for (const modelName of candidateModels) {
      if (questionItems.length >= questionCount) break;

      try {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout quá 25 giây khi gọi model ${modelName}`)), 25000)
        );

        const geminiPromise = ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            systemInstruction: 'Bạn là chuyên gia sư phạm và khảo thí cao cấp của Google NotebookLM. Bạn thiết kế 100% câu hỏi và cả 4 đáp án theo chuẩn khảo thí quốc tế, tuyệt đối không dùng từ mở đầu rập khuôn và không cắt ghép câu chữ thô sơ từ tài liệu.',
            responseMimeType: 'application/json',
            temperature: 0.3
          }
        });

        const response = await Promise.race([geminiPromise, timeoutPromise]);
        const responseText = response.text?.trim() || '';

        if (responseText) {
          const parsed = JSON.parse(responseText);
          if (parsed.title) {
            generatedTitle = parsed.title;
          }
          if (Array.isArray(parsed.questions) && parsed.questions.length > 0) {
            // Filter out any accidental metadata questions
            const validQuestions = parsed.questions.filter((q: any) => {
              const text = (q.question_text || '').toLowerCase();
              return !text.includes('giảng viên') &&
                     !text.includes('email') &&
                     !text.includes('mã môn') &&
                     !text.includes('tín chỉ') &&
                     !text.includes('số tiết') &&
                     !text.startsWith('theo tài liệu') &&
                     !text.startsWith('từ tài liệu') &&
                     !text.startsWith('theo như tài liệu');
            });

            if (validQuestions.length > 0) {
              questionItems = validQuestions.map((q: any) => {
                let cleanAns: 'A' | 'B' | 'C' | 'D' = 'A';
                const rawAns = String(q.correct_ans || 'A').toUpperCase().trim();
                if (rawAns === 'A' || rawAns === 'OPTION_A' || rawAns === '1') cleanAns = 'A';
                else if (rawAns === 'B' || rawAns === 'OPTION_B' || rawAns === '2') cleanAns = 'B';
                else if (rawAns === 'C' || rawAns === 'OPTION_C' || rawAns === '3') cleanAns = 'C';
                else if (rawAns === 'D' || rawAns === 'OPTION_D' || rawAns === '4') cleanAns = 'D';

                return {
                  question_text: String(q.question_text || 'Câu hỏi kiến thức chuyên môn'),
                  option_a: String(q.option_a || 'Phương án A'),
                  option_b: String(q.option_b || 'Phương án B'),
                  option_c: String(q.option_c || 'Phương án C'),
                  option_d: String(q.option_d || 'Phương án D'),
                  correct_ans: cleanAns,
                  concept_tested: String(q.concept_tested || doc.subject || 'Kiến thức trọng tâm'),
                  explanation: String(q.explanation || 'Đáp án chính xác theo nguyên lý bài học.')
                };
              });
              break; // Successfully obtained questions from AI!
            }
          }
        }
      } catch (err: any) {
        console.warn(`[QuizGenerator] Model ${modelName} encountered error or timeout:`, err?.message || err);
      }
    }
  }

  // Fallback: If AI didn't return questions, use enhanced diversified heuristic generator
  if (questionItems.length === 0) {
    console.log('[QuizGenerator] Utilizing enhanced diversified heuristic generator...');
    questionItems = generateHeuristicQuestions(sanitizedContent, doc.title, questionCount);
  }

  // Ensure count matches questionCount
  if (questionItems.length > questionCount) {
    questionItems = questionItems.slice(0, questionCount);
  }

  // Create Quiz in DB
  const quizId = `quiz_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const newQuiz: Quiz = {
    id: quizId,
    document_id: documentId,
    user_id: userId,
    title: generatedTitle,
    difficulty,
    total_questions: questionItems.length,
    created_at: new Date().toISOString()
  };

  const newQuestions: Question[] = questionItems.map((q, idx) => ({
    id: `q_${quizId}_${idx + 1}`,
    quiz_id: quizId,
    question_text: q.question_text,
    option_a: q.option_a,
    option_b: q.option_b,
    option_c: q.option_c,
    option_d: q.option_d,
    correct_ans: q.correct_ans,
    explanation: q.explanation,
    concept_tested: q.concept_tested || 'Kiến thức trọng tâm'
  }));

  db.quizzes.unshift(newQuiz);
  db.questions.push(...newQuestions);

  return {
    quiz: newQuiz,
    questions: newQuestions
  };
}

/**
 * Enhanced, diversified heuristic generator designed for NotebookLM standards:
 * 1. Strictly filters out titles, personal names, university names, emails, and header metadata.
 * 2. Focuses exclusively on core technical and conceptual assertions from the document.
 * 3. Never uses boilerplate phrases like "Theo tài liệu...", "Trong tài liệu...", "Trong chuyên đề kỹ thuật...".
 * 4. Generates plausible, logically coherent distractors with parallel grammatical structure.
 * 5. Randomly distributes the correct answer across A, B, C, D.
 */
function generateHeuristicQuestions(
  content: string,
  docTitle: string,
  count: number
): GeneratedQuestionItem[] {
  // Pre-clean content
  const sanitized = sanitizeContentForQuiz(content);
  const lines = sanitized
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 20 && !l.startsWith('#') && isHumanReadable(l));

  // Extract candidate academic statements and definitions
  const candidateConcepts: Array<{ concept: string; definition: string; rawLine: string }> = [];

  for (const line of lines) {
    if (line.includes(':')) {
      const parts = line.split(':');
      const conceptCandidate = parts[0].replace(/^[-*•\d\.\s]+/, '').trim();
      const defCandidate = parts.slice(1).join(':').trim();

      if (
        isAcademicConcept(conceptCandidate) &&
        defCandidate.length > 15 &&
        isHumanReadable(defCandidate)
      ) {
        candidateConcepts.push({
          concept: conceptCandidate,
          definition: defCandidate,
          rawLine: line
        });
      }
    } else if (line.toLowerCase().includes(' là ') || line.toLowerCase().includes(' dùng để ')) {
      const splitWord = line.toLowerCase().includes(' là ') ? ' là ' : ' dùng để ';
      const parts = line.split(new RegExp(splitWord, 'i'));
      let conceptCandidate = parts[0].replace(/^[-*•\d\.\s]+/, '').trim();
      const defCandidate = (splitWord.trim() + ' ' + parts.slice(1).join(splitWord)).trim();

      if (
        isAcademicConcept(conceptCandidate) &&
        defCandidate.length > 15 &&
        isHumanReadable(defCandidate)
      ) {
        candidateConcepts.push({
          concept: conceptCandidate,
          definition: defCandidate,
          rawLine: line
        });
      }
    }
  }

  const questions: GeneratedQuestionItem[] = [];

  // Question archetypes: Natural, direct question stems (NO "Theo tài liệu...")
  const questionTemplates = [
    {
      format: (concept: string) => `Đặc tính kỹ thuật nào sau đây mô tả ĐÚNG NHẤT về bản chất của "${concept}"?`,
      generateDistractors: (concept: string) => [
        `Chỉ cho phép thực thi trong chế độ đơn luồng và không thể mở rộng quy mô.`,
        `Yêu cầu khóa hoàn toàn tài nguyên hệ thống trong suốt thời gian xử lý.`,
        `Tự động hủy bỏ tiến trình ngay khi xuất hiện sự thay đổi trạng thái mạng.`
      ]
    },
    {
      format: (concept: string) => `Trong kiến trúc hệ thống, vai trò hoặc mục đích cốt lõi của "${concept}" là gì?`,
      generateDistractors: (concept: string) => [
        `Đóng vai trò thay thế hoàn toàn hệ điều hành cục bộ ở tầng vật lý.`,
        `Chuyển đổi dữ liệu sang định dạng nhị phân thô mà không áp dụng giao thức kiểm tra lỗi.`,
        `Ngăn chặn hoàn toàn việc trao đổi thông điệp bất đồng bộ giữa các tiến trình.`
      ]
    },
    {
      format: (concept: string) => `Phát biểu nào sau đây là KHÔNG CHÍNH XÁC (phát biểu sai) khi nói về "${concept}"?`,
      isNegative: true,
      negativeCorrect: (concept: string) => `Mọi yêu cầu xử lý liên quan đến "${concept}" đều bị bỏ qua kiểm tra hợp lệ mà vẫn bảo đảm tuyệt đối tính an toàn.`,
      generateDistractors: (concept: string) => [
        `Có thể được tích hợp vào các giải pháp phần mềm hiện đại nhằm tối ưu hóa hiệu năng.`,
        `Tuân thủ các nguyên tắc thiết kế phân tầng và chuẩn hóa giao tiếp kỹ thuật.`,
        `Đóng vai trò quan trọng trong việc bảo đảm tính toàn vẹn và nhất quán của luồng dữ liệu.`
      ]
    },
    {
      format: (concept: string) => `Khi triển khai thực tế, giải pháp nào sau đây thể hiện đúng quy chuẩn (Best Practice) đối với "${concept}"?`,
      generateDistractors: (concept: string) => [
        `Bỏ qua việc bắt và xử lý ngoại lệ để tối đa hóa tốc độ phản hồi.`,
        `Cấu hình quyền truy cập root không giới hạn cho mọi tiến trình bên ngoài.`,
        `Lưu trữ cấu hình nhạy cảm dưới dạng văn bản thô không mã hóa.`
      ]
    },
    {
      format: (concept: string) => `Cơ chế nào sau đây là yếu tố phân biệt căn bản của "${concept}" so với các phương thức truyền thống?`,
      generateDistractors: (concept: string) => [
        `Không hỗ trợ cơ chế giải phóng bộ nhớ tự động sau khi kết thúc tác vụ.`,
        `Làm gia tăng độ phụ thuộc chặt chẽ giữa các thành phần phần mềm.`,
        `Bắt buộc client phải chờ đợi vô hạn mà không có cơ chế timeout.`
      ]
    }
  ];

  // Generate questions from candidate concepts
  let conceptIndex = 0;
  while (questions.length < count && conceptIndex < candidateConcepts.length) {
    const item = candidateConcepts[conceptIndex];
    conceptIndex++;

    const templateIndex = questions.length % questionTemplates.length;
    const template = questionTemplates[templateIndex];

    const questionText = template.format(item.concept);
    const cleanDef = item.definition.replace(/^[–\-:•\s]+/, '').trim();
    const formattedDef = cleanDef.charAt(0).toUpperCase() + cleanDef.slice(1);
    const correctStatement = formattedDef.endsWith('.') ? formattedDef : formattedDef + '.';

    let correctText = '';
    let distractors: string[] = [];

    if (template.isNegative && template.negativeCorrect) {
      correctText = template.negativeCorrect(item.concept);
      distractors = [
        correctStatement,
        template.generateDistractors(item.concept)[0],
        template.generateDistractors(item.concept)[1]
      ];
    } else {
      correctText = correctStatement;
      distractors = template.generateDistractors(item.concept);
    }

    // Distribute correct answer evenly across A, B, C, D
    const shift = questions.length % 4; // 0 -> A, 1 -> B, 2 -> C, 3 -> D
    const optionsRaw = [
      { text: correctText, isCorrect: true },
      { text: distractors[0], isCorrect: false },
      { text: distractors[1], isCorrect: false },
      { text: distractors[2], isCorrect: false }
    ];

    const shifted = [
      optionsRaw[(4 - shift) % 4],
      optionsRaw[(5 - shift) % 4],
      optionsRaw[(6 - shift) % 4],
      optionsRaw[(7 - shift) % 4]
    ];

    const correctLetter = (['A', 'B', 'C', 'D'] as const)[shift];

    questions.push({
      question_text: questionText,
      option_a: shifted[0].text,
      option_b: shifted[1].text,
      option_c: shifted[2].text,
      option_d: shifted[3].text,
      correct_ans: correctLetter,
      concept_tested: item.concept,
      explanation: `Nguyên lý chuẩn mực của "${item.concept}": ${correctText}. Các phương án còn lại là nhận định gây nhiễu không đúng với kiến thức chuyên môn.`
    });
  }

  // If still need more questions, create high-yield conceptual questions from the core document topic
  const coreConceptTopic = docTitle.replace(/\.[^.]+$/, '').trim();
  const fallbackArchetypes = [
    {
      q: `Mục tiêu kỹ thuật then chốt của kiến trúc trong bài học "${coreConceptTopic}" là gì?`,
      ans: `Bảo đảm tính mô đun hóa cao, phân tầng trách nhiệm rõ ràng và tối ưu hóa hiệu năng truyền thông.`,
      d: [
        `Gia tăng sự phụ thuộc chặt chẽ giữa các thành phần để giảm dung lượng bộ nhớ.`,
        `Loại bỏ cơ chế kiểm tra tính toàn vẹn thông tin nhằm tối thiểu hóa độ trễ xử lý.`,
        `Bắt buộc mọi tiến trình ứng dụng phải thực thi đồng bộ và khóa tài nguyên chia sẻ.`
      ],
      concept: 'Kiến trúc & Mục tiêu thiết kế'
    },
    {
      q: `Phương châm thực hành tốt nhất (Best Practice) khi xây dựng giải pháp kỹ thuật là gì?`,
      ans: `Bắt và xử lý ngoại lệ một cách an toàn, ghi nhận log đầy đủ và kiểm soát chặt chẽ điều kiện biên.`,
      d: [
        `Cho phép tiến trình ngầm định bỏ qua các cảnh báo lỗi để duy trì luồng vận hành.`,
        `Lưu trữ thông tin cấu hình nhạy cảm dưới dạng văn bản thô để tiện tra cứu.`,
        `Tắt cơ chế xác thực người dùng khi hệ thống hoạt động ở chế độ tải cao.`
      ],
      concept: 'Quy chuẩn Best Practice'
    },
    {
      q: `Nhận định nào sau đây là KHÔNG ĐÚNG về nguyên lý vận hành của hệ thống?`,
      ans: `Mọi tiến trình đều có thể truy cập trực tiếp bộ nhớ của tiến trình khác mà không cần cơ chế đồng bộ.`,
      d: [
        `Hệ thống cần cung cấp các giao diện lập trình chuẩn hóa (API) để các mô đun trao đổi dữ liệu.`,
        `Việc xử lý lỗi kịp thời giúp ngăn ngừa sự cố lan truyền trong toàn bộ kiến trúc.`,
        `Hiệu năng và tính bảo mật là hai tiêu chí quan trọng cần được cân bằng khi thiết kế.`
      ],
      concept: 'Nguyên lý hệ thống'
    }
  ];

  while (questions.length < count) {
    const qIndex = questions.length;
    const arch = fallbackArchetypes[qIndex % fallbackArchetypes.length];
    const correctAnsLetter = (['A', 'B', 'C', 'D'] as const)[qIndex % 4];
    const options = [arch.ans, arch.d[0], arch.d[1], arch.d[2]];

    const targetIdx = ['A', 'B', 'C', 'D'].indexOf(correctAnsLetter);
    const temp = options[0];
    options[0] = options[targetIdx];
    options[targetIdx] = temp;

    questions.push({
      question_text: arch.q,
      option_a: options[0],
      option_b: options[1],
      option_c: options[2],
      option_d: options[3],
      correct_ans: correctAnsLetter,
      concept_tested: arch.concept,
      explanation: `Phương án ${correctAnsLetter} là khẳng định chuẩn xác: ${arch.ans}`
    });
  }

  return questions;
}

/**
 * Weakness analysis for completed quiz attempt
 */
export function analyzeQuizWeaknesses(
  quiz: Quiz,
  results: Array<{
    question: Question;
    selected_option: string;
    is_correct: boolean;
  }>
): {
  weakness_summary: string;
  recommended_review_topics: string[];
  encouragement: string;
} {
  const incorrectList = results.filter(r => !r.is_correct);
  const correctCount = results.length - incorrectList.length;
  const percentage = Math.round((correctCount / results.length) * 100);

  if (incorrectList.length === 0) {
    return {
      weakness_summary: 'Xuất sắc! Bạn đã nắm vững 100% các kiến thức trong bài học này.',
      recommended_review_topics: [],
      encouragement: 'Bạn đã hoàn thành hoàn hảo bài kiểm tra. Hãy tự tin bước vào bài kiểm tra chính thức hoặc thử sức với các chủ đề nâng cao hơn!'
    };
  }

  const topicsToReview = incorrectList.map(item => {
    // Extract subject/topic keywords from question text
    const cleanText = item.question.question_text
      .replace(/^(Câu \d+:?|Theo tài liệu [^,]+,|Đâu là khẳng định|Trong tính chất|Điều kiện|Khái niệm|Trong chuyên đề kỹ thuật, mục đích hoặc vai trò cốt lõi của|Đặc điểm hoặc nguyên lý hoạt động nào sau đây mô tả ĐÚNG về)\s*/i, '')
      .replace(/["?]/g, '')
      .slice(0, 60);
    return cleanText.trim();
  });

  let encouragement = '';
  if (percentage >= 80) {
    encouragement = 'Kết quả rất tốt! Bạn chỉ sai sót một vài chi tiết nhỏ. Hãy xem lại phần giải thích để đạt điểm tuyệt đối nhé.';
  } else if (percentage >= 50) {
    encouragement = 'Bạn đã nắm được các nguyên lý cơ bản. Đọc lại các đoạn bài giảng được gợi ý bên dưới để củng cố các câu còn nhầm lẫn nhé!';
  } else {
    encouragement = 'Đừng nản lòng! Đây là cơ hội tốt để bạn nhận diện các lỗ hổng kiến thức. Hãy đọc lại tài liệu và làm lại bài kiểm tra nhé.';
  }

  return {
    weakness_summary: `Bạn đã trả lời đúng ${correctCount}/${results.length} câu (${percentage}%). Có ${incorrectList.length} câu cần lưu ý ôn tập lại.`,
    recommended_review_topics: Array.from(new Set(topicsToReview)),
    encouragement
  };
}
