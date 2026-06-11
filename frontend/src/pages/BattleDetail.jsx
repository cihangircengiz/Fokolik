import { useState, useEffect, useContext } from "react";
import { useParams, Link } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { API_BASE_URL } from "../services/api";

export default function BattleDetail({ userBalance, setUserBalance }) {
  const { token, refreshUserBalance } = useContext(AuthContext);
  const { inviteCode } = useParams();
  const [battle, setBattle] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Oynama (Bahis) stateleri
  const [selections, setSelections] = useState({});
  const [betAmount, setBetAmount] = useState("");
  const [joinError, setJoinError] = useState("");
  const [joinSuccess, setJoinSuccess] = useState(false);

  useEffect(() => {
    fetchBattle();
  }, [inviteCode]);

  const fetchBattle = async () => {
    try {
      const headers = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      const res = await fetch(`${API_BASE_URL}/battles/${inviteCode}`, { headers });
      if (!res.ok) throw new Error("Düello yüklenirken bir hata oluştu");
      const data = await res.json();
      setBattle(data);
    } catch (err) {
      console.error(err);
      setBattle(null);
    } finally {
      setLoading(false);
    }
  };

  const handleOddClick = (matchId, odd) => {
    if (battle?.status !== 'active') return;
    setSelections(prev => ({
      ...prev,
      [matchId]: odd
    }));
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    setJoinError("");
    setJoinSuccess(false);

    if (Object.keys(selections).length !== battle.matches.length) {
      setJoinError("Tüm maçlar için bir tahmin yapmalısınız.");
      return;
    }
    
    const amount = parseFloat(betAmount);
    if (isNaN(amount) || amount <= 0) {
      setJoinError("Geçerli bir tutar girin.");
      return;
    }

    try {
      const oddIds = Object.values(selections).map(odd => odd.id);
      const res = await fetch(`${API_BASE_URL}/battles/${inviteCode}/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          odd_ids: oddIds,
          amount: amount
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Bir hata oluştu");
      }
      setJoinSuccess(true);
      setSelections({});
      setBetAmount("");
      
      // Bakiyeyi düş/güncelle
      if (setUserBalance) {
        setUserBalance(prev => prev - amount);
      }
      refreshUserBalance();
      
      // Yenile
      fetchBattle();
    } catch (err) {
      setJoinError(err.message || "Bir hata oluştu");
    }
  };

  if (loading) return <div className="text-slate-800 dark:text-white text-center py-12 animate-pulse">Yükleniyor...</div>;
  if (!battle) return <div className="text-rose-600 dark:text-red-400 text-center py-12">Düello bulunamadı.</div>;

  // Toplam Oran Hesaplama
  const currentTotalOdd = Object.values(selections).reduce((acc, odd) => acc * odd.odd_value, 1.0);

  // Bu düellonun oynanabilir durumda olup olmadığı kontrolü
  let canJoin = battle.status === 'active';
  
  return (
    <div className="space-y-8 animate-fade-in pb-12 px-4">
      {/* Başlık Alanı */}
      <div className="bg-white dark:bg-slate-900/40 p-6 rounded-2xl border border-slate-200 dark:border-slate-700/50 backdrop-blur-md transition-colors duration-200">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-3">
              Düello Alanı
              {battle.status === 'completed' && <span className="text-sm bg-rose-500/10 text-rose-600 dark:text-rose-400 px-3 py-1 rounded-full border border-rose-500/30">Sona Erdi</span>}
            </h1>
            <p className="text-slate-500 dark:text-slate-400">
              Kurucu: <Link to={`/users/${battle.creator_username}`} className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 hover:underline">{battle.creator_username}</Link> • Davet Kodu: <span className="font-mono text-slate-800 dark:text-white font-bold">{battle.invite_code}</span>
            </p>
          </div>
          <div className="text-left sm:text-right">
            <div className="text-sm text-slate-500 dark:text-slate-400 mb-1">Katılımcı</div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {battle.participants.length} {battle.max_participants ? `/ ${battle.max_participants}` : ''}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Sol Taraf: Maçlar ve Bahis Yapma */}
        <div className="xl:col-span-2 space-y-6">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span className="text-indigo-505">⚔️</span> Zorunlu Maçlar
          </h2>
          
          <div className="grid gap-4">
            {battle.matches.map(match => {
              const isSelected = (oddId) => selections[match.id]?.id === oddId;
              
              return (
                <div key={match.id} className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700/50 rounded-2xl p-5 backdrop-blur-md transition-colors duration-200">
                  <div className="flex justify-between items-center mb-4">
                    <div className="text-slate-950 dark:text-white font-bold">{match.home_team} - {match.away_team}</div>
                    <div className="text-sm text-slate-550 dark:text-slate-400">{new Date(match.start_date).toLocaleString('tr-TR')}</div>
                  </div>
                  
                  {/* Oranlar */}
                  <div className="flex flex-wrap gap-2">
                    {match.odds.map(odd => (
                      <button
                        key={odd.id}
                        disabled={!canJoin}
                        onClick={() => handleOddClick(match.id, odd)}
                        className={`flex-1 min-w-[80px] py-2 px-3 rounded-xl border transition-all ${
                          isSelected(odd.id) 
                            ? 'bg-indigo-600 border-indigo-550 text-white shadow-md shadow-indigo-900/20' 
                            : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-indigo-500 dark:hover:border-indigo-400 hover:text-slate-900 dark:hover:text-white'
                        } ${!canJoin ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <div className="text-xs text-slate-550 dark:text-slate-400 mb-1">{odd.bet_type}</div>
                        <div className="font-bold">{odd.odd_value.toFixed(2)}</div>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bahis Yap Kutusu */}
          {canJoin && (
            <div className="bg-gradient-to-r from-indigo-50 to-slate-50 dark:from-indigo-950/20 dark:to-slate-900/20 border border-indigo-200 dark:border-indigo-900/30 rounded-2xl p-6 backdrop-blur-md transition-colors duration-200">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Düelloya Katıl (Yeni Kupon)</h3>
              
              <div className="flex flex-wrap items-end gap-4">
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-sm text-slate-550 dark:text-slate-400 mb-2">Yatırılacak Tutar (Coin)</label>
                  <input 
                    type="number"
                    value={betAmount}
                    onChange={(e) => setBetAmount(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900/60 border border-slate-250 dark:border-slate-600 text-slate-900 dark:text-white px-4 py-3 rounded-xl focus:outline-none focus:border-indigo-500 transition-colors"
                    placeholder="Örn: 100"
                  />
                </div>
                
                <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-xl px-6 py-3 min-w-[150px] transition-colors duration-200">
                  <div className="text-sm text-slate-500 dark:text-slate-400">Toplam Oran</div>
                  <div className="text-2xl font-bold text-yellow-650 dark:text-yellow-400">{currentTotalOdd.toFixed(2)}</div>
                </div>
                
                <button 
                  onClick={handleJoin}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 px-8 rounded-xl transition-colors shadow-lg shadow-indigo-500/20 cursor-pointer"
                >
                  Savaşa Katıl
                </button>
              </div>
              
              {joinError && <div className="mt-4 text-rose-600 dark:text-red-400 text-sm bg-rose-50 dark:bg-red-900/20 p-3 rounded-lg border border-rose-200 dark:border-red-500/30">{joinError}</div>}
              {joinSuccess && <div className="mt-4 text-emerald-600 dark:text-green-400 text-sm bg-emerald-50 dark:bg-green-900/20 p-3 rounded-lg border border-emerald-200 dark:border-green-500/30">Başarıyla katıldınız! Şeffaflık panosundan diğerleriyle birlikte kuponunuzu görebilirsiniz. Başka bir kupon daha yapabilirsiniz.</div>}
            </div>
          )}
        </div>

        {/* Sağ Taraf: Şeffaflık Panosu (Katılımcılar) */}
        <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700/50 rounded-2xl p-6 backdrop-blur-md self-start sticky top-6 transition-colors duration-200">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
            <span className="text-yellow-400">👁️</span> Şeffaflık Panosu
          </h2>
          
          <div className="space-y-4 max-h-[800px] overflow-y-auto pr-2 custom-scrollbar">
            {battle.participants.length === 0 ? (
              <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                Henüz kimse katılmamış. İlk kanı sen dök!
              </div>
            ) : (
              battle.participants.map(p => (
                <div key={p.id} className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/50 rounded-xl p-4">
                  <div className="flex justify-between items-center mb-3 border-b border-slate-200 dark:border-slate-700/50 pb-2">
                    <Link to={`/users/${p.username}`} className="font-bold text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                      {p.username}
                    </Link>
                    <div className="text-yellow-600 dark:text-yellow-400 font-bold bg-yellow-500/10 px-2 py-0.5 rounded text-sm">
                      Oran: {p.slip?.total_odd?.toFixed(2)}
                    </div>
                  </div>
                  
                  {/* Tahminler */}
                  <div className="space-y-2">
                    {p.slip?.selections?.map(sel => (
                      <div key={sel.id} className="flex justify-between items-center text-xs">
                        <div className="text-slate-500 dark:text-slate-400 truncate pr-2">
                          {sel.odd_details?.home_team} - {sel.odd_details?.away_team}
                        </div>
                        <div className="font-mono text-slate-650 dark:text-gray-300 whitespace-nowrap bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                          {sel.odd_details?.bet_type} ({sel.odd_details?.odd_value})
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Kupon Durumu ve Puanı */}
                  <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700/50 flex justify-between items-center text-sm">
                    <div className="text-slate-500 dark:text-slate-400">
                      Tutar: <span className="text-slate-850 dark:text-white font-bold">{p.slip?.amount}</span>
                    </div>
                    {battle.status === 'completed' ? (
                      <div className={`font-bold ${p.earned_points > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-red-400'}`}>
                        {p.earned_points > 0 ? `+${p.earned_points} Puan!` : 'Kaybetti'}
                      </div>
                    ) : (
                      <div className="text-slate-400 dark:text-gray-500">Bekliyor...</div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
