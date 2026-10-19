import React from 'react';
import { DashboardData, DocumentItem, User } from '../types';
import {
  FileText,
  HelpCircle,
  CheckCircle2,
  TrendingUp,
  Sparkles,
  ArrowRight,
  UploadCloud,
  FileCheck,
  Calendar,
  Clock,
  LogIn
} from 'lucide-react';

interface DashboardViewProps {
  data: DashboardData | null;
  loading: boolean;
  onNavigate: (tab: 'dashboard' | 'documents' | 'chat' | 'quizzes') => void;
  onSelectDocumentForChat: (doc: DocumentItem) => void;
  onSelectDocumentForQuiz: (doc: DocumentItem) => void;
  onRefresh: () => void;
  user?: User | null;
  onOpenAuth?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  data,
  loading,
  onNavigate,
  onSelectDocumentForChat,
  onSelectDocumentForQuiz,
  onRefresh,
  user,
  onOpenAuth
}) => {
  if (loading && !data) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-slate-500 font-medium">Đang tải dữ liệu học tập tổng quan...</p>
        </div>
      </div>
    );
  }

  const metrics = data?.metrics || {
    total_documents: 0,
    total_questions_asked: 0,
    total_quizzes_completed: 0,
    average_score: 0
  };

  const recentDocs = data?.recent_documents || [];
  const recentQuizzes = data?.recent_quizzes || [];
  const scoreTrends = data?.score_trends || [];

  return (
    <div id="dashboard-view-content" className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-900 via-blue-800 to-slate-900 text-white p-6 sm:p-8 shadow-xl">
        <div className="relative z-10 max-w-2xl">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/30 text-blue-200 border border-blue-400/30 mb-3">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" /> Hệ Thống Trợ Lý Học Tập AuraStudy
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mb-2">
            Học thông minh hơn cùng Generative AI & RAG
          </h1>
          <p className="text-sm text-blue-100/90 leading-relaxed mb-6">
            Tải tài liệu môn học, trò chuyện trực tiếp với trợ lý thông minh để tóm tắt bài giảng và tự động sinh đề trắc nghiệm chuẩn kiến thức.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              id="dashboard-upload-doc-btn"
              onClick={() => onNavigate('documents')}
              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-md shadow-orange-950/20 transition-all flex items-center gap-2 cursor-pointer"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Tải lên tài liệu mới</span>
            </button>
            <button
              id="dashboard-start-chat-btn"
              onClick={() => onNavigate('chat')}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white font-semibold text-xs sm:text-sm rounded-xl border border-white/20 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>Hỏi đáp Aura AI</span>
            </button>
          </div>
        </div>
        {/* Subtle geometric circles */}
        <div className="absolute -right-12 -bottom-12 w-64 h-64 rounded-full bg-blue-500/10 pointer-events-none blur-2xl"></div>
        <div className="absolute right-1/4 -top-12 w-48 h-48 rounded-full bg-sky-500/10 pointer-events-none blur-2xl"></div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500">Tài liệu học tập</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold text-slate-900">{metrics.total_documents}</span>
            <span className="text-xs text-blue-600 font-medium">Đã số hóa RAG</span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500">Câu hỏi RAG đã hỏi</span>
            <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
              <HelpCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold text-slate-900">{metrics.total_questions_asked}</span>
            <span className="text-xs text-sky-600 font-medium">Hỏi đáp AI</span>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500">Bài thi đã hoàn thành</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold text-slate-900">{metrics.total_quizzes_completed}</span>
            <span className="text-xs text-emerald-600 font-medium">Lượt kiểm tra</span>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500">Điểm số trung bình</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold text-slate-900">{metrics.average_score}</span>
            <span className="text-xs font-semibold text-amber-600">
              {metrics.average_score >= 80 ? 'Loại Giỏi' : metrics.average_score >= 65 ? 'Loại Khá' : 'Đang cải thiện'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Col (2 span): Recent Documents & Score Trend */}
        <div className="lg:col-span-2 space-y-6">
          {/* Recent Documents Card */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-800">Tài liệu học tập gần đây</h3>
                <p className="text-xs text-slate-500">Các giáo trình và tài liệu đã được chỉ mục hóa</p>
              </div>
              <button
                id="dashboard-view-all-docs-btn"
                onClick={() => onNavigate('documents')}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
              >
                <span>Xem tất cả</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {recentDocs.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-slate-200 rounded-xl">
                <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-600">Chưa có tài liệu nào được tải lên</p>
                <p className="text-xs text-slate-400 mb-4">Tải tài liệu PDF hoặc TXT đầu tiên để bắt đầu học</p>
                <button
                  onClick={() => onNavigate('documents')}
                  className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-xs"
                >
                  Tải tài liệu ngay
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {recentDocs.map((doc) => (
                  <div
                    key={doc.id}
                    id={`doc-card-${doc.id}`}
                    className="p-3.5 rounded-xl border border-slate-100 hover:border-slate-200 bg-slate-50/50 hover:bg-white transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                        <FileCheck className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-slate-800 line-clamp-1">{doc.title}</h4>
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                          <span className="font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                            {doc.subject}
                          </span>
                          <span>•</span>
                          <span>{doc.file_name}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(doc.created_at).toLocaleDateString('vi-VN')}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 self-end sm:self-center">
                      <button
                        id={`chat-with-doc-${doc.id}`}
                        onClick={() => onSelectDocumentForChat(doc)}
                        className="px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <Sparkles className="w-3 h-3 text-blue-600" />
                        <span>Hỏi AI</span>
                      </button>
                      <button
                        id={`quiz-for-doc-${doc.id}`}
                        onClick={() => onSelectDocumentForQuiz(doc)}
                        className="px-2.5 py-1 text-xs font-semibold text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-200/60 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <span>Tạo Quiz</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Score Trends Graph */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-800">Biểu đồ điểm số ôn luyện</h3>
                <p className="text-xs text-slate-500">Tiến trình các bài thi trắc nghiệm theo thời gian</p>
              </div>
              <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                Tự động đánh giá
              </span>
            </div>

            {scoreTrends.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">Chưa có bài thi trắc nghiệm nào để vẽ biểu đồ.</p>
            ) : (
              <div className="pt-2 pb-1">
                <div className="flex items-end gap-3 h-36 border-b border-slate-100 px-2">
                  {scoreTrends.map((trend, i) => {
                    const heightPercent = Math.max(Math.min(trend.score, 100), 10);
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
                        <span className="text-[11px] font-bold text-blue-600 group-hover:scale-110 transition-transform">
                          {trend.score}đ
                        </span>
                        <div
                          style={{ height: `${heightPercent}%` }}
                          className="w-full max-w-[42px] bg-gradient-to-t from-blue-600 to-sky-400 rounded-t-lg transition-all group-hover:brightness-110"
                        ></div>
                        <span className="text-[10px] text-slate-400 truncate max-w-[60px]">{trend.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Col (1 span): Recent Quizzes & Quick Tips */}
        <div className="space-y-6">
          {/* Recent Quizzes Card */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-800">Lịch sử bài thi</h3>
                <p className="text-xs text-slate-500">Kết quả làm bài gần nhất</p>
              </div>
              <button
                id="dashboard-view-all-quizzes-btn"
                onClick={() => onNavigate('quizzes')}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
              >
                <span>Xem tất cả</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {recentQuizzes.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-slate-200 rounded-xl">
                <CheckCircle2 className="w-8 h-8 text-slate-300 mx-auto mb-1.5" />
                <p className="text-xs text-slate-500 mb-3">Bạn chưa hoàn thành bài thi nào</p>
                <button
                  onClick={() => onNavigate('quizzes')}
                  className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-xs"
                >
                  Làm đề trắc nghiệm
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {recentQuizzes.map((att) => (
                  <div
                    key={att.id}
                    id={`recent-attempt-${att.id}`}
                    className="p-3 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-white transition-all"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold text-slate-800 line-clamp-1">{att.title}</span>
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${
                          att.score >= 80
                            ? 'bg-emerald-100 text-emerald-800'
                            : att.score >= 60
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {att.score} điểm
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>Đúng: {att.correct_count}/{att.total_questions} câu</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(att.completed_at).toLocaleDateString('vi-VN')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Learning Tip */}
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200/80 rounded-2xl p-5">
            <div className="flex items-center gap-2 text-amber-900 font-bold text-sm mb-1.5">
              <Sparkles className="w-4 h-4 text-amber-600" />
              <span>Phương pháp Active Recall</span>
            </div>
            <p className="text-xs text-amber-800 leading-relaxed mb-3">
              Sau khi học lý thuyết, hãy dùng tính năng <strong>Tạo đề trắc nghiệm bằng AI</strong> để thử thách bản thân. Ôn tập lặp lại ngắt quãng (Spaced Repetition) giúp ghi nhớ dài hạn gấp 3 lần so với chỉ đọc lại tài liệu!
            </p>
            <button
              onClick={() => onNavigate('quizzes')}
              className="w-full py-2 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              Tạo bài kiểm tra ngay
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
