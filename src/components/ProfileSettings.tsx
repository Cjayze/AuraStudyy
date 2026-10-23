import React, { useRef, useState } from 'react';
import { Camera, ChevronDown, Globe2, UserRound, X } from 'lucide-react';
import type { User } from '../types';
import type { Language } from '../i18n';
import { api } from '../services/api';

interface ProfileSettingsProps {
  user: User;
  language: Language;
  onLanguageChange: (language: Language) => void;
  onProfileUpdated: (user: User) => void;
  onLogout: () => void;
}

async function optimizeAvatar(file: File): Promise<File> {
  const sourceUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = sourceUrl;
    await image.decode();
    const scale = Math.min(1, 512 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(result => result ? resolve(result) : reject(new Error('Could not process this image.')), 'image/jpeg', 0.82));
    return new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

export const ProfileSettings: React.FC<ProfileSettingsProps> = ({ user, language, onLanguageChange, onProfileUpdated, onLogout }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user.name || '');
  const [preview, setPreview] = useState(user.avatar_url || '');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const en = language === 'en';

  const chooseAvatar = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError(en ? 'Choose an image file.' : 'Vui lòng chọn tệp hình ảnh.');
      return;
    }
    setAvatarFile(file);
    setPreview(URL.createObjectURL(file));
    setError('');
  };

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      let avatarUrl = user.avatar_url || '';
      if (avatarFile) avatarUrl = (await api.uploadAvatar(await optimizeAvatar(avatarFile))).avatar_url;
      const updated = await api.updateProfile({ name, avatar_url: avatarUrl });
      onProfileUpdated(updated);
      setAvatarFile(null);
      setEditing(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : (en ? 'Could not save profile.' : 'Không thể lưu hồ sơ.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative">
      <button type="button" onClick={() => setMenuOpen(value => !value)} aria-expanded={menuOpen} aria-label={en ? 'Account menu' : 'Menu tài khoản'} className="flex items-center gap-2 rounded-xl border border-slate-200/70 bg-slate-50 px-2.5 py-1.5 text-left hover:bg-slate-100">
        {user.avatar_url ? <img src={user.avatar_url} alt="" className="h-8 w-8 rounded-lg object-cover" /> : <span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-100 text-xs font-bold text-blue-700">{user.name?.charAt(0).toUpperCase() || 'U'}</span>}
        <span className="hidden max-w-36 sm:block"><span className="block truncate text-xs font-semibold text-slate-800">{user.name}</span><span className="block truncate text-[10px] text-slate-500">{user.email}</span></span>
        <ChevronDown className="h-4 w-4 text-slate-500" />
      </button>

      {menuOpen && <div className="absolute right-0 top-full z-40 mt-2 w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
        <div className="border-b border-slate-100 px-3 py-2"><p className="truncate text-sm font-semibold text-slate-900">{user.name}</p><p className="truncate text-xs text-slate-500">{user.email}</p></div>
        <button type="button" onClick={() => { setName(user.name || ''); setPreview(user.avatar_url || ''); setEditing(true); setMenuOpen(false); setError(''); }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50"><UserRound className="h-4 w-4" />{en ? 'Edit profile' : 'Chỉnh sửa hồ sơ'}</button>
        <div className="px-3 py-2"><label className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-600"><Globe2 className="h-4 w-4" />{en ? 'Language' : 'Ngôn ngữ'}</label><div className="grid grid-cols-2 rounded-lg bg-slate-100 p-1"><button type="button" onClick={() => onLanguageChange('vi')} className={`rounded-md px-2 py-1.5 text-xs font-medium ${language === 'vi' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600'}`}>Tiếng Việt</button><button type="button" onClick={() => onLanguageChange('en')} className={`rounded-md px-2 py-1.5 text-xs font-medium ${language === 'en' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600'}`}>English</button></div></div>
        <button type="button" onClick={onLogout} className="mt-1 w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-rose-600 hover:bg-rose-50">{en ? 'Log out' : 'Đăng xuất'}</button>
      </div>}

      {editing && <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/50 p-4" onMouseDown={event => { if (event.target === event.currentTarget) setEditing(false); }}>
        <form onSubmit={saveProfile} className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
          <div className="mb-5 flex items-center justify-between"><h2 className="text-lg font-bold text-slate-900">{en ? 'Edit profile' : 'Chỉnh sửa hồ sơ'}</h2><button type="button" onClick={() => setEditing(false)} aria-label={en ? 'Close' : 'Đóng'} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"><X size={18}/></button></div>
          <div className="mb-5 flex flex-col items-center">
            <div className="relative"><div className="grid h-24 w-24 place-items-center overflow-hidden rounded-full bg-blue-50 text-2xl font-bold text-blue-700">{preview ? <img src={preview} alt="" className="h-full w-full object-cover" /> : (name.charAt(0).toUpperCase() || 'U')}</div><button type="button" onClick={() => fileRef.current?.click()} aria-label={en ? 'Change avatar' : 'Đổi ảnh đại diện'} className="absolute bottom-0 right-0 rounded-full bg-blue-600 p-2 text-white shadow-md hover:bg-blue-700"><Camera size={16}/></button></div>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={event => chooseAvatar(event.target.files?.[0])}/>
            <button type="button" onClick={() => fileRef.current?.click()} className="mt-2 text-sm font-medium text-blue-700 hover:text-blue-800">{en ? 'Change avatar' : 'Thay ảnh đại diện'}</button>
          </div>
          <label className="block text-sm font-medium text-slate-700">{en ? 'Full name' : 'Họ và tên'}<input autoComplete="name" required maxLength={100} value={name} onChange={event => setName(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"/></label>
          {error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
          <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setEditing(false)} className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100">{en ? 'Cancel' : 'Hủy'}</button><button type="submit" disabled={saving} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{saving ? (en ? 'Saving…' : 'Đang lưu…') : (en ? 'Save changes' : 'Lưu thay đổi')}</button></div>
        </form>
      </div>}
    </div>
  );
};
