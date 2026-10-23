import React from 'react';
import type { User } from '../types';
import type { Language } from '../i18n';
import { LogIn } from 'lucide-react';
import { ProfileSettings } from './ProfileSettings';

interface NavbarProps {
  user: User | null;
  onOpenAuth: () => void;
  onLogout: () => void;
  activeTab: string;
  language: Language;
  onLanguageChange: (language: Language) => void;
  onProfileUpdated: (user: User) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ user, onOpenAuth, onLogout, language, onLanguageChange, onProfileUpdated }) => (
  <header id="app-navbar" className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 py-3 backdrop-blur-md sm:px-6">
    <div className="flex items-center space-x-3">
      <img src="/assets/aurastudy-logo.png" alt="AuraStudy" className="h-10 w-10 shrink-0 object-contain" />
      <div>
        <span className="text-lg font-extrabold tracking-tight text-slate-900">AuraStudy</span>
        <p className="hidden text-[11px] text-slate-500 sm:block">{language === 'en' ? 'Smart study assistant & exam prep' : 'Trợ lý học tập thông minh & Ôn thi'}</p>
      </div>
    </div>
    <div className="flex items-center space-x-3">
      {user ? <ProfileSettings user={user} language={language} onLanguageChange={onLanguageChange} onProfileUpdated={onProfileUpdated} onLogout={onLogout} /> : (
        <button id="open-login-btn" onClick={onOpenAuth} className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-orange-500 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm shadow-orange-100 transition-all hover:bg-orange-600">
          <LogIn className="h-3.5 w-3.5"/><span>{language === 'en' ? 'Log in' : 'Đăng nhập'}</span>
        </button>
      )}
    </div>
  </header>
);
