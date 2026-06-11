import React from 'react';
import { AlertTriangle } from 'lucide-react';

export default function ConfirmModal({ isOpen, onClose, onConfirm, title, message, confirmText = "Onayla", cancelText = "Vazgeç", isDestructive = true }) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-sm border border-slate-200 dark:border-slate-800 overflow-hidden transform transition-all scale-100" onClick={e => e.stopPropagation()}>
                <div className="p-6">
                    <div className="flex justify-center mb-5">
                        <div className={`p-4 rounded-full ${isDestructive ? 'bg-red-100 dark:bg-red-900/30 text-red-500 dark:text-red-400' : 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-500 dark:text-indigo-400'}`}>
                            <AlertTriangle size={36} strokeWidth={1.5} />
                        </div>
                    </div>
                    <h3 className="text-xl font-bold text-center text-slate-800 dark:text-slate-100 mb-2">{title}</h3>
                    <p className="text-center text-slate-500 dark:text-slate-400 text-sm leading-relaxed mb-8">{message}</p>
                    <div className="flex gap-3">
                        <button 
                            onClick={(e) => { e.stopPropagation(); onClose(); }}
                            className="flex-1 py-3 rounded-xl font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                        >
                            {cancelText}
                        </button>
                        <button 
                            onClick={(e) => { e.stopPropagation(); onConfirm(); onClose(); }}
                            className={`flex-1 py-3 rounded-xl font-bold text-white transition-all cursor-pointer ${isDestructive ? 'bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/30' : 'bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-600/30'}`}
                        >
                            {confirmText}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
