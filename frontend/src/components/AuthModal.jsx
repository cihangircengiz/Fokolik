import React, { useState, useContext, useEffect } from 'react';
import { AuthContext } from '../context/AuthContext';
import { LogIn, UserPlus, X, Eye, EyeOff } from 'lucide-react';

export default function AuthModal({ isOpen, onClose, initialTab = 'login' }) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login, register } = useContext(AuthContext);

  // Reset form when modal opens or tab changes
  useEffect(() => {
    setUsername('');
    setPassword('');
    setShowPassword(false);
    setLoading(false);
  }, [isOpen, activeTab]);

  // Sync initialTab when prop changes
  useEffect(() => {
    if (isOpen) setActiveTab(initialTab);
  }, [initialTab, isOpen]);

  if (!isOpen) return null;

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    const success = await login(username, password);
    setLoading(false);
    if (success) onClose();
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    const success = await register(username, password);
    if (success) {
      // Auto-login after successful registration
      const loginSuccess = await login(username, password);
      setLoading(false);
      if (loginSuccess) onClose();
    } else {
      setLoading(false);
    }
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 dark:bg-black/70 backdrop-blur-sm animate-fade-in"
      onClick={handleOverlayClick}
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-scale-in border border-slate-100 dark:border-slate-800 transition-colors duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-2">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
            {activeTab === 'login' ? 'Hoş Geldiniz' : 'Hesap Oluştur'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-805 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex mx-6 mt-3 bg-slate-100 dark:bg-slate-800 rounded-xl p-1 transition-colors duration-200">
          <button
            type="button"
            onClick={() => setActiveTab('login')}
            className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'login'
                ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <LogIn size={16} /> Giriş Yap
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('register')}
            className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'register'
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <UserPlus size={16} /> Kayıt Ol
          </button>
        </div>

        {/* Form */}
        <form
          onSubmit={activeTab === 'login' ? handleLogin : handleRegister}
          className="p-6 pt-5 space-y-4"
        >
          <div>
            <label className="block text-sm font-semibold text-slate-600 dark:text-slate-300 mb-1.5">Kullanıcı Adı</label>
            <input
              type="text"
              required
              minLength={3}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400 dark:focus:ring-emerald-500 focus:border-transparent transition-all text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
              placeholder={activeTab === 'login' ? 'Kullanıcı adınız' : 'Benzersiz bir isim seçin'}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-600 dark:text-slate-300 mb-1.5">Şifre</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={4}
                className="w-full px-4 py-3 pr-12 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400 dark:focus:ring-emerald-500 focus:border-transparent transition-all text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                placeholder={activeTab === 'login' ? 'Şifreniz' : 'Güvenli bir şifre belirleyin'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 font-bold rounded-xl shadow-md transition-all active:scale-[0.98] disabled:opacity-60 flex justify-center items-center gap-2 text-white cursor-pointer ${
              activeTab === 'login'
                ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200 dark:shadow-none'
                : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200 dark:shadow-none'
            }`}
          >
            {loading
              ? (activeTab === 'login' ? 'Giriş yapılıyor...' : 'Kaydediliyor...')
              : (activeTab === 'login' ? 'Giriş Yap' : 'Kayıt Ol')
            }
          </button>

          {activeTab === 'register' && (
            <p className="text-xs text-center text-slate-400 dark:text-slate-500 mt-2">
              Kayıt olduğunuzda <span className="font-bold text-emerald-600 dark:text-emerald-400">10.000 Coin</span> bakiye hediye edilir!
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
