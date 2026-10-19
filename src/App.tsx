import React, { useState, useEffect, useCallback, useRef } from 'react';
import { User, DocumentItem, QuizItem, DashboardData } from './types';
import { api } from './services/api';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { DocumentsView } from './components/DocumentsView';
import { ChatView } from './components/ChatView';
import { QuizView } from './components/QuizView';
import { AuthModal } from './components/AuthModal';
import { LandingPage } from './components/LandingPage';
import { supabase } from './lib/supabase';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'documents' | 'chat' | 'quizzes'>('dashboard');
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const oauthCallbackHandled = useRef(false);

  // Core data states
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [quizzes, setQuizzes] = useState<QuizItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Cross-view selections
  const [selectedDocForChat, setSelectedDocForChat] = useState<DocumentItem | null>(null);
  const [preSelectedDocForQuiz, setPreSelectedDocForQuiz] = useState<DocumentItem | null>(null);

  // Initialize User with verification
  useEffect(() => {
    const initAuth = async () => {
      // Purge any stored student demo session
      const savedUserStr = localStorage.getItem('aurastudy_user');
      if (savedUserStr && savedUserStr.includes('student@aurastudy.edu.vn')) {
        localStorage.removeItem('aurastudy_token');
        localStorage.removeItem('aurastudy_user');
      }

      const isOAuthReturn = new URLSearchParams(window.location.search).has('code');
      if (isOAuthReturn && supabase && !oauthCallbackHandled.current) {
        oauthCallbackHandled.current = true;
        try {
          const { data: { session }, error } = await supabase.auth.getSession();
          if (error) throw error;
          if (!session?.access_token) throw new Error('Supabase did not return an authenticated session.');
          const result = await api.supabaseLogin(session.access_token);
          localStorage.setItem('aurastudy_token', result.access_token);
          localStorage.setItem('aurastudy_user', JSON.stringify(result.user));
          localStorage.removeItem('aurastudy_logged_out');
          window.history.replaceState({}, document.title, window.location.pathname);
          sessionStorage.removeItem('supabase_auth_callback_error');
          setUser(result.user);
          setLoading(false);
          return;
        } catch (error) {
          console.error('Supabase OAuth callback failed:', error);
          sessionStorage.setItem(
            'supabase_auth_callback_error',
            error instanceof Error ? error.message : 'Không thể hoàn tất phiên đăng nhập Google.'
          );
          window.history.replaceState({}, document.title, window.location.pathname);
          setIsAuthOpen(true);
          setLoading(false);
          return;
        }
      }
      const savedToken = localStorage.getItem('aurastudy_token');
      if (savedToken) {
        try {
          const currentUser = await api.getCurrentUser();
          setUser(currentUser);
          localStorage.setItem('aurastudy_user', JSON.stringify(currentUser));
          setLoading(false);
          return;
        } catch {
          // Token expired, invalidated or server state reset
          localStorage.removeItem('aurastudy_token');
          localStorage.removeItem('aurastudy_user');
        }
      }

      setLoading(false);
    };

    initAuth();
  }, []);

  // Fetch all core data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [dashRes, docsRes, quizRes] = await Promise.allSettled([
        api.getDashboardStats(),
        api.getDocuments(),
        api.getQuizzes()
      ]);

      if (dashRes.status === 'fulfilled') setDashboardData(dashRes.value);
      if (docsRes.status === 'fulfilled') setDocuments(docsRes.value);
      if (quizRes.status === 'fulfilled') setQuizzes(quizRes.value);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, fetchData]);

  // Listen for unauthorized events to prompt login
  useEffect(() => {
    const handleUnauthorized = () => {
      setUser(null);
      setIsAuthOpen(true);
    };
    window.addEventListener('aurastudy:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('aurastudy:unauthorized', handleUnauthorized);
  }, []);

  const handleLogout = () => {
    void supabase?.auth.signOut();
    localStorage.removeItem('aurastudy_token');
    localStorage.removeItem('aurastudy_user');
    localStorage.setItem('aurastudy_logged_out', 'true');
    setUser(null);
  };

  const handleSelectDocForChat = (doc: DocumentItem) => {
    setSelectedDocForChat(doc);
    setActiveTab('chat');
  };

  const handleSelectDocForQuiz = (doc: DocumentItem) => {
    setPreSelectedDocForQuiz(doc);
    setActiveTab('quizzes');
  };

  if (loading && !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fbfbff]">
        <div className="h-9 w-9 animate-spin rounded-full border-4 border-violet-200 border-t-violet-600" />
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <LandingPage onLogin={() => setIsAuthOpen(true)} />
        <AuthModal
          isOpen={isAuthOpen}
          onClose={() => setIsAuthOpen(false)}
          onSuccess={(nextUser) => {
            setIsAuthOpen(false);
            setUser(nextUser);
            fetchData();
          }}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100/60 font-sans text-slate-900 flex flex-col selection:bg-blue-500 selection:text-white">
      {/* Top Navbar */}
      <Navbar
        user={user}
        onOpenAuth={() => setIsAuthOpen(true)}
        onLogout={handleLogout}
        activeTab={activeTab}
      />

      {/* Main Layout Body */}
      <div className="flex-1 flex flex-col md:flex-row">
        {/* Navigation Sidebar */}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          documentCount={documents.length}
          quizCount={quizzes.length}
        />

        {/* View Contents Container */}
        <main className="flex-1 overflow-x-hidden min-h-[calc(100vh-61px)]">
          {activeTab === 'dashboard' && (
            <DashboardView
              data={dashboardData}
              loading={loading}
              onNavigate={(tab) => setActiveTab(tab)}
              onSelectDocumentForChat={handleSelectDocForChat}
              onSelectDocumentForQuiz={handleSelectDocForQuiz}
              onRefresh={fetchData}
            />
          )}

          {activeTab === 'documents' && (
            <DocumentsView
              documents={documents}
              loading={loading}
              user={user}
              onOpenAuth={() => setIsAuthOpen(true)}
              onRefresh={fetchData}
              onSelectDocumentForChat={handleSelectDocForChat}
              onSelectDocumentForQuiz={handleSelectDocForQuiz}
            />
          )}

          {activeTab === 'chat' && (
            <ChatView
              documents={documents}
              selectedDocument={selectedDocForChat}
              onSelectDocument={setSelectedDocForChat}
              onOpenQuizModal={handleSelectDocForQuiz}
            />
          )}

          {activeTab === 'quizzes' && (
            <QuizView
              quizzes={quizzes}
              documents={documents}
              loading={loading}
              onRefresh={fetchData}
              preSelectedDoc={preSelectedDocForQuiz}
              onClearPreSelectedDoc={() => setPreSelectedDocForQuiz(null)}
            />
          )}
        </main>
      </div>

      {/* Authentication Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onSuccess={(u) => {
          setUser(u);
          fetchData();
        }}
      />
    </div>
  );
}
