import { useState, useEffect, useContext } from "react";
import { useParams } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { API_BASE_URL } from "../services/api";

export default function UserProfile() {
  const { username } = useParams();
  const { token } = useContext(AuthContext);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProfile();
  }, [username, token]);

  const fetchProfile = async () => {
    try {
      const headers = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      const res = await fetch(`${API_BASE_URL}/users/${username}/profile`, { headers });
      if (!res.ok) throw new Error("Kullanıcı profili yüklenirken bir hata oluştu");
      const data = await res.json();
      setProfile(data);
    } catch (err) {
      console.error(err);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-slate-650 dark:text-white text-center py-12 font-semibold animate-pulse">Yükleniyor...</div>;
  if (!profile) return <div className="text-rose-600 dark:text-red-450 text-center py-12 font-bold">Kullanıcı bulunamadı.</div>;

  return (
    <div className="space-y-8 animate-fade-in pb-12 max-w-4xl mx-auto px-4">
      {/* Profil Başlığı */}
      <div className="bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900/80 dark:to-slate-950/80 p-8 rounded-3xl border border-slate-200 dark:border-slate-850 shadow-sm flex flex-col sm:flex-row items-center gap-8 transition-colors duration-200">
        <div className="w-24 h-24 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 p-1 shadow-md shadow-indigo-500/20 flex-shrink-0 flex items-center justify-center text-4xl">
          <div className="w-full h-full bg-slate-100 dark:bg-slate-900 rounded-full flex items-center justify-center">
            😎
          </div>
        </div>
        <div className="flex-1 text-center sm:text-left">
          <h1 className="text-4xl font-black text-slate-900 dark:text-transparent dark:bg-clip-text dark:bg-gradient-to-r dark:from-white dark:to-gray-400 mb-4 sm:mb-2">
            {profile.username}
          </h1>
          <div className="flex flex-wrap justify-center sm:justify-start gap-4">
            <div className="bg-slate-50 dark:bg-slate-900/50 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800/50 min-w-[120px]">
              <div className="text-xs text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider font-bold">İtibar Puanı</div>
              <div className="text-xl font-bold text-yellow-600 dark:text-yellow-400 flex items-center justify-center sm:justify-start gap-2">
                👑 {profile.reputation}
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900/50 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800/50 min-w-[120px]">
              <div className="text-xs text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider font-bold">Servet (Coin)</div>
              <div className="text-xl font-bold text-emerald-600 dark:text-green-400 flex items-center justify-center sm:justify-start gap-2">
                💰 {profile.coin_balance.toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Geçmiş Kuponlar */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
          <span className="text-indigo-500">📜</span> Son Kupon Hareketleri
        </h2>
        
        {profile.slips.length === 0 ? (
          <div className="text-center py-12 text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900/20 rounded-2xl border border-slate-200 dark:border-slate-800/50">
            Kullanıcının henüz bir kupon geçmişi yok.
          </div>
        ) : (
          <div className="space-y-4">
            {profile.slips.map(slip => (
              <div key={slip.id} className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700/50 rounded-2xl p-5 backdrop-blur-md transition-all hover:bg-slate-50 dark:hover:bg-slate-800/60 duration-200">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4 border-b border-slate-200 dark:border-slate-700/50 pb-3 gap-2">
                  <div className="flex items-center gap-4">
                    <span className="text-slate-500 dark:text-gray-400 text-sm">{new Date(slip.created_at).toLocaleString('tr-TR')}</span>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      slip.status === 'won' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30' : 
                      slip.status === 'lost' ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30' : 
                      'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                    }`}>
                      {slip.status === 'won' ? 'KAZANDI' : slip.status === 'lost' ? 'KAYBETTİ' : 'BEKLİYOR'}
                    </span>
                  </div>
                  <div className="text-left sm:text-right">
                    <div className="text-xs text-slate-500 dark:text-slate-400">Yatırılan / Toplam Oran</div>
                    <div className="font-bold text-slate-900 dark:text-white">{slip.amount} Coin / <span className="text-yellow-600 dark:text-yellow-400">{slip.total_odd.toFixed(2)}</span></div>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {slip.selections.map(sel => (
                    <div key={sel.id} className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-3 flex justify-between items-center border border-slate-200 dark:border-slate-800">
                      <div className="truncate pr-4 text-sm text-slate-700 dark:text-slate-300 flex items-center gap-2">
                        <span>{sel.odd_details?.home_team || "Bilinmeyen Takım"} - {sel.odd_details?.away_team || "Bilinmeyen Takım"}</span>
                        {sel.odd_details?.match_status !== 'not_started' && (
                          <span className="text-xs font-mono font-bold text-slate-500 bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                            {sel.odd_details?.home_score} - {sel.odd_details?.away_score}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-slate-200 dark:bg-slate-800 px-2 py-1 rounded text-slate-650 dark:text-slate-400">{sel.odd_details?.bet_type || "MS"}</span>
                        
                        {sel.status === "won" && (
                          <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold rounded">Kazandı</span>
                        )}
                        {sel.status === "lost" && (
                          <span className="px-2 py-0.5 bg-rose-100 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-400 text-[10px] font-bold rounded">Kaybetti</span>
                        )}
                        {sel.status === "void" && (
                          <span className="px-2 py-0.5 bg-orange-100 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900/50 text-orange-700 dark:text-orange-400 text-[10px] font-bold rounded">İade</span>
                        )}
                        {sel.status === "pending" && (
                          <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-[10px] font-bold rounded">Bekliyor</span>
                        )}

                        <span className={`font-mono font-bold ${sel.status === 'void' ? 'line-through text-slate-400 dark:text-slate-600' : 'text-indigo-600 dark:text-indigo-400'}`}>
                          {(sel.odd_value ?? sel.odd_details?.odd_value ?? 1.0).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
