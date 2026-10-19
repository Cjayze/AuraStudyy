import React, { useState, useRef, useEffect } from 'react';
import { DocumentItem, ChatMessage } from '../types';
import { api } from '../services/api';
import {
  Send,
  Sparkles,
  Bot,
  User as UserIcon,
  ChevronDown,
  ChevronUp,
  Layers,
  RotateCcw,
  Lightbulb,
  FileText
} from 'lucide-react';

const renderInlineText = (text: string): React.ReactNode[] =>
  text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g).filter(Boolean).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index} className="font-semibold text-slate-900">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={index} className="rounded bg-slate-200/70 px-1.5 py-0.5 font-mono text-[0.9em] text-blue-800">{part.slice(1, -1)}</code>;
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    return part;
  });

const FormattedMessage: React.FC<{ content: string }> = ({ content }) => (
  <div className="space-y-2.5 break-words text-[14px] leading-7 sm:text-[15px]">
    {content.replace(/\r\n?/g, '\n').split('\n').map((rawLine, index) => {
      const line = rawLine.trim();
      if (!line) return <div key={index} className="h-1" />;
      const heading = line.match(/^#{1,3}\s+(.+)$/);
      if (heading) return <h3 key={index} className="pt-1 text-[15px] font-bold leading-6 text-slate-900 sm:text-base">{renderInlineText(heading[1])}</h3>;
      const bullet = line.match(/^(?:[-*•+]\s+)(.+)$/);
      if (bullet) return <div key={index} className="flex gap-2.5 pl-1"><span className="mt-[11px] h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" /><p className="min-w-0">{renderInlineText(bullet[1])}</p></div>;
      const numbered = line.match(/^\d+[.)]\s+(.+)$/);
      if (numbered) return <div key={index} className="flex gap-2"><span className="shrink-0 font-semibold text-blue-700">{line.match(/^\d+/)?.[0]}.</span><p className="min-w-0">{renderInlineText(numbered[1])}</p></div>;
      return <p key={index}>{renderInlineText(line)}</p>;
    })}
  </div>
);

interface ChatViewProps {
  documents: DocumentItem[];
  selectedDocument: DocumentItem | null;
  onSelectDocument: (doc: DocumentItem | null) => void;
  onOpenQuizModal: (doc: DocumentItem) => void;
}

export const ChatView: React.FC<ChatViewProps> = ({
  documents,
  selectedDocument,
  onSelectDocument,
  onOpenQuizModal
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Xin chào! Tôi là **Aura AI**, trợ lý học tập được hỗ trợ bởi mô hình Gemini và kỹ thuật RAG (Retrieval-Augmented Generation).\n\nTôi có thể giúp bạn giải đáp thắc mắc chuyên sâu, tra cứu kiến thức chuẩn xác từ các tài liệu bạn đã tải lên, tóm tắt bài giảng hoặc gợi ý câu hỏi ôn tập!',
      timestamp: new Date().toISOString(),
    }
  ]);

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [expandedCitationId, setExpandedCitationId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | undefined>();

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  useEffect(() => {
    setSessionId(undefined);
  }, [selectedDocument?.id]);

  const handleSend = async (questionText?: string) => {
    const query = questionText || input.trim();
    if (!query || loading) return;

    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: new Date().toISOString()
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!questionText) setInput('');
    setLoading(true);

    try {
      const res = await api.askQuestion({
        question: query,
        document_id: selectedDocument ? selectedDocument.id : undefined,
        session_id: sessionId
      });
      if (res.session_id) setSessionId(res.session_id);

      const assistantMsg: ChatMessage = {
        id: `ai_${Date.now()}`,
        role: 'assistant',
        content: res.answer,
        timestamp: new Date().toISOString(),
        retrieved_context: res.retrieved_context,
        suggested_questions: res.suggested_questions,
        model_used: res.model_used
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `err_${Date.now()}`,
        role: 'assistant',
        content: `⚠️ Có lỗi xảy ra khi xử lý câu hỏi: ${err?.message || 'Không thể kết nối đến máy chủ.'}`,
        timestamp: new Date().toISOString()
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClearHistory = () => {
    setSessionId(undefined);
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content: 'Cuộc trò chuyện đã được làm mới. Hãy đặt bất kỳ câu hỏi nào về tài liệu học tập của bạn!',
        timestamp: new Date().toISOString(),
        suggested_questions: [
          'Tóm tắt nội dung chính của tài liệu',
          'Các khái niệm quan trọng nhất cần nhớ là gì?'
        ]
      }
    ]);
  };

  return (
    <div id="chat-view-content" className="mx-auto flex h-[calc(100vh-61px)] max-w-5xl flex-col gap-3 bg-slate-50/50 p-3 sm:gap-4 sm:p-6">
      
      {/* Top Bar: Context Selector & Tools */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-sm sm:px-5">
        <div className="flex items-center gap-2.5 flex-1 min-w-[260px]">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-sky-400 text-white shadow-sm shadow-blue-200">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-semibold text-slate-800 sm:text-sm">
              Phạm vi ngữ cảnh RAG
            </label>
            <select
              id="chat-document-selector"
              value={selectedDocument ? selectedDocument.id : 'all'}
              onChange={(e) => {
                const docId = e.target.value;
                if (docId === 'all') {
                  onSelectDocument(null);
                } else {
                  const doc = documents.find((d) => d.id === docId);
                  if (doc) onSelectDocument(doc);
                }
              }}
              className="w-full cursor-pointer border-none bg-transparent p-0 text-xs font-medium text-slate-500 focus:outline-none focus:ring-0 sm:text-sm"
            >
              <option value="all">🔍 Tìm kiếm thông minh trên tất cả tài liệu ({documents.length} bài)</option>
              {documents.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  📄 {doc.title} ({doc.subject})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {selectedDocument && (
            <button
              id="chat-create-quiz-shortcut"
              onClick={() => onOpenQuizModal(selectedDocument)}
              className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100"
            >
              <Layers className="h-3.5 w-3.5 text-blue-600" />
              <span className="hidden sm:inline">Tạo đề thi từ bài này</span>
            </button>
          )}

          <button
            id="chat-clear-btn"
            onClick={handleClearHistory}
            title="Làm mới cuộc trò chuyện"
            className="cursor-pointer rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 space-y-6 overflow-y-auto rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:space-y-7 sm:p-7">
        {messages.map((msg) => {
          const isAI = msg.role === 'assistant';
          return (
            <div
              key={msg.id}
              className={`flex gap-2.5 sm:gap-3 ${isAI ? 'justify-start' : 'justify-end'}`}
            >
              {isAI && (
                <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 ring-1 ring-blue-100">
                  <Sparkles className="h-4 w-4" />
                </div>
              )}

              <div className={`max-w-[85%] sm:max-w-[75%] space-y-2.5`}>
                <div
                  className={`rounded-2xl px-4 py-3.5 sm:px-5 sm:py-4 ${
                    isAI
                      ? 'rounded-tl-md border border-slate-200/80 bg-slate-50/80 text-slate-700'
                      : 'rounded-tr-md bg-blue-600 text-white shadow-sm shadow-blue-200'
                  }`}
                >
                  {!isAI && <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-blue-100">Bạn</div>}
                  <FormattedMessage content={msg.content} />
                </div>

                {/* Citations / Reference Chunks */}
                {isAI && msg.retrieved_context && msg.retrieved_context.length > 0 && (
                  <div className="space-y-2 rounded-xl border border-blue-100 bg-blue-50/60 p-3 text-xs">
                    <button
                      onClick={() =>
                        setExpandedCitationId(expandedCitationId === msg.id ? null : msg.id)
                      }
                      className="w-full flex items-center justify-between text-[11px] font-semibold text-blue-900 cursor-pointer"
                    >
                      <span className="flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-blue-600" />
                        Trích dẫn nguồn tài liệu đối chiếu ({msg.retrieved_context.length} đoạn văn)
                      </span>
                      {expandedCitationId === msg.id ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>

                    {expandedCitationId === msg.id && (
                      <div className="space-y-2 pt-1">
                        {msg.retrieved_context.map((ctx, idx) => (
                          <div
                            key={idx}
                            className="bg-white p-2.5 rounded-lg border border-blue-100 text-[11px] text-slate-700"
                          >
                            <div className="flex items-center justify-between font-medium text-blue-900 mb-1">
                              <span className="truncate max-w-[200px]">📌 {ctx.document_title}</span>
                              <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.2 rounded">
                                Độ tương đồng: {Math.round(ctx.similarity_score * 100)}%
                              </span>
                            </div>
                            <p className="text-slate-600 italic line-clamp-3">"{ctx.chunk_text}"</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Suggested Questions Chips */}
                {isAI && msg.suggested_questions && msg.suggested_questions.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <p className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                      <Lightbulb className="w-3 h-3 text-amber-500" /> Gợi ý câu hỏi tiếp theo:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {msg.suggested_questions.map((q, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleSend(q)}
                          className="px-2.5 py-1 bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-slate-700 hover:text-blue-700 text-xs rounded-full transition-colors text-left cursor-pointer"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {!isAI && (
                <div className="w-8 h-8 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                  <UserIcon className="w-4 h-4" />
                </div>
              )}
            </div>
          );
        })}

        {loading && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="p-3.5 bg-slate-50 border border-slate-200/70 rounded-2xl text-xs text-slate-500 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping"></span>
              <span>Aura AI đang tra cứu tài liệu & đối chiếu kiến thức...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Box */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-2 shadow-lg shadow-slate-200/50 sm:p-2.5">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-end gap-2"
        >
          <textarea
            id="chat-input-textarea"
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              selectedDocument
                ? `Hỏi bất kỳ điều gì về "${selectedDocument.title}"... (Enter để gửi)`
                : 'Đặt câu hỏi về kiến thức, bài giảng hoặc yêu cầu giải thích thuật ngữ... (Enter để gửi)'
            }
            className="max-h-36 min-h-12 flex-1 resize-none bg-transparent p-3 text-sm leading-6 text-slate-800 placeholder:text-slate-400 focus:outline-none sm:text-[15px]"
          />
          <button
            id="chat-send-btn"
            type="submit"
            disabled={!input.trim() || loading}
            aria-label="Gửi tin nhắn"
            className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-200 transition-all hover:bg-blue-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
