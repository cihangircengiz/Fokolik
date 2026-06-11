import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Profile from './pages/Profile';

function App() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans selection:bg-indigo-100 selection:text-indigo-900 transition-colors duration-200">
      <Navbar />
      <main className="flex-1 w-full">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/profile" element={<Profile />} />
        </Routes>
      </main>
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-6 text-center text-xs text-slate-500 dark:text-slate-400 mt-auto transition-colors duration-200">
        <p>© 2026 Fokolik Futbol Bahis Simülasyonu. Tüm hakları saklıdır.</p>
        <p className="mt-1 text-slate-400 dark:text-slate-500">Bu bir simülasyon oyunudur, gerçek para kullanılmaz.</p>
      </footer>
    </div>
  );
}

export default App;
