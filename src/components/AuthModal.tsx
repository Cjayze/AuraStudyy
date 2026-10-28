import React, { useEffect, useState } from 'react';
import { User } from '../types';
import { api } from '../services/api';
import { supabase } from '../lib/supabase';
import { LogIn, UserPlus, Sparkles, BookOpen, AlertCircle, CheckCircle2, X } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: User) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [school, setSchool] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    const callbackError = sessionStorage.getItem('supabase_auth_callback_error');
    if (callbackError) {
      setError(callbackError);
      sessionStorage.removeItem('supabase_auth_callback_error');
    }
  }, []);

  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    setError(null);
    setSuccessMsg(null);
    setGoogleLoading(true);
    try {
      if (!supabase) throw new Error('Thi\u1ebfu VITE_SUPABASE_URL ho\u1eb7c VITE_SUPABASE_ANON_KEY trong file .env.');
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin }
      });
      if (error) throw error;
    } catch (err: any) {
      console.error('Supabase Google sign-in error:', err);
      const messages: Record<string, string> = {
        provider_disabled: 'Google ch\u01b0a \u0111\u01b0\u1ee3c b\u1eadt trong Supabase. M\u1edf Authentication > Providers > Google \u0111\u1ec3 c\u1ea5u h\u00ecnh.',
        validation_failed: 'Supabase t\u1eeb ch\u1ed1i c\u1ea5u h\u00ecnh Google OAuth. Ki\u1ec3m tra Google Client ID v\u00e0 Client Secret.',
        access_denied: 'B\u1ea1n \u0111\u00e3 t\u1eeb ch\u1ed1i \u0111\u0103ng nh\u1eadp Google.'
      };
      setError(messages[err.code] || err.message || 'Kh\u00f4ng th\u1ec3 \u0111\u0103ng nh\u1eadp Google qua Supabase.');
      setGoogleLoading(false);
    }
  };

  const handleSwitchMode = (registerMode: boolean) => {
    setIsRegister(registerMode);
    setError(null);
    setSuccessMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password;
    const trimmedName = name.trim();
    const trimmedSchool = school.trim();

    if (!trimmedEmail) {
      setError('Vui lòng nhập địa chỉ email của bạn.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setError('Địa chỉ email không đúng định dạng hợp lệ (vd: sinhvien@gmail.com).');
      return;
    }

    if (!trimmedPassword || trimmedPassword.length < 6) {
      setError('Mật khẩu phải có độ dài tối thiểu từ 6 ký tự trở lên.');
      return;
    }

    if (isRegister && !trimmedName) {
      setError('Vui lòng nhập họ và tên của bạn.');
      return;
    }

    setLoading(true);

    try {
      if (isRegister) {
        const res = await api.register(trimmedName, trimmedEmail, trimmedPassword, trimmedSchool);
        localStorage.setItem('aurastudy_token', res.access_token);
        localStorage.setItem('aurastudy_user', JSON.stringify(res.user));
        localStorage.removeItem('aurastudy_logged_out');
        setSuccessMsg('Đăng ký tài khoản thành công! ');
        setTimeout(() => {
          onSuccess(res.user);
          onClose();
        }, 700);
      } else {
        const res = await api.login(trimmedEmail, trimmedPassword);
        localStorage.setItem('aurastudy_token', res.access_token);
        localStorage.setItem('aurastudy_user', JSON.stringify(res.user));
        localStorage.removeItem('aurastudy_logged_out');
        setSuccessMsg('Đăng nhập thành công ');
        setTimeout(() => {
          onSuccess(res.user);
          onClose();
        }, 600);
      }
    } catch (err: any) {
      setError(err?.message || 'Có lỗi xảy ra, vui lòng kiểm tra lại thông tin.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="auth-modal-backdrop" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div id="auth-modal-container" className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 sm:p-8 relative animate-in fade-in zoom-in-95 duration-200">
        
        {/* Close Button */}
        <button
          id="close-auth-modal-btn"
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          title="Đóng cửa sổ"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center space-x-3 mb-5 pr-8">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-md shadow-blue-200 shrink-0">
            <img src="/assets/Logo_light.png" alt="" aria-hidden="true" className="h-8 w-8 rounded object-cover" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-1.5">
              AuraStudy <Sparkles className="w-4 h-4 text-amber-500 fill-amber-400" />
            </h2>
            <p className="text-xs text-slate-500">
              {isRegister ? 'Đăng ký tài khoản học tập ' : 'Đăng nhập hệ thống '}
            </p>
          </div>
        </div>

        {/* Google One-Click Login */}
        <div className="mb-4">
          <button
            id="auth-google-btn"
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading || loading}
            className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-medium text-sm rounded-xl shadow-xs flex items-center justify-center gap-2.5 transition-all cursor-pointer disabled:opacity-50"
          >
            {googleLoading ? (
              <span className="inline-block w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></span>
            ) : (
              <LogIn className="w-4 h-4 text-blue-600" />
            )}
            <span>Đăng nhập nhanh với Google</span>
          </button>
        </div>

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200"></div>
          </div>
          <div className="relative flex justify-center text-xs text-slate-400">
            <span className="bg-white px-2">hoặc bằng tài khoản email</span>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-xl flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Họ và tên <span className="text-rose-500">*</span>
                </label>
                <input
                  id="auth-name-input"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ví dụ: Nguyễn Văn A"
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Trường đại học / Cao đẳng
                </label>
                <input
                  id="auth-school-input"
                  type="text"
                  value={school}
                  onChange={(e) => setSchool(e.target.value)}
                  placeholder="Ví dụ: ĐH Bách Khoa, ĐH Phenikaa..."
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Email học tập <span className="text-rose-500">*</span>
            </label>
            <input
              id="auth-email-input"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tenban@email.com"
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Mật khẩu <span className="text-rose-500">*</span>
            </label>
            <input
              id="auth-password-input"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Nhập mật khẩu (tối thiểu 6 ký tự)"
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <button
            id="auth-submit-btn"
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white font-medium text-sm rounded-xl shadow-md shadow-blue-100 flex items-center justify-center gap-2 transition-all cursor-pointer mt-2"
          >
            {loading ? (
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            ) : isRegister ? (
              <>
                <UserPlus className="w-4 h-4" /> Đăng ký tài khoản
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4" /> Đăng nhập
              </>
            )}
          </button>
        </form>

        {/* Toggle Mode */}
        <div className="mt-5 pt-4 border-t border-slate-100 text-center text-xs text-slate-500">
          {isRegister ? (
            <p>
              Đã có tài khoản?{' '}
              <button
                id="switch-to-login-btn"
                type="button"
                onClick={() => handleSwitchMode(false)}
                className="text-blue-600 hover:text-blue-700 font-semibold cursor-pointer"
              >
                Đăng nhập ngay
              </button>
            </p>
          ) : (
            <p>
              Chưa có tài khoản?{' '}
              <button
                id="switch-to-register-btn"
                type="button"
                onClick={() => handleSwitchMode(true)}
                className="text-blue-600 hover:text-blue-700 font-semibold cursor-pointer"
              >
                Tạo tài khoản mới
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
