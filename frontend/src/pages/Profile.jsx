import React, { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { Receipt, ChevronDown, ChevronUp, AlertCircle, Coins, Clock, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

export default function Profile() {
  const { user, token, refreshUserBalance } = useContext(AuthContext);
  const [slips, setSlips] = useState([]);
  const [activeHistoryTab, setActiveHistoryTab] = useState("all");
  const [expandedSlips, setExpandedSlips] = useState({});
  const [loading, setLoading] = useState(true);

  const fetchSlips = async () => {
    if (!token) return;
    try {
      const res = await fetch(`http://localhost:8000/slips/my_slips`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setSlips(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSlips();
    refreshUserBalance();
  }, [token]);

  const handleCancelSlip = async (slipId) => {
    if (!window.confirm(`Kupon #${slipId} iptal edilecek, onaylıyor musunuz?`)) return;

    try {
      const res = await fetch(`http://localhost:8000/slips/${slipId}/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        toast.success("Kupon başarıyla iptal edildi!");
        fetchSlips();
        refreshUserBalance();
      } else {
        const errData = await res.json();
        toast.error(errData.detail || "İptal işlemi başarısız.");
      }
    } catch (error) {
      toast.error("Bir hata oluştu.");
    }
  };

  const isSlipCancelable = (slip) => {
    if (slip.status !== "pending") return false;
    const now = new Date();
    return slip.selections.every((sel) => {
      if (!sel.odd_details) return false;
      return new Date(sel.odd_details.start_date) > now;
    });
  };

  const toggleAccordion = (slipId) => {
    setExpandedSlips(prev => ({ ...prev, [slipId]: !prev[slipId] }));
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  };

  const filteredSlips = slips.filter(slip => {
    if (activeHistoryTab === "all") return true;
    return slip.status === activeHistoryTab;
  });

  if (!user) return <div className="text-center py-20 text-slate-500 dark:text-slate-400">Lütfen giriş yapın.</div>;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Back to Home Button */}
      <div className="mb-6">
        <Link 
          to="/" 
          className="inline-flex items-center gap-2 text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors"
        >
          <ArrowLeft size={16} /> Ana Sayfaya Dön
        </Link>
      </div>

       {/* Profile Header */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 mb-8 flex flex-col md:flex-row items-center justify-between gap-4 transition-colors duration-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Profilim</h1>
          <p className="text-slate-500 dark:text-slate-400">Hoş geldiniz, <span className="font-semibold text-slate-700 dark:text-slate-300">@{user.username}</span></p>
        </div>
        <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/50 p-4 rounded-xl flex items-center gap-4 transition-colors duration-200">
          <div className="p-3 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 rounded-full">
            <Coins size={28} />
          </div>
          <div>
            <span className="text-sm font-semibold text-emerald-800 dark:text-emerald-300 block">Mevcut Bakiye</span>
            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 font-mono">
              {(user.coin_balance ?? user.balance ?? 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      {/* Slips History */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 transition-colors duration-200">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-4 gap-4">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Receipt className="w-6 h-6 text-indigo-500 dark:text-indigo-400" />
            Kupon Geçmişim
          </h2>
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg transition-colors duration-200">
            {[
              { id: "all", label: "Tümü" },
              { id: "pending", label: "Bekleyen" },
              { id: "won", label: "Kazanan" },
              { id: "lost", label: "Kaybeden" },
              { id: "cancelled", label: "İptal" }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveHistoryTab(tab.id)}
                className={`px-3 py-1.5 sm:px-4 rounded-md text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                  activeHistoryTab === tab.id
                    ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-400 dark:text-slate-500">Yükleniyor...</div>
        ) : filteredSlips.length === 0 ? (
          <div className="py-12 text-center flex flex-col items-center">
            <AlertCircle className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-3" />
            <p className="text-slate-500 dark:text-slate-400">Bu kategoriye ait kupon bulunmuyor.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {filteredSlips.map(slip => {
              const isExpanded = !!expandedSlips[slip.id];
              const cancelable = isSlipCancelable(slip);
              const winnings = (slip.amount * slip.total_odd).toFixed(2);

              return (
                <div key={slip.id} className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 bg-white dark:bg-slate-900">
                  {/* Header */}
                  <div className="bg-slate-50 dark:bg-slate-800 p-4 flex flex-col md:flex-row items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 transition-colors duration-200">
                    <div className="flex items-center gap-4 w-full md:w-auto">
                      <button onClick={() => toggleAccordion(slip.id)} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-slate-500 dark:text-slate-400 transition-colors cursor-pointer">
                        {isExpanded ? <ChevronUp size={20}/> : <ChevronDown size={20}/>}
                      </button>
                      <div>
                        <span className="font-mono font-bold text-slate-700 dark:text-slate-300 text-sm block">KUPON #{slip.id}</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">{formatDate(slip.created_at)}</span>
                      </div>
                      <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 rounded text-xs text-indigo-600 dark:text-indigo-400 font-bold ml-auto md:ml-0 transition-colors duration-200">
                        {slip.selections.length} Seçim
                      </span>
                    </div>

                    <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end">
                      <div className="flex items-center gap-4 text-xs font-mono text-slate-600 dark:text-slate-400">
                        <div>
                          <span className="text-[10px] uppercase block text-slate-400 dark:text-slate-550">Tutar</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">{slip.amount}</span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase block text-slate-400 dark:text-slate-550">Oran</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">{slip.total_odd.toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase block text-emerald-500 dark:text-emerald-400">Kazanç</span>
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">{winnings}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {slip.status === "pending" && <span className="px-2 py-1 bg-amber-100 dark:bg-amber-950/35 text-amber-700 dark:text-amber-400 text-xs font-bold rounded-md flex items-center gap-1 transition-colors duration-200"><Clock size={12}/> Bekliyor</span>}
                        {slip.status === "won" && <span className="px-2 py-1 bg-emerald-100 dark:bg-emerald-950/35 text-emerald-700 dark:text-emerald-400 text-xs font-bold rounded-md transition-colors duration-200">Kazandı</span>}
                        {slip.status === "lost" && <span className="px-2 py-1 bg-red-100 dark:bg-red-950/35 text-red-700 dark:text-red-400 text-xs font-bold rounded-md transition-colors duration-200">Kaybetti</span>}
                        {slip.status === "cancelled" && <span className="px-2 py-1 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-bold rounded-md transition-colors duration-200">İptal</span>}

                        {cancelable && (
                          <button 
                            onClick={() => handleCancelSlip(slip.id)}
                            className="ml-2 text-xs font-bold px-3 py-1.5 bg-white dark:bg-slate-800 border border-red-200 dark:border-red-900/50 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/35 rounded-lg transition-colors cursor-pointer"
                          >
                            İptal Et
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Selections Details */}
                  {isExpanded && (
                    <div className="bg-white dark:bg-slate-900/50 p-4 flex flex-col gap-2 transition-colors duration-200">
                      {slip.selections.map(sel => {
                        const d = sel.odd_details;
                        return (
                          <div key={sel.id} className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2 last:border-0 last:pb-0 transition-colors duration-200">
                            <div>
                              <div className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
                                {d?.home_team} - {d?.away_team}
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                                <span>{formatDate(d?.start_date)}</span>
                                {d?.match_status !== 'not_started' && d?.match_status !== 'finished' && (
                                  <span className="text-red-500 dark:text-red-400 font-bold">{d.minute}</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded transition-colors duration-200">{d?.bet_type}</span>
                              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">@{d?.odd_value.toFixed(2)}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
