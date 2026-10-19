import React from 'react';
import { LayoutDashboard, FileText, MessageSquareQuote, CheckSquare, Sparkles, FolderSync } from 'lucide-react';

interface SidebarProps {
  activeTab: 'dashboard' | 'documents' | 'chat' | 'quizzes';
  setActiveTab: (tab: 'dashboard' | 'documents' | 'chat' | 'quizzes') => void;
  documentCount?: number;
  quizCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  documentCount = 0,
  quizCount = 0
}) => {
  const navItems = [
    {
      id: 'dashboard',
      label: 'Tổng quan',
      icon: LayoutDashboard,
      badge: null
    },
    {
      id: 'documents',
      label: 'Tài liệu học tập',
      icon: FileText,
      badge: documentCount > 0 ? documentCount : null
    },
    {
      id: 'chat',
      label: 'Trợ lý Aura AI',
      icon: MessageSquareQuote,
      badge: 'RAG'
    },
    {
      id: 'quizzes',
      label: 'Thi & Trắc nghiệm',
      icon: CheckSquare,
      badge: quizCount > 0 ? quizCount : null
    }
  ] as const;

  return (
    <aside id="app-sidebar" className="w-full md:w-64 bg-slate-50/70 md:min-h-[calc(100vh-61px)] border-r border-slate-200/80 p-3 md:p-4 flex flex-col justify-between shrink-0">
      <div className="space-y-1 md:space-y-1.5">
        <div className="hidden md:block px-3 py-2 text-[11px] font-semibold text-slate-400 tracking-wider uppercase">
          Không gian học tập
        </div>
        <nav className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible pb-2 md:pb-0">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`sidebar-tab-${item.id}`}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-200'
                    : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                  <span>{item.label}</span>
                </div>

                {item.badge !== null && (
                  <span
                    className={`ml-2 px-2 py-0.5 text-[10px] font-semibold rounded-full ${
                      isActive
                        ? 'bg-blue-700/80 text-white'
                        : item.badge === 'RAG'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Mini Feature Card in Sidebar */}
      <div className="hidden md:block mt-6 p-3.5 bg-gradient-to-br from-blue-50 to-slate-100 border border-blue-100/80 rounded-2xl">
        <div className="flex items-center gap-2 text-blue-900 font-semibold text-xs mb-1">
          <Sparkles className="w-3.5 h-3.5 text-blue-600" />
          <span>Aura Copilot</span>
        </div>
        <p className="text-[11px] text-slate-600 leading-relaxed mb-2.5">
          Tải lên tài liệu PDF hoặc TXT để tra cứu câu hỏi chuẩn xác và sinh bộ đề thi trắc nghiệm trong 5 giây.
        </p>
        <button
          id="sidebar-quick-upload-btn"
          onClick={() => setActiveTab('documents')}
          className="w-full py-1.5 px-2.5 bg-white hover:bg-blue-50 border border-blue-200 text-blue-700 text-xs font-medium rounded-lg shadow-2xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <FolderSync className="w-3.5 h-3.5" />
          <span>Quản lý tài liệu</span>
        </button>
      </div>
    </aside>
  );
};
