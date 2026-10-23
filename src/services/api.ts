import {
  User,
  DocumentItem,
  DashboardData,
  QuizItem,
  QuizDetail,
  QuizSubmitResult,
  DocumentSummary,
  FlashcardSetItem
} from '../types';

const BASE_URL = '/api';

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem('aurastudy_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handleResponse<T>(res: Response): Promise<T> {
  const text = await res.text().catch(() => '');
  let data: any = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (res.status === 401 || res.status === 403) {
    localStorage.removeItem('aurastudy_token');
    localStorage.removeItem('aurastudy_user');
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('aurastudy:unauthorized'));
    }
    const errMsg = data?.message || data?.error || 'Phiên đăng nhập đã hết hạn hoặc bạn chưa đăng nhập. Vui lòng đăng nhập để tiếp tục.';
    throw new Error(errMsg);
  }

  if (!res.ok) {
    if (data && (data.message || data.error)) {
      throw new Error(data.message || data.error);
    }
    if (res.status === 413) {
      throw new Error('Tệp tải lên vượt quá dung lượng tối đa 25MB.');
    }
    if (text && !text.includes('<!DOCTYPE') && !text.includes('<html')) {
      throw new Error(text.slice(0, 150));
    }
    throw new Error(`Yêu cầu không thành công (Mã lỗi: ${res.status}). Vui lòng thử lại.`);
  }

  if (data !== null) {
    return (data.data !== undefined ? data.data : data) as T;
  }

  if (text && !text.includes('<!DOCTYPE') && !text.includes('<html')) {
    return { message: text } as T;
  }

  if (text.includes('<!DOCTYPE') || text.includes('<html')) {
    throw new Error('Máy chủ phản hồi trang web thay vì dữ liệu JSON. Vui lòng thử lại.');
  }

  return {} as T;
}

export const api = {
  // Auth
  login: async (email: string, password: string): Promise<{ user: User; access_token: string }> => {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    return handleResponse(res);
  },

  supabaseLogin: async (accessToken: string): Promise<{ user: User; access_token: string }> => {
    const res = await fetch(`${BASE_URL}/auth/supabase-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken })
    });
    return handleResponse(res);
  },

  register: async (name: string, email: string, password: string, school?: string): Promise<{ user: User; access_token: string }> => {
    const res = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim(),
        full_name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        school: school ? school.trim() : ''
      })
    });
    return handleResponse(res);
  },

  getCurrentUser: async (): Promise<User> => {
    const res = await fetch(`${BASE_URL}/auth/me`, {
      headers: { ...getAuthHeader() }
    });
    return handleResponse(res);
  },

  updateProfile: async (payload: { name: string; avatar_url?: string }): Promise<User> => {
    const res = await fetch(`${BASE_URL}/auth/me`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(payload)
    });
    return handleResponse(res);
  },

  uploadAvatar: async (file: File): Promise<{ avatar_url: string }> => {
    const body = new FormData();
    body.append('avatar', file);
    const res = await fetch(`${BASE_URL}/auth/me/avatar`, {
      method: 'POST',
      headers: getAuthHeader(),
      body
    });
    return handleResponse(res);
  },

  // Dashboard
  getDashboardStats: async (): Promise<DashboardData> => {
    const res = await fetch(`${BASE_URL}/dashboard`, {
      headers: { ...getAuthHeader() }
    });
    return handleResponse(res);
  },

  // Documents
  getDocuments: async (search?: string, subject?: string): Promise<DocumentItem[]> => {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (subject) params.append('subject', subject);
    const res = await fetch(`${BASE_URL}/documents?${params.toString()}`, {
      headers: { ...getAuthHeader() }
    });
    return handleResponse(res);
  },

  getDocumentById: async (id: string): Promise<DocumentItem> => {
    const res = await fetch(`${BASE_URL}/documents/${id}`, {
      headers: { ...getAuthHeader() }
    });
    return handleResponse(res);
  },

  uploadDocument: async (file: File, title: string, subject: string): Promise<DocumentItem> => {
    const token = localStorage.getItem('aurastudy_token');
    if (!token) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('aurastudy:unauthorized'));
      }
      throw new Error('Bạn cần đăng nhập để tải tài liệu lên hệ thống.');
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title);
    formData.append('subject', subject);

    const res = await fetch(`${BASE_URL}/documents/upload`, {
      method: 'POST',
      headers: { ...getAuthHeader() },
      body: formData
    });
    return handleResponse(res);
  },

  deleteDocument: async (id: string): Promise<{ message: string }> => {
    const res = await fetch(`${BASE_URL}/documents/${id}`, {
      method: 'DELETE',
      headers: { ...getAuthHeader() }
    });
    return handleResponse(res);
  },

  // Chat & RAG
  askQuestion: async (payload: {
    question: string;
    document_id?: string;
    session_id?: string;
  }): Promise<{
    answer: string;
    retrieved_context: Array<{
      document_title: string;
      similarity_score: number;
      chunk_text: string;
    }>;
    suggested_questions?: string[];
    model_used?: string;
    session_id: string;
  }> => {
    const res = await fetch(`${BASE_URL}/chat/ask`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader()
      },
      body: JSON.stringify(payload)
    });
    const result = await handleResponse<{
      session?: { id?: string };
      ai_message?: { content?: string };
      answer?: string;
      sources?: Array<{
        document_title: string;
        similarity_score: number;
        content?: string;
        chunk_text?: string;
      }>;
      retrieved_context?: Array<{ document_title: string; similarity_score: number; chunk_text: string }>;
      suggested_questions?: string[];
      model_used?: string;
    }>(res);

    return {
      answer: result.answer || result.ai_message?.content || '',
      retrieved_context: result.retrieved_context || (result.sources || []).map((source) => ({
        document_title: source.document_title,
        similarity_score: source.similarity_score,
        chunk_text: source.chunk_text || source.content || ''
      })),
      suggested_questions: result.suggested_questions || [],
      model_used: result.model_used,
      session_id: result.session?.id || ''
    };
  },

  summarizeDocument: async (documentId: string, type: 'short' | 'bullet' | 'detailed' = 'bullet'): Promise<DocumentSummary> => {
    const res = await fetch(`${BASE_URL}/chat/summarize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader()
      },
      body: JSON.stringify({ document_id: documentId, type })
    });
    return handleResponse(res);
  },

  // Quizzes
  getQuizzes: async (): Promise<QuizItem[]> => {
    const res = await fetch(`${BASE_URL}/quizzes`, {
      headers: { ...getAuthHeader() }
    });
    return handleResponse(res);
  },

  getQuizDetail: async (id: string, mode: 'take' | 'review' = 'take'): Promise<QuizDetail> => {
    const res = await fetch(`${BASE_URL}/quizzes/${id}?mode=${mode}`, {
      headers: { ...getAuthHeader() }
    });
    return handleResponse(res);
  },

  generateQuiz: async (payload: {
    document_id: string;
    difficulty: 'easy' | 'medium' | 'hard';
    question_count: number;
    custom_topic?: string;
  }): Promise<{ quiz: QuizItem; questions: any[] }> => {
    const res = await fetch(`${BASE_URL}/quizzes/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader()
      },
      body: JSON.stringify(payload)
    });
    return handleResponse(res);
  },

  importQuizFromFile: async (file: File): Promise<{ quiz: QuizItem; question_count: number }> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${BASE_URL}/quizzes/import`, {
      method: 'POST',
      headers: { ...getAuthHeader() },
      body: formData
    });
    return handleResponse(res);
  },

  importQuizFromDocument: async (documentId: string): Promise<{ quiz: QuizItem; question_count: number }> => {
    const res = await fetch(`${BASE_URL}/quizzes/import-document`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader()
      },
      body: JSON.stringify({ document_id: documentId })
    });
    return handleResponse(res);
  },

  submitQuiz: async (
    quizId: string,
    payload: {
      answers: Array<{ question_id: string; selected_option: string }>;
      time_spent_sec: number;
    }
  ): Promise<QuizSubmitResult> => {
    const res = await fetch(`${BASE_URL}/quizzes/${quizId}/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader()
      },
      body: JSON.stringify(payload)
    });
    return handleResponse(res);
  },

  deleteQuiz: async (quizId: string): Promise<{ message: string }> => {
    const res = await fetch(`${BASE_URL}/quizzes/${quizId}`, {
      method: 'DELETE',
      headers: { ...getAuthHeader() }
    });
    return handleResponse(res);
  },

  getFlashcardSets: async (): Promise<FlashcardSetItem[]> => handleResponse(await fetch(`${BASE_URL}/flashcards`, { headers:getAuthHeader() })),
  getFlashcardSet: async (id:string): Promise<FlashcardSetItem> => handleResponse(await fetch(`${BASE_URL}/flashcards/${id}`, { headers:getAuthHeader() })),
  generateFlashcards: async (document_id:string): Promise<{cards:Array<{front_text:string;back_text:string}>;title:string;subject:string;document_id:string}> => handleResponse(await fetch(`${BASE_URL}/flashcards/generate`, {method:'POST',headers:{'Content-Type':'application/json',...getAuthHeader()},body:JSON.stringify({document_id})})),
  createFlashcardSet: async (payload:{title:string;subject:string;description:string;document_id?:string;creation_method:'manual'|'ai';cards:Array<{front_text:string;back_text:string}>}): Promise<FlashcardSetItem> => handleResponse(await fetch(`${BASE_URL}/flashcards`, {method:'POST',headers:{'Content-Type':'application/json',...getAuthHeader()},body:JSON.stringify(payload)})),
  updateFlashcardSet: async (id:string,payload:{title:string;subject:string;description:string;cards:Array<{front_text:string;back_text:string}>}): Promise<FlashcardSetItem> => handleResponse(await fetch(`${BASE_URL}/flashcards/${id}`, {method:'PUT',headers:{'Content-Type':'application/json',...getAuthHeader()},body:JSON.stringify(payload)})),
  deleteFlashcardSet: async (id:string): Promise<{message:string}> => handleResponse(await fetch(`${BASE_URL}/flashcards/${id}`,{method:'DELETE',headers:getAuthHeader()})),
  reviewFlashcard: async (setId:string,cardId:string,status:'known'|'learning') => handleResponse(await fetch(`${BASE_URL}/flashcards/${setId}/cards/${cardId}/progress`,{method:'PUT',headers:{'Content-Type':'application/json',...getAuthHeader()},body:JSON.stringify({status})}))
};
