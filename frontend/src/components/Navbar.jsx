import React, { useContext, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Coins, LogOut, User, Sun, Moon } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import AuthModal from './AuthModal';

export default function Navbar() {
  const { user, logout } = useContext(AuthContext);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState('login');

  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      if (saved) return saved;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const openLogin = () => { setAuthModalTab('login'); setAuthModalOpen(true); };
  const openRegister = () => { setAuthModalTab('register'); setAuthModalOpen(true); };

  return (
    <>
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm sticky top-0 z-50 transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-2xl font-black tracking-wider bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 bg-clip-text text-transparent">
              FOKOLİK
            </span>
            <span className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 font-mono hidden sm:block transition-colors duration-200">
              PARLAY V3
            </span>
          </Link>

          <div className="flex items-center gap-2 sm:gap-4">
            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700 cursor-pointer"
              title={theme === 'dark' ? 'Açık Tema' : 'Karanlık Tema'}
            >
              {theme === 'dark' ? <Sun className="w-5 h-5 text-amber-500" /> : <Moon className="w-5 h-5 text-indigo-500" />}
            </button>

            {user ? (
              <div className="flex items-center gap-2 sm:gap-4">
                {/* Balance Card */}
                <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg shadow-sm transition-colors duration-200">
                  <Coins className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {(user.coin_balance ?? user.balance ?? 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 hidden sm:inline">Coin</span>
                </div>
                
                {/* Profile Link */}
                <Link to="/profile" className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-slate-700 dark:text-slate-300 font-medium border border-transparent hover:border-slate-200 dark:hover:border-slate-800">
                  <User className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
                  <span className="hidden sm:inline">Profilim</span>
                </Link>

                <button 
                  onClick={logout}
                  className="p-2 hover:bg-red-50 dark:hover:bg-red-950/30 text-slate-500 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400 rounded-lg transition-colors border border-transparent hover:border-red-100 dark:hover:border-red-900/50 cursor-pointer"
                  title="Çıkış Yap"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={openLogin}
                  className="text-slate-600 dark:text-slate-300 font-medium hover:text-indigo-600 dark:hover:text-indigo-400 px-3 py-2 transition-colors cursor-pointer"
                >
                  Giriş Yap
                </button>
                <button
                  onClick={openRegister}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm px-4 py-2 rounded-lg shadow-md transition-colors cursor-pointer"
                >
                  Kayıt Ol
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialTab={authModalTab}
      />
    </>
  );
}
