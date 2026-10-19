import React from 'react';
import { User } from '../types';
import { LogOut, LogIn } from 'lucide-react';

interface NavbarProps {
  user: User | null;
  onOpenAuth: () => void;
  onLogout: () => void;
  activeTab: string;
}

export const Navbar: React.FC<NavbarProps> = ({ user, onOpenAuth, onLogout }) => {
  return (
    <header id="app-navbar" className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 py-3 flex items-center justify-between">
      {/* Brand */}
      <div className="flex items-center space-x-3">
        <img
          src="/assets/aurastudy-logo.png"
          alt="AuraStudy"
          className="w-10 h-10 object-contain shrink-0"
        />
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-extrabold text-slate-900 tracking-tight text-lg">AuraStudy</span>
          </div>
          <p className="text-[11px] text-slate-500 hidden sm:block">
            Trợ lý học tập thông minh & Ôn thi
          </p>
        </div>
      </div>

      {/* Right User Actions */}
      <div className="flex items-center space-x-3">
        {user ? (
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2.5 bg-slate-50 border border-slate-200/70 rounded-xl px-3 py-1.5">
              <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs">
                {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="text-left hidden sm:block">
                <p className="text-xs font-semibold text-slate-800 leading-tight truncate max-w-[140px]">{user.name}</p>
                <p className="text-[10px] text-slate-500 leading-tight">{user.school || 'Sinh viên'}</p>
              </div>
            </div>
            <button
              id="logout-btn"
              onClick={onLogout}
              title="Đăng xuất"
              className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            id="open-login-btn"
            onClick={onOpenAuth}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white text-xs font-semibold rounded-xl shadow-sm shadow-orange-100 transition-all cursor-pointer"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Đăng nhập</span>
          </button>
        )}
      </div>
    </header>
  );
};
