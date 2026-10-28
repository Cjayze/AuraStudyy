import React, { useState, useEffect } from 'react';
import { DocumentItem, DocumentSummary, User } from '../types';
import { api } from '../services/api';
import {
  UploadCloud,
  Search,
  Filter,
  FileText,
  Trash2,
  Sparkles,
  CheckCircle2,
  Clock,
  Layers,
  FileCheck,
  AlertCircle,
  Eye,
  BookOpen,
  X,
  FileSpreadsheet,
  LogIn
} from 'lucide-react';

const cleanSummaryText = (text: string) => text
  .replace(/&#(?:x([\da-f]+)|(\d+));?/gi, (entity, hex, decimal) => {
    const codePoint = Number.parseInt(hex || decimal, hex ? 16 : 10);
    return codePoint > 0 && codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : entity;
  })
  .replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/\\([#*+._-])/g, '$1')
  .replace(/^(\s*)#{1,6}\s*/gm, '$1- ')
  .replace(/\p{Extended_Pictographic}/gu, '')
  .replace(/[*_`~]/g, '')
  .replace(/^(\s*)(?:[-+\u2022\u25cf\u25aa.]|\d+[.)])\s*(?:\+\s*)?/gm, '$1+ ')
  .replace(/[\u2022\u25cf\u25aa]/g, '+')
  .replace(/[ \t]+\n/g, '\n')
  .trim();

interface DocumentsViewProps {
  documents: DocumentItem[];
  loading: boolean;
  user?: User | null;
  onOpenAuth?: () => void;
  onRefresh: () => void;
  onSelectDocumentForChat: (doc: DocumentItem) => void;
  onSelectDocumentForQuiz: (doc: DocumentItem) => void;
}

export const DocumentsView: React.FC<DocumentsViewProps> = ({
  documents,
  loading,
  user,
  onOpenAuth,
  onRefresh,
  onSelectDocumentForChat,
  onSelectDocumentForQuiz
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Delete modal state
  const [deleteConfirmDoc, setDeleteConfirmDoc] = useState<DocumentItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form state
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('Công nghệ thông tin');
  const [isDragging, setIsDragging] = useState(false);

  // Preview state
  const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Summary state
  const [summaryDoc, setSummaryDoc] = useState<DocumentItem | null>(null);
  const [summaryData, setSummaryData] = useState<DocumentSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  // Auto-dismiss notification
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Get distinct subjects
  const subjects = ['all', ...Array.from(new Set(documents.map((d) => d.subject).filter(Boolean)))];

  // Filtered docs
  const filteredDocs = documents.filter((doc) => {
    const matchesSearch =
      doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.file_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSubject = selectedSubject === 'all' || doc.subject === selectedSubject;
    return matchesSearch && matchesSubject;
  });

  const handleFileSelect = (selected: File) => {
    if (selected.size > 25 * 1024 * 1024) {
      setUploadError('Tệp quá lớn. Vui lòng chọn tệp dung lượng dưới 25MB.');
      return;
    }
    const ext = selected.name.split('.').pop()?.toLowerCase() || '';
    const allowed = ['pdf', 'docx', 'doc', 'pptx', 'ppt', 'txt', 'md', 'markdown', 'rtf'];
    if (ext && !allowed.includes(ext)) {
      setUploadError(`Định dạng .${ext} không được hỗ trợ. Vui lòng tải file PDF, DOCX, PPTX, TXT hoặc MD.`);
      return;
    }
    setUploadError(null);
    setFile(selected);
    if (!title) {
      setTitle(selected.name.replace(/\.[^/.]+$/, ''));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setUploadError('Bạn cần đăng nhập để tải tài liệu lên hệ thống.');
      if (onOpenAuth) onOpenAuth();
      return;
    }
    if (!file) {
      setUploadError('Vui lòng chọn tệp tài liệu (PDF, TXT, DOCX, PPTX, MD).');
      return;
    }
    setUploadLoading(true);
    setUploadError(null);

    try {
      await api.uploadDocument(file, title, subject);
      setNotification({
        type: 'success',
        message: `Đã tải lên và lập chỉ mục RAG thành công cho tài liệu "${title || file.name}".`
      });
      setIsUploadOpen(false);
      setFile(null);
      setTitle('');
      onRefresh();
    } catch (err: any) {
      setUploadError(err?.message || 'Lỗi khi tải lên tài liệu.');
    } finally {
      setUploadLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmDoc) return;
    setDeleteLoading(true);
    try {
      const res = await api.deleteDocument(deleteConfirmDoc.id);
      setNotification({
        type: 'success',
        message: res.message || `Đã xóa tài liệu "${deleteConfirmDoc.title}" và các dữ liệu liên quan thành công.`
      });
      setDeleteConfirmDoc(null);
      onRefresh();
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err?.message || 'Không thể xóa tài liệu. Vui lòng thử lại.'
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleOpenPreview = async (doc: DocumentItem) => {
    setPreviewDoc(doc);
    setPreviewLoading(true);
    try {
      const detailed = await api.getDocumentById(doc.id);
      setPreviewDoc(detailed);
    } catch {
      // Keep basic doc if detailed fetch fails
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleOpenSummary = async (doc: DocumentItem) => {
    setSummaryDoc(doc);
    setSummaryLoading(true);
    try {
      const res = await api.summarizeDocument(doc.id, 'detailed');
      setSummaryData(res);
    } catch (err: any) {
      setNotification({
        type: 'error',
        message: err?.message || 'Không thể tóm tắt tài liệu.'
      });
      setSummaryDoc(null);
    } finally {
      setSummaryLoading(false);
    }
  };

  return (
    <div id="documents-view-content" className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Toast Notification Banner */}
      {notification && (
        <div
          id="documents-notification-banner"
          className={`p-4 rounded-2xl border flex items-center justify-between gap-3 text-xs sm:text-sm font-medium transition-all shadow-xs ${
            notification.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="p-1 hover:opacity-75 cursor-pointer rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header with Search & Upload Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Thư viện tài liệu học tập</h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Quản lý tài liệu môn học, phân tách đoạn văn bản tự động để phục vụ AI RAG và sinh đề thi
          </p>
        </div>
        <button
          id="open-upload-modal-btn"
          onClick={() => {
            if (!user && onOpenAuth) {
              onOpenAuth();
              return;
            }
            setUploadError(null);
            setIsUploadOpen(true);
          }}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-md shadow-blue-100 flex items-center justify-center gap-2 transition-all cursor-pointer"
        >
          <UploadCloud className="w-4 h-4" />
          <span>Tải tài liệu mới</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            id="doc-search-input"
            type="text"
            placeholder="Tìm theo tên bài giảng, môn học..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Subject Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0 mr-1" />
          {subjects.map((sub) => (
            <button
              key={sub}
              id={`filter-subject-${sub}`}
              onClick={() => setSelectedSubject(sub)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
                selectedSubject === sub
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {sub === 'all' ? 'Tất cả môn' : sub}
            </button>
          ))}
        </div>
      </div>

      {/* Documents Grid */}
      {loading ? (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-xs text-slate-500">Đang tải danh sách tài liệu...</p>
        </div>
      ) : filteredDocs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center">
          <FileSpreadsheet className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-700">Chưa tìm thấy tài liệu phù hợp</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-4">
            Hãy thử tìm kiếm với từ khóa khác hoặc tải lên tài liệu mới để bắt đầu học tập cùng Aura AI.
          </p>
          <button
            onClick={() => setIsUploadOpen(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-xs"
          >
            Tải lên tài liệu ngay
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredDocs.map((doc) => (
            <div
              key={doc.id}
              id={`doc-card-grid-${doc.id}`}
              className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md hover:border-blue-200 transition-all flex flex-col justify-between p-5 group"
            >
              <div>
                {/* Top Badge & Delete */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                    {doc.subject}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      id={`preview-doc-btn-${doc.id}`}
                      onClick={() => handleOpenPreview(doc)}
                      title="Xem nội dung chi tiết"
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      id={`delete-doc-btn-${doc.id}`}
                      onClick={() => setDeleteConfirmDoc(doc)}
                      title="Xóa tài liệu"
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Title */}
                <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-2 mb-2">
                  {doc.title}
                </h3>

                {/* Meta details */}
                <div className="space-y-1.5 text-xs text-slate-500 mb-4">
                  <div className="flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-slate-400" />
                    <span className="truncate">{doc.file_name}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="flex items-center gap-1 text-emerald-600 font-medium">
                      <CheckCircle2 className="w-3 h-3" />
                      RAG Ready ({doc.chunk_count || 3} đoạn văn)
                    </span>
                    <span>{(doc.file_size / 1024).toFixed(0)} KB</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    id={`chat-action-btn-${doc.id}`}
                    onClick={() => onSelectDocumentForChat(doc)}
                    className="py-1.5 px-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                    <span>Hỏi Aura AI</span>
                  </button>
                  <button
                    id={`summary-action-btn-${doc.id}`}
                    onClick={() => handleOpenSummary(doc)}
                    className="py-1.5 px-2 bg-sky-50 hover:bg-sky-100 text-sky-700 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-sky-600" />
                    <span>Tóm tắt nội dung</span>
                  </button>
                </div>

                <button
                  id={`quiz-action-btn-${doc.id}`}
                  onClick={() => onSelectDocumentForQuiz(doc)}
                  className="w-full py-2 px-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-2xs shadow-blue-100 cursor-pointer"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Tạo đề thi trắc nghiệm</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Document Modal */}
      {isUploadOpen && (
        <div id="upload-doc-modal-backdrop" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div id="upload-doc-modal" className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 relative">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <UploadCloud className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Tải tài liệu học tập mới</h3>
                  <p className="text-xs text-slate-500">Hỗ trợ các định dạng .pdf, .txt, .docx</p>
                </div>
              </div>
              <button
                onClick={() => setIsUploadOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {uploadError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            <form onSubmit={handleUpload} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Tệp tài liệu (PDF, DOCX, TXT, MD)</label>
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-xl p-5 text-center transition-all bg-slate-50/50 ${
                    isDragging
                      ? 'border-blue-500 bg-blue-50/60 ring-2 ring-blue-200'
                      : 'border-slate-300 hover:border-blue-400'
                  }`}
                >
                  <UploadCloud className={`w-8 h-8 mx-auto mb-2 transition-colors ${isDragging ? 'text-blue-600 scale-110' : 'text-slate-400'}`} />
                  <p className="text-xs text-slate-600 mb-2">
                    Kéo và thả tệp tài liệu vào đây hoặc chọn tệp từ máy tính
                  </p>
                  <input
                    id="doc-file-input"
                    type="file"
                    accept=".pdf,.docx,.doc,.txt,.md,.rtf"
                    onChange={handleFileChange}
                    className="block w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
                  />
                  {file && (
                    <div className="mt-3 p-2 bg-blue-50/80 rounded-lg border border-blue-100 flex items-center justify-between text-xs text-blue-700 font-medium">
                      <span className="truncate">📄 {file.name} ({(file.size / 1024).toFixed(1)} KB)</span>
                      <button
                        type="button"
                        onClick={() => setFile(null)}
                        className="p-1 hover:text-rose-600 cursor-pointer"
                        title="Bỏ chọn tệp"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Tiêu đề giáo trình / bài giảng</label>
                <input
                  id="doc-title-input"
                  type="text"
                  required
                  placeholder="Ví dụ: Hệ Quản Trị CSDL - Chương 5"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Môn học / Chuyên ngành</label>
                <input
                  id="doc-subject-input"
                  type="text"
                  required
                  placeholder="Ví dụ: Cơ sở dữ liệu, Mạng máy tính..."
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsUploadOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  id="submit-upload-doc-btn"
                  type="submit"
                  disabled={uploadLoading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold rounded-xl shadow-md shadow-blue-100 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {uploadLoading ? (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  ) : (
                    <>
                      <UploadCloud className="w-4 h-4" />
                      <span>Xử lý & Tải lên</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Preview Document Modal */}
      {previewDoc && (
        <div id="preview-doc-modal-backdrop" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div id="preview-doc-modal" className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full p-6 relative max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">{previewDoc.title}</h3>
                <p className="text-xs text-slate-500">{previewDoc.subject} • {previewDoc.file_name}</p>
              </div>
              <button
                onClick={() => setPreviewDoc(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 text-xs text-slate-700 space-y-3 leading-relaxed">
              {previewLoading ? (
                <div className="text-center py-10">
                  <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                  <p className="text-xs text-slate-400">Đang đọc nội dung bài học...</p>
                </div>
              ) : (
                <pre className="whitespace-pre-wrap font-sans bg-slate-50 p-4 rounded-xl border border-slate-200/80 text-xs">
                  {previewDoc.raw_text || 'Tài liệu đã được phân tích thành các đoạn văn bản vector RAG.'}
                </pre>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
              <button
                onClick={() => {
                  const d = previewDoc;
                  setPreviewDoc(null);
                  onSelectDocumentForChat(d);
                }}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Hỏi đáp AI với tài liệu này</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Summary Modal */}
      {summaryDoc && (
        <div id="summary-doc-modal-backdrop" className="fixed inset-0 z-50 flex overflow-y-auto items-start sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div id="summary-doc-modal" className="my-auto bg-white rounded-2xl shadow-2xl max-w-4xl w-full p-6 sm:p-8 relative max-h-[calc(100vh-2rem)] flex flex-col">
            <div className="flex shrink-0 items-center justify-between pb-5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Tóm tắt thông minh Aura AI</h3>
                  <p className="text-sm text-slate-500 mt-1">{summaryDoc.title}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setSummaryDoc(null);
                  setSummaryData(null);
                }}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-6 text-base text-slate-800 space-y-7 leading-8">
              {summaryLoading ? (
                <div className="text-center py-12">
                  <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                  <p className="text-base text-slate-600 font-medium">Aura AI đang đọc và phân tích chuyên sâu nội dung bài giảng...</p>
                </div>
              ) : summaryData ? (
                <div className="space-y-7">
                  <div>
                    <p className="font-bold text-slate-900 text-lg mb-3">Tổng quan nội dung:</p>
                    <div className="whitespace-pre-wrap text-slate-700 leading-8 text-base sm:text-lg">
                      {cleanSummaryText(summaryData.summary)}
                    </div>
                  </div>

                  {summaryData.bullet_points && summaryData.bullet_points.length > 0 && (
                    <div>
                      <p className="font-bold text-slate-900 text-lg mb-3">Ý chính cần nắm vững:</p>
                      <ul className="space-y-3">
                        {summaryData.bullet_points.map((b, i) => (
                          <li key={i} className="flex items-start gap-3 text-base sm:text-lg text-slate-700 leading-8">
                            <span className="w-4 text-blue-600 font-bold shrink-0">+</span>
                            <span>{cleanSummaryText(b)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {summaryData.key_concepts && summaryData.key_concepts.length > 0 && (
                    <div>
                      <p className="font-bold text-slate-900 text-lg mb-3">Khái niệm và thuật ngữ quan trọng:</p>
                      <ul className="space-y-3">
                        {summaryData.key_concepts.map((concept, i) => (
                          <li key={i} className="flex items-start gap-3 text-base sm:text-lg text-slate-700 leading-8">
                            <span className="w-4 text-blue-600 font-bold shrink-0">+</span>
                            <span>{cleanSummaryText(concept)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {summaryData.conclusion && (
                    <div className="border-t border-slate-200 pt-5">
                      <p className="font-bold text-slate-900 text-lg mb-3">Kết luận:</p>
                      <div className="whitespace-pre-wrap text-slate-700 leading-8 text-base sm:text-lg">
                        {cleanSummaryText(summaryData.conclusion)}
                      </div>
                    </div>
                  )}

                  {summaryData.keywords && summaryData.keywords.length > 0 && (
                    <div>
                      <p className="font-bold text-slate-900 text-lg mb-3">Từ khóa:</p>
                      <div className="flex flex-wrap gap-2">
                        {summaryData.keywords.map((keyword, i) => (
                          <span key={i} className="rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
                            {cleanSummaryText(keyword)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {summaryData.exam_tips && summaryData.exam_tips.length > 0 && (
                    <div className="border-t border-slate-200 pt-5">
                      <p className="font-bold text-slate-900 text-lg mb-3 flex items-center gap-2">
                        Điểm mấu chốt ôn thi (Exam Tips):
                      </p>
                      <ul className="space-y-3">
                        {summaryData.exam_tips.map((tip, i) => (
                          <li key={i} className="flex items-start gap-3 text-base sm:text-lg text-slate-700 leading-8">
                            <span className="w-4 text-slate-500 font-bold shrink-0">+</span>
                            <span>{cleanSummaryText(tip)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Delete Document Confirmation Modal */}
      {deleteConfirmDoc && (
        <div
          id="delete-doc-modal-backdrop"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
        >
          <div
            id="delete-doc-modal"
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 relative animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Xác nhận xóa tài liệu?</h3>
                <p className="text-xs text-slate-500">Hành động này không thể hoàn tác</p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 mb-5 text-xs text-slate-700 space-y-2">
              <p className="font-semibold text-slate-900 line-clamp-2">
                📄 {deleteConfirmDoc.title}
              </p>
              <p className="text-slate-500">
                Môn học: <span className="font-medium text-slate-700">{deleteConfirmDoc.subject}</span> • Tệp: {deleteConfirmDoc.file_name}
              </p>
              <div className="pt-1 text-rose-600 text-[11px] leading-relaxed flex items-start gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>
                  Hệ thống sẽ đồng thời thu hồi các đoạn vector RAG và các bài kiểm tra trắc nghiệm sinh từ tài liệu này.
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeleteConfirmDoc(null)}
                disabled={deleteLoading}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                id="confirm-delete-doc-btn"
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleteLoading}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-md shadow-rose-100 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                {deleteLoading ? (
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
