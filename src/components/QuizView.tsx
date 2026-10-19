import React, { useState, useEffect } from 'react';
import { QuizItem, QuizDetail, QuizSubmitResult, DocumentItem, Question } from '../types';
import { api } from '../services/api';
import {
  CheckSquare,
  Sparkles,
  Upload,
  FileText,
  Plus,
  Play,
  Clock,
  Award,
  AlertCircle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  RotateCcw,
  BookOpen,
  ArrowRight,
  ArrowLeft,
  Trash2,
  X,
  Target
} from 'lucide-react';

interface QuizViewProps {
  quizzes: QuizItem[];
  documents: DocumentItem[];
  loading: boolean;
  onRefresh: () => void;
  preSelectedDoc?: DocumentItem | null;
  onClearPreSelectedDoc?: () => void;
}

function getQuestionOptions(question: Pick<Question, 'options' | 'option_a' | 'option_b' | 'option_c' | 'option_d'>) {
  const sourceOptions = question.options?.length
    ? question.options
    : [question.option_a, question.option_b, question.option_c, question.option_d].filter((option) => option.trim());
  return sourceOptions.map((text, index) => ({ key: String.fromCharCode(65 + index), text }));
}

export const QuizView: React.FC<QuizViewProps> = ({
  quizzes,
  documents,
  loading,
  onRefresh,
  preSelectedDoc,
  onClearPreSelectedDoc
}) => {
  // Modal & Flow states
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [generatorMode, setGeneratorMode] = useState<'choose' | 'document' | 'file'>('choose');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [sourceDocumentForQuiz, setSourceDocumentForQuiz] = useState<DocumentItem | null>(null);
  const [genDocumentId, setGenDocumentId] = useState('');
  const [genDifficulty, setGenDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [genQuestionCount, setGenQuestionCount] = useState(5);
  const [genCustomTopic, setGenCustomTopic] = useState('');
  const [genLoading, setGenLoading] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  // Active Exam State
  const [activeQuizDetail, setActiveQuizDetail] = useState<QuizDetail | null>(null);
  const [examLoading, setExamLoading] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [examTimerSec, setExamTimerSec] = useState(0);
  const [examActive, setExamActive] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Result State
  const [examResult, setExamResult] = useState<QuizSubmitResult | null>(null);

  // Delete modal state & notification
  const [deleteConfirmQuiz, setDeleteConfirmQuiz] = useState<QuizItem | null>(null);
  const [deleteQuizLoading, setDeleteQuizLoading] = useState(false);
  const [quizNotification, setQuizNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const closeQuizCreator = () => {
    setIsGeneratorOpen(false);
    setImportFile(null);
    setSourceDocumentForQuiz(null);
    setGenError(null);
  };

  useEffect(() => {
    if (quizNotification) {
      const timer = setTimeout(() => setQuizNotification(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [quizNotification]);

  // Auto-open generator if preSelectedDoc is passed
  useEffect(() => {
    if (preSelectedDoc) {
      setGenDocumentId(preSelectedDoc.id);
      setSourceDocumentForQuiz(preSelectedDoc);
      setGeneratorMode('choose');
      setIsGeneratorOpen(true);
      if (onClearPreSelectedDoc) onClearPreSelectedDoc();
    }
  }, [preSelectedDoc, onClearPreSelectedDoc]);

  // Exam timer
  useEffect(() => {
    let interval: any = null;
    if (examActive) {
      interval = setInterval(() => {
        setExamTimerSec((prev) => prev + 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [examActive]);

  // Format timer
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle Generate Quiz
  const handleGenerateQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!genDocumentId) {
      setGenError('Vui lòng chọn tài liệu để tạo đề trắc nghiệm.');
      return;
    }
    setGenLoading(true);
    setGenError(null);

    try {
      await api.generateQuiz({
        document_id: genDocumentId,
        difficulty: genDifficulty,
        question_count: genQuestionCount,
        custom_topic: genCustomTopic || undefined
      });
      closeQuizCreator();
      setGenCustomTopic('');
      onRefresh();
    } catch (err: any) {
      setGenError(err?.message || 'Có lỗi xảy ra khi tạo đề thi.');
    } finally {
      setGenLoading(false);
    }
  };

  const handleImportQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceDocumentForQuiz && !importFile) {
      setGenError('Vui lòng chọn file đề trắc nghiệm.');
      return;
    }
    setGenLoading(true);
    setGenError(null);
    try {
      const result = sourceDocumentForQuiz
        ? await api.importQuizFromDocument(sourceDocumentForQuiz.id)
        : await api.importQuizFromFile(importFile!);
      closeQuizCreator();
      setQuizNotification({
        type: 'success',
        message: `Đã nhập ${result.question_count} câu hỏi. Bộ đề đã sẵn sàng để làm.`
      });
      onRefresh();
    } catch (err: any) {
      setGenError(err?.message || 'Không thể đọc đề trắc nghiệm trong file.');
    } finally {
      setGenLoading(false);
    }
  };

  // Start Taking Quiz
  const handleStartQuiz = async (quizId: string) => {
    setExamLoading(true);
    setExamResult(null);
    try {
      const detail = await api.getQuizDetail(quizId, 'take');
      setActiveQuizDetail(detail);
      setCurrentQuestionIndex(0);
      setUserAnswers({});
      setExamTimerSec(0);
      setExamActive(true);
    } catch (err: any) {
      alert(err?.message || 'Không thể tải đề thi.');
    } finally {
      setExamLoading(false);
    }
  };

  // Select Option
  const handleSelectOption = (questionId: string, option: string) => {
    setUserAnswers((prev) => ({
      ...prev,
      [questionId]: option
    }));
  };

  // Submit Exam
  const handleSubmitQuiz = async () => {
    if (!activeQuizDetail) return;
    setSubmitting(true);
    setExamActive(false);

    try {
      const answersPayload: Array<{ question_id: string; selected_option: string }> = Object.entries(userAnswers).map(([qId, opt]) => ({
        question_id: qId,
        selected_option: String(opt)
      }));

      const res = await api.submitQuiz(activeQuizDetail.quiz.id, {
        answers: answersPayload,
        time_spent_sec: examTimerSec
      });

      setExamResult(res);
      onRefresh();
    } catch (err: any) {
      setQuizNotification({
        type: 'error',
        message: err?.message || 'Lỗi khi nộp bài chấm điểm.'
      });
      setExamActive(true);
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Quiz Confirmation Handler
  const handleConfirmDeleteQuiz = async () => {
    if (!deleteConfirmQuiz) return;
    setDeleteQuizLoading(true);
    try {
      await api.deleteQuiz(deleteConfirmQuiz.id);
      setQuizNotification({
        type: 'success',
        message: `Đã xóa thành công bộ đề thi "${deleteConfirmQuiz.title}".`
      });
      setDeleteConfirmQuiz(null);
      onRefresh();
    } catch (err: any) {
      setQuizNotification({
        type: 'error',
        message: err?.message || 'Không thể xóa bộ đề thi.'
      });
    } finally {
      setDeleteQuizLoading(false);
    }
  };

  // RENDER 1: Exam Taking Screen
  if (activeQuizDetail && !examResult) {
    const q = activeQuizDetail.questions[currentQuestionIndex];
    const totalQ = activeQuizDetail.questions.length;
    const answeredCount = Object.keys(userAnswers).length;

    return (
      <div id="quiz-taking-screen" className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
        {/* Top Sticky Bar */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-4 flex flex-wrap items-center justify-between gap-4 sticky top-16 z-20">
          <div>
            <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-md">
              {activeQuizDetail.quiz.difficulty.toUpperCase()} • {activeQuizDetail.quiz.subject || 'Bài thi'}
            </span>
            <h2 className="text-sm sm:text-base font-bold text-slate-900 mt-1 line-clamp-1">
              {activeQuizDetail.quiz.title}
            </h2>
          </div>

          <div className="flex items-center gap-4">
            {/* Realtime Timer */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-xl text-xs font-bold text-slate-700">
              <Clock className="w-4 h-4 text-blue-600" />
              <span>{formatTime(examTimerSec)}</span>
            </div>

            {/* Submit Button */}
            <button
              id="submit-exam-btn"
              onClick={handleSubmitQuiz}
              disabled={submitting}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white font-semibold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
            >
              {submitting ? (
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              ) : (
                <CheckSquare className="w-4 h-4" />
              )}
              <span>Nộp bài ({answeredCount}/{totalQ})</span>
            </button>
          </div>
        </div>

        {/* Question Navigator Numbers */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-3.5">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span>Danh sách câu hỏi:</span>
            <span>Tiến độ: {answeredCount}/{totalQ} câu</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {activeQuizDetail.questions.map((ques, idx) => {
              const isAnswered = !!userAnswers[ques.id];
              const isCurrent = idx === currentQuestionIndex;
              return (
                <button
                  key={ques.id}
                  id={`nav-q-btn-${idx + 1}`}
                  onClick={() => setCurrentQuestionIndex(idx)}
                  className={`w-8 h-8 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isCurrent
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                      : isAnswered
                      ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>
        </div>

        {/* Current Question Card */}
        {q && (
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between gap-4">
              <span className="px-3 py-1 bg-blue-50 text-blue-700 font-bold text-xs rounded-lg">
                Câu {currentQuestionIndex + 1} / {totalQ}
              </span>
              {q.concept_tested && (
                <span className="px-2.5 py-1 bg-slate-100 text-slate-700 font-medium text-xs rounded-lg flex items-center gap-1.5 border border-slate-200/60">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  <span>Trọng tâm: {q.concept_tested}</span>
                </span>
              )}
            </div>

            <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-relaxed">
              {q.question_text}
            </h3>

            {/* Answer options */}
            <div className="space-y-3">
              {getQuestionOptions(q).map(({ key: optKey, text: optText }) => {
                const isSelected = userAnswers[q.id] === optKey;

                return (
                  <div
                    key={optKey}
                    id={`q-option-${optKey.toLowerCase()}`}
                    onClick={() => handleSelectOption(q.id, optKey)}
                    className={`p-4 rounded-xl border transition-all flex items-center gap-3.5 cursor-pointer ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/70 shadow-2xs'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-lg text-xs font-bold flex items-center justify-center transition-colors ${
                        isSelected
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {optKey}
                    </div>
                    <span className="text-xs sm:text-sm text-slate-800 leading-normal">{optText}</span>
                  </div>
                );
              })}
            </div>

            {/* Bottom Question Controls */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <button
                id="prev-question-btn"
                onClick={() => setCurrentQuestionIndex((prev) => Math.max(prev - 1, 0))}
                disabled={currentQuestionIndex === 0}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-30 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Câu trước</span>
              </button>

              <button
                id="cancel-exam-btn"
                onClick={() => setActiveQuizDetail(null)}
                className="text-xs text-rose-600 hover:underline cursor-pointer"
              >
                Hủy làm bài
              </button>

              {currentQuestionIndex === totalQ - 1 ? (
                <button
                  id="submit-exam-bottom-btn"
                  onClick={handleSubmitQuiz}
                  disabled={submitting}
                  className="px-5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white rounded-xl shadow-sm hover:shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  {submitting ? (
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  ) : (
                    <CheckSquare className="w-4 h-4" />
                  )}
                  <span>Nộp bài ({answeredCount}/{totalQ})</span>
                </button>
              ) : (
                <button
                  id="next-question-btn"
                  onClick={() => setCurrentQuestionIndex((prev) => Math.min(prev + 1, totalQ - 1))}
                  className="px-4 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-50 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Câu tiếp theo</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // RENDER 2: Exam Result & AI Weakness Analysis Screen
  if (examResult) {
    const { attempt, weakness_analysis, results } = examResult;

    return (
      <div id="quiz-result-screen" className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
        
        {/* Score Card Banner */}
        <div className="bg-gradient-to-br from-blue-900 via-blue-800 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
          <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div>
              <span className="px-3 py-1 bg-white/10 rounded-full text-xs font-medium text-blue-200 border border-white/20">
                Kết quả kiểm tra tự động
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold mt-2 text-white">
                Xếp loại: {attempt.rank}
              </h2>
              <p className="text-xs sm:text-sm text-blue-100/90 mt-1">
                Đúng {attempt.correct_count} trên tổng số {attempt.total_questions} câu hỏi • Thời gian làm: {formatTime(attempt.time_spent_sec)}
              </p>
            </div>

            <div className="flex flex-col items-center bg-white/10 backdrop-blur-md px-6 py-4 rounded-2xl border border-white/20">
              <span className="text-4xl sm:text-5xl font-black tracking-tight text-white">
                {attempt.score}
              </span>
              <span className="text-xs font-semibold text-blue-200 mt-0.5">Thang điểm 100</span>
            </div>
          </div>
        </div>

        {/* AI Weakness Analysis Pedagogical Box */}
        <div className="bg-blue-50/70 border border-blue-200/80 rounded-2xl p-5 sm:p-6 space-y-3">
          <div className="flex items-center gap-2 text-blue-950 font-bold text-sm">
            <Sparkles className="w-4 h-4 text-blue-600" />
            <span>Phân tích năng lực & Lỗ hổng kiến thức từ Aura AI</span>
          </div>

          <p className="text-xs sm:text-sm text-blue-900 leading-relaxed font-medium">
            {weakness_analysis.weakness_summary}
          </p>

          {weakness_analysis.recommended_review_topics.length > 0 && (
            <div className="space-y-1 pt-1">
              <p className="text-xs font-semibold text-blue-950">Chủ đề bài học cần xem lại kỹ:</p>
              <div className="flex flex-wrap gap-1.5">
                {weakness_analysis.recommended_review_topics.map((t, idx) => (
                  <span
                    key={idx}
                    className="px-2.5 py-1 bg-white border border-blue-200 rounded-lg text-xs font-medium text-blue-900"
                  >
                    📌 {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          <p className="text-xs text-blue-700/90 italic pt-1">
            "{weakness_analysis.encouragement}"
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-bold text-slate-900">Chi tiết từng câu hỏi & Lời giải:</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (activeQuizDetail) {
                  handleStartQuiz(activeQuizDetail.quiz.id);
                }
              }}
              className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Làm lại bài này</span>
            </button>
            <button
              onClick={() => {
                setActiveQuizDetail(null);
                setExamResult(null);
              }}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
            >
              Danh sách đề thi
            </button>
          </div>
        </div>

        {/* Review Questions List */}
        <div className="space-y-4">
          {results.map((r, i) => (
            <div
              key={r.question_id}
              className={`bg-white rounded-2xl border p-5 sm:p-6 space-y-4 transition-all ${
                r.is_correct ? 'border-emerald-200' : 'border-rose-200'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-1 ${
                    r.is_correct ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {r.is_correct ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" /> Đúng
                    </>
                  ) : (
                    <>
                      <XCircle className="w-3.5 h-3.5" /> Sai
                    </>
                  )}
                  <span>• Câu {i + 1}</span>
                </span>
                {r.concept_tested && (
                  <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-md text-[11px] font-semibold">
                    {r.concept_tested}
                  </span>
                )}
              </div>

              <h4 className="text-sm font-bold text-slate-900">{r.question_text}</h4>

              {/* Options Breakdown */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {getQuestionOptions(r).map(({ key: opt, text }) => {
                  const isUserPick = r.selected_option === opt;
                  const isCorrectPick = r.correct_ans === opt;

                  let badgeStyle = 'border-slate-100 bg-slate-50/50 text-slate-700';
                  if (isCorrectPick) {
                    badgeStyle = 'border-emerald-400 bg-emerald-50 text-emerald-900 font-semibold';
                  } else if (isUserPick && !r.is_correct) {
                    badgeStyle = 'border-rose-300 bg-rose-50 text-rose-900 line-through opacity-80';
                  }

                  return (
                    <div key={opt} className={`p-3 rounded-xl border flex items-center gap-2 ${badgeStyle}`}>
                      <span className="font-bold shrink-0">{opt}.</span>
                      <span className="leading-tight">{text}</span>
                      {isCorrectPick && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 ml-auto shrink-0" />}
                      {isUserPick && !r.is_correct && <XCircle className="w-3.5 h-3.5 text-rose-600 ml-auto shrink-0" />}
                    </div>
                  );
                })}
              </div>

              {/* Explanation Note */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 text-xs text-slate-700 space-y-1.5">
                <p className="font-bold text-blue-900 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-blue-600" /> Giải thích chi tiết & Phân tích đáp án (Chuẩn NotebookLM):
                </p>
                <p className="leading-relaxed text-slate-800 whitespace-pre-wrap">{r.explanation}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // RENDER 3: Quiz List & Generator Trigger
  return (
    <div id="quiz-list-screen" className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Toast Notification Banner */}
      {quizNotification && (
        <div
          id="quiz-notification-banner"
          className={`p-4 rounded-2xl border flex items-center justify-between gap-3 text-xs sm:text-sm font-medium transition-all shadow-xs ${
            quizNotification.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {quizNotification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{quizNotification.message}</span>
          </div>
          <button
            onClick={() => setQuizNotification(null)}
            className="p-1 hover:opacity-75 cursor-pointer rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Kho đề thi & Ôn luyện trắc nghiệm
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Tạo bộ câu hỏi trắc nghiệm tự động từ tài liệu học tập bằng Aura AI và hệ thống tự động chấm điểm khách quan
          </p>
        </div>
        <button
          id="open-quiz-generator-btn"
          onClick={() => {
            setSourceDocumentForQuiz(null);
            if (documents.length > 0 && !genDocumentId) {
              setGenDocumentId(documents[0].id);
            }
            setGeneratorMode('choose');
            setGenError(null);
            setIsGeneratorOpen(true);
          }}
          className="px-4 py-2.5 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-md shadow-orange-100 flex items-center justify-center gap-2 transition-all cursor-pointer"
        >
          <Sparkles className="w-4 h-4 text-amber-200" />
          <span>Tạo đề thi</span>
        </button>
      </div>

      {/* Quizzes List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-xs text-slate-500">Đang tải danh sách bài thi...</p>
        </div>
      ) : quizzes.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center">
          <CheckSquare className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-700">Chưa có đề thi nào</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-4">
            Tạo đề từ tài liệu học tập hoặc nhập nguyên bộ câu hỏi từ file trắc nghiệm của bạn.
          </p>
          <button
            onClick={() => {
              setSourceDocumentForQuiz(null);
              setGeneratorMode('choose');
              setGenError(null);
              setIsGeneratorOpen(true);
            }}
            className="px-4 py-2 bg-orange-50 text-orange-600 hover:bg-orange-100 border border-orange-200/60 rounded-xl text-xs font-semibold cursor-pointer"
          >
            Tạo đề thi đầu tiên
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {quizzes.map((q) => (
            <div
              key={q.id}
              id={`quiz-card-${q.id}`}
              className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md hover:border-blue-200 transition-all flex flex-col justify-between p-5"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      q.difficulty === 'hard'
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : q.difficulty === 'medium'
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }`}
                  >
                    {q.difficulty === 'hard' ? 'Nâng cao' : q.difficulty === 'medium' ? 'Trung bình' : 'Cơ bản'}
                  </span>

                  <button
                    onClick={() => setDeleteConfirmQuiz(q)}
                    title="Xóa bộ đề"
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <h3 className="text-sm font-bold text-slate-900 line-clamp-2 mb-2">{q.title}</h3>

                <p className="text-xs text-slate-500 mb-4 line-clamp-1">
                  📚 Giáo trình: <span className="font-medium text-slate-700">{q.document_title}</span>
                </p>

                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs mb-4">
                  <div>
                    <span className="text-slate-400 text-[10px] block">Số câu hỏi</span>
                    <span className="font-bold text-slate-800">{q.total_questions} câu</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block">Điểm cao nhất</span>
                    <span className="font-bold text-blue-600">
                      {q.best_score !== null ? `${q.best_score} đ` : 'Chưa thi'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  id={`start-quiz-btn-${q.id}`}
                  onClick={() => handleStartQuiz(q.id)}
                  disabled={examLoading}
                  className="w-full py-2 px-3 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-2xs shadow-orange-100 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Bắt đầu làm bài</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quiz creation chooser and forms */}
      {isGeneratorOpen && (
        <div id="quiz-gen-modal-backdrop" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div id="quiz-gen-modal" className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 relative">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  {generatorMode === 'file' ? <Upload className="w-4 h-4" /> : <Sparkles className="w-4 h-4 text-amber-500 fill-amber-400" />}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {generatorMode === 'choose' ? 'Tạo đề thi trắc nghiệm' : generatorMode === 'document' ? 'Tạo đề từ tài liệu' : 'Tạo quiz từ file trắc nghiệm'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {generatorMode === 'choose' ? 'Chọn cách tạo đề phù hợp với bạn' : generatorMode === 'document' ? 'Aura AI tạo câu hỏi từ nội dung tài liệu' : 'Nhập toàn bộ câu hỏi và đáp án có sẵn trong file'}
                  </p>
                </div>
              </div>
              <button
                onClick={closeQuizCreator}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {genError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{genError}</span>
              </div>
            )}

            {generatorMode === 'choose' && (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => { setGeneratorMode('document'); setGenError(null); }}
                  className="w-full rounded-2xl border border-blue-200 bg-blue-50/70 p-4 text-left transition hover:border-blue-400 hover:bg-blue-50"
                >
                  <span className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white"><Sparkles className="h-5 w-5" /></span>
                    <span>
                      <span className="block text-sm font-bold text-slate-900">Tạo đề từ tài liệu</span>
                      <span className="mt-1 block text-xs leading-5 text-slate-600">Dùng Aura AI tạo 3, 5, 10 hoặc 15 câu từ tài liệu học tập.</span>
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => { setGeneratorMode('file'); setGenError(null); }}
                  className="w-full rounded-2xl border border-violet-200 bg-violet-50/60 p-4 text-left transition hover:border-violet-400 hover:bg-violet-50"
                >
                  <span className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white"><Upload className="h-5 w-5" /></span>
                    <span>
                      <span className="block text-sm font-bold text-slate-900">{sourceDocumentForQuiz ? 'Tạo quiz từ file đã tải lên' : 'Tạo quiz từ file câu hỏi trắc nghiệm'}</span>
                      <span className="mt-1 block text-xs leading-5 text-slate-600">
                        {sourceDocumentForQuiz
                          ? `Dùng trực tiếp “${sourceDocumentForQuiz.file_name}”, không cần tải lại.`
                          : 'Nhập tất cả câu hỏi từ file và giữ nguyên nội dung, đáp án, ngôn ngữ gốc.'}
                      </span>
                    </span>
                  </span>
                </button>
              </div>
            )}

            {generatorMode === 'document' && <form onSubmit={handleGenerateQuiz} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Tài liệu nguồn</label>
                <select
                  id="gen-quiz-doc-select"
                  value={genDocumentId}
                  onChange={(e) => setGenDocumentId(e.target.value)}
                  required
                  className="w-full px-3.5 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Chọn tài liệu trong thư viện --</option>
                  {documents.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.title} ({d.subject})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Độ khó đề thi</label>
                  <select
                    id="gen-quiz-diff-select"
                    value={genDifficulty}
                    onChange={(e) => setGenDifficulty(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="easy">Cơ bản (Easy)</option>
                    <option value="medium">Trung bình (Medium)</option>
                    <option value="hard">Nâng cao (Hard)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Số lượng câu hỏi</label>
                  <select
                    id="gen-quiz-count-select"
                    value={genQuestionCount}
                    onChange={(e) => setGenQuestionCount(parseInt(e.target.value, 10))}
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={3}>3 câu hỏi nhanh</option>
                    <option value={5}>5 câu hỏi tiêu chuẩn</option>
                    <option value={10}>10 câu hỏi tổng quát</option>
                    <option value={15}>15 câu hỏi chuyên sâu</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Trọng tâm chủ đề (Tùy chọn)
                </label>
                <input
                  id="gen-quiz-topic-input"
                  type="text"
                  placeholder="Ví dụ: Cú pháp điều khiển, so sánh match vs switch, kiểu dữ liệu..."
                  value={genCustomTopic}
                  onChange={(e) => setGenCustomTopic(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Smart Quiz Examination Mode Note */}
              <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-100 text-xs text-blue-900 space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-blue-700">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span>Bộ tạo câu hỏi trọng tâm & đa dạng</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Tự động loại bỏ tiêu đề bài giảng, tên giảng viên và thông tin hành chính. Đa dạng hóa các dạng câu hỏi: phân tích kết quả code, so sánh cơ chế, nhận diện khẳng định đúng/sai và tình huống thực tiễn.
                </p>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                onClick={closeQuizCreator}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  id="submit-gen-quiz-btn"
                  type="submit"
                  disabled={genLoading}
                  className="px-4 py-2 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white text-xs font-semibold rounded-xl shadow-md shadow-orange-100 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {genLoading ? (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-amber-200" />
                      <span>Khởi tạo đề thi bằng AI</span>
                    </>
                  )}
                </button>
              </div>
            </form>}

            {generatorMode === 'file' && (
              <form onSubmit={handleImportQuiz} className="space-y-4">
                {sourceDocumentForQuiz ? (
                  <div className="flex items-center gap-3 rounded-2xl border border-blue-200 bg-blue-50/70 p-4">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-blue-600"><FileText className="h-5 w-5" /></span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-slate-800">{sourceDocumentForQuiz.file_name}</span>
                      <span className="mt-1 block text-xs text-slate-500">Đã có trong thư viện · {sourceDocumentForQuiz.file_type.toUpperCase()}</span>
                    </span>
                  </div>
                ) : <label
                  htmlFor="quiz-source-file"
                  className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-5 py-6 text-center transition hover:border-blue-400 hover:bg-blue-50/50"
                >
                  <FileText className="mb-2 h-8 w-8 text-blue-600" />
                  <span className="text-sm font-semibold text-slate-800">
                    {importFile ? importFile.name : 'Chọn file đề trắc nghiệm'}
                  </span>
                  <span className="mt-1 text-xs text-slate-500">PDF, DOCX hoặc TXT · tối đa 25 MB</span>
                  <input
                    id="quiz-source-file"
                    type="file"
                    accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                    className="sr-only"
                    onChange={(event) => { setImportFile(event.target.files?.[0] || null); setGenError(null); }}
                  />
                </label>}
                <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-3 text-xs leading-5 text-slate-600">
                  <strong className="font-semibold text-slate-700">Lưu ý khi chuẩn bị file</strong>
                  <ul className="mt-1 list-disc space-y-1 pl-4">
                    <li>Đánh số từng câu; mỗi lựa chọn để riêng một dòng và bắt đầu bằng A., B., C., D. (có thể tiếp tục đến Z.).</li>
                    <li>Đặt đáp án đúng ngay dưới câu theo dạng “Đáp án: B”, hoặc đánh dấu lựa chọn đúng bằng ✓, [x], “(Đúng)” hay “(Correct)”.</li>
                    <li>Nếu đáp án ở cuối file, ghi rõ “Đáp án” rồi ghép số câu với chữ cái, ví dụ: “1A - 2C - 3B”; có thể để nhiều cặp trên một dòng hoặc mỗi dòng riêng.</li>
                    <li>Với bảng, nên có cột riêng cho số câu và đáp án. Mỗi câu cần có một đáp án hợp lệ khớp với nhãn lựa chọn.</li>
                  </ul>
                </div>
                {!sourceDocumentForQuiz && <p className="text-[11px] text-slate-500">File nhập cũng được lưu trong Thư viện tài liệu để bạn có thể xem lại.</p>}
                <div className="flex justify-between gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => { setGeneratorMode('choose'); setImportFile(null); setGenError(null); }}
                    className="rounded-xl px-4 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-100"
                  >
                    Quay lại
                  </button>
                  <button
                    type="submit"
                    disabled={genLoading || (!sourceDocumentForQuiz && !importFile)}
                    className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {genLoading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Upload className="h-4 w-4" />}
                    {sourceDocumentForQuiz ? 'Tạo quiz từ file này' : 'Tải lên và tạo quiz'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Delete Quiz Confirmation Modal */}
      {deleteConfirmQuiz && (
        <div
          id="delete-quiz-modal-backdrop"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
        >
          <div
            id="delete-quiz-modal"
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 relative animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Xác nhận xóa bộ đề thi?</h3>
                <p className="text-xs text-slate-500">Hành động này không thể hoàn tác</p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 mb-5 text-xs text-slate-700 space-y-2">
              <p className="font-semibold text-slate-900 line-clamp-2">
                📝 {deleteConfirmQuiz.title}
              </p>
              <p className="text-slate-500">
                Tài liệu: <span className="font-medium text-slate-700">{deleteConfirmQuiz.document_title}</span> • {deleteConfirmQuiz.total_questions} câu hỏi
              </p>
              <div className="pt-1 text-rose-600 text-[11px] leading-relaxed flex items-start gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>
                  Toàn bộ lịch sử các lần thi, điểm số và bài làm liên quan đến bộ đề này sẽ được dọn dẹp.
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeleteConfirmQuiz(null)}
                disabled={deleteQuizLoading}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                id="confirm-delete-quiz-btn"
                type="button"
                onClick={handleConfirmDeleteQuiz}
                disabled={deleteQuizLoading}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-md shadow-rose-100 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                {deleteQuizLoading ? (
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                <span>Xác nhận xóa</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
