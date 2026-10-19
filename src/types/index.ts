export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar_url?: string;
  school?: string;
  created_at?: string;
}

export interface DocumentItem {
  id: string;
  title: string;
  subject: string;
  file_name: string;
  file_type: string;
  file_size: number;
  status: 'ready' | 'processing' | 'error';
  chunk_count?: number;
  created_at: string;
  raw_text?: string;
  summary?: string;
}

export interface DashboardMetrics {
  total_documents: number;
  total_questions_asked: number;
  total_quizzes_completed: number;
  average_score: number;
}

export interface RecentQuizAttempt {
  id: string;
  quiz_id: string;
  title: string;
  score: number;
  correct_count: number;
  total_questions: number;
  completed_at: string;
}

export interface ScoreTrend {
  label: string;
  score: number;
  date: string;
}

export interface DashboardData {
  metrics: DashboardMetrics;
  recent_documents: DocumentItem[];
  recent_quizzes: RecentQuizAttempt[];
  score_trends: ScoreTrend[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  retrieved_context?: Array<{
    document_title: string;
    similarity_score: number;
    chunk_text: string;
  }>;
  suggested_questions?: string[];
  model_used?: string;
}

export interface QuizItem {
  id: string;
  title: string;
  difficulty: 'easy' | 'medium' | 'hard';
  total_questions: number;
  created_at: string;
  document_id: string;
  document_title?: string;
  subject?: string;
  attempts_count: number;
  best_score: number | null;
  last_attempt_at: string | null;
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
  correct_ans?: string;
  explanation?: string;
  concept_tested?: string;
}

export interface QuizDetail {
  quiz: QuizItem;
  questions: Question[];
  previous_attempts_count: number;
}

export interface QuizEvaluationResult {
  question_id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  options?: string[];
  selected_option: string;
  correct_ans: string;
  is_correct: boolean;
  explanation: string;
  concept_tested?: string;
}

export interface QuizSubmitResult {
  attempt: {
    id: string;
    quiz_id: string;
    score: number;
    correct_count: number;
    total_questions: number;
    time_spent_sec: number;
    completed_at: string;
    rank: string;
  };
  weakness_analysis: {
    weakness_summary: string;
    recommended_review_topics: string[];
    encouragement: string;
  };
  results: QuizEvaluationResult[];
}

export interface DocumentSummary {
  summary: string;
  key_concepts?: string[];
  bullet_points?: string[];
  conclusion?: string;
  keywords?: string[];
  exam_tips?: string[];
  word_count?: number;
}
