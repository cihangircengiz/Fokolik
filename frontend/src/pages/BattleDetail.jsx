import { useState, useEffect, useContext } from "react";
import { useParams, Link } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { API_BASE_URL } from "../services/api";
import { ChevronDown, ChevronUp } from "lucide-react";

export default function BattleDetail({ userBalance, setUserBalance }) {
  const { user, token, refreshUserBalance } = useContext(AuthContext);
  const { inviteCode } = useParams();
  const [battle, setBattle] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Oynama (Bahis) stateleri
  const [selections, setSelections] = useState({});
  const [betAmount, setBetAmount] = useState("");
  const [joinError, setJoinError] = useState("");
  const [joinSuccess, setJoinSuccess] = useState(false);
  const [expandedMatches, setExpandedMatches] = useState({});

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
    
    const amount = 500;

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

  const myParticipants = battle?.participants?.filter(p => p.user_id === user?.id) || [];
  
  return (
    <div className="space-y-8 animate-fade-in pb-12 px-4">
      {/* Başlık Alanı */}
      <div className="bg-white dark:bg-slate-900/40 p-6 rounded-2xl border border-slate-200 dark:border-slate-700/50 backdrop-blur-md transition-colors duration-200">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-3">
              Düello Alanı
              {battle.status === 'completed' && <span className="text-sm bg-rose-500/10 text-rose-600 dark:text-rose-400 px-3 py-1 rounded-full border border-rose-500/30">Sona Erdi</span>}
              {battle.status === 'started' && <span className="text-sm bg-amber-500/10 text-amber-600 dark:text-amber-400 px-3 py-1 rounded-full border border-amber-500/30">Başladı</span>}
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
          
          <div className="flex flex-col gap-0 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm bg-white dark:bg-slate-900/40 backdrop-blur-md">
            {battle.matches.map(match => {
                const getOdd = (...types) => match.odds?.find(o => types.includes(o.bet_type));
                const ms1 = getOdd("MS 1");
                const ms0 = getOdd("MS 0");
                const ms2 = getOdd("MS 2");
                const iy1 = getOdd("İY 1", "IY 1");
                const iy0 = getOdd("İY 0", "IY 0");
                const iy2 = getOdd("İY 2", "IY 2");
                const alt25 = getOdd("2.5 Alt");
                const ust25 = getOdd("2.5 Üst");
                const kgVar = getOdd("KG Var");
                const kgYok = getOdd("KG Yok");
                const cs1x = getOdd("ÇŞ 1-X");
                const cs12 = getOdd("ÇŞ 1-2");
                const csx2 = getOdd("ÇŞ X-2");
                const alt15 = getOdd("1.5 Alt");
                const ust15 = getOdd("1.5 Üst");
                const alt35 = getOdd("3.5 Alt");
                const ust35 = getOdd("3.5 Üst");
                const iyAlt15 = getOdd("İY 1.5 Alt");
                const iyUst15 = getOdd("İY 1.5 Üst");
                const iyCs1x = getOdd("İY ÇŞ 1-X");
                const iyCs12 = getOdd("İY ÇŞ 1-2");
                const iyCsx2 = getOdd("İY ÇŞ X-2");
                const ev05Alt = getOdd("Ev 0.5 Alt");
                const ev05Ust = getOdd("Ev 0.5 Üst");
                const tg01 = getOdd("TG 0-1");
                const tg23 = getOdd("TG 2-3");
                const tg45 = getOdd("TG 4-5");
                const tg6plus = getOdd("TG 6+");

                const isSelected = (oddId) => {
                  return selections[match.id]?.id === oddId;
                };
                
                const renderOddBtn = (oddObj, label) => {
                    if (!oddObj) return <div className="w-[50px] text-center text-[11px] text-slate-500 bg-slate-50 dark:bg-[#1a2c27] rounded py-1.5 mx-[1px] border border-transparent">-</div>;
                    const selected = isSelected(oddObj.id);
                    const isDisabled = !canJoin;
                    return (
                        <button
                            disabled={isDisabled}
                            onClick={() => handleOddClick(match.id, oddObj)}
                            className={`w-[50px] px-1 py-1 rounded flex flex-col items-center justify-center gap-0.5 text-[11px] font-bold transition-all border mx-[1px] ${selected
                                ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                                : isDisabled
                                    ? "bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 border-slate-200 dark:border-slate-800 cursor-not-allowed"
                                    : "bg-white dark:bg-[#1a2c27] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-[#2a453d] hover:border-emerald-500 hover:text-emerald-500 cursor-pointer"
                                } ${isDisabled ? "cursor-not-allowed" : "cursor-pointer"}`}
                        >
                            <span className="text-[9px] opacity-75 font-normal leading-none">{label}</span>
                            <span className="leading-none">{oddObj.odd_value.toFixed(2)}</span>
                        </button>
                    );
                };

                const isExpanded = expandedMatches[match.id];
                const toggleExpand = () => setExpandedMatches(prev => ({ ...prev, [match.id]: !prev[match.id] }));
                const isPastStartTime = new Date(match.start_date) <= new Date();
                const isLiveOrFinished = match.status !== "not_started" || isPastStartTime;

                return (
                    <div key={match.id} className="group relative flex flex-col p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-b border-slate-200 dark:border-slate-700/50 last:border-0 min-w-0 w-full overflow-hidden">
                        <div className="flex flex-col xl:flex-row xl:items-center justify-between min-w-0 w-full">
                            {/* Sol/Orta Alan */}
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                {/* Saat ve Durum */}
                                <div className="flex items-center justify-center gap-2 w-[70px] shrink-0 border-r border-slate-200 dark:border-slate-700 pr-2 cursor-help" title={`Son Güncelleme: ${match.updated_at ? new Date(match.updated_at + "Z").toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : 'Bilinmiyor'}`}>
                                    {match.status !== "not_started" && match.status !== "finished" ? (
                                        <span className="text-red-500 dark:text-red-400 font-bold text-xs animate-pulse">
                                            {match.minute ? (['İY', 'MS', 'Devre'].some(k => match.minute.includes(k)) ? match.minute : `${match.minute}'`) : 'CANLI'}
                                        </span>
                                    ) : match.status === "finished" ? (
                                        <span className="text-slate-500 font-bold text-xs">MS</span>
                                    ) : isPastStartTime ? (
                                        <span className="text-orange-500 dark:text-orange-400 font-bold text-[11px] uppercase tracking-tighter leading-tight">Başladı</span>
                                    ) : (
                                        <span className="text-slate-600 dark:text-slate-400 font-semibold text-[13px]">
                                            {new Date(match.start_date).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                                        </span>
                                    )}
                                </div>

                                {/* Takımlar ve Skor */}
                                <div className="flex-1 flex items-center justify-start gap-3 min-w-0 pr-2 sm:pr-4">
                                    <div className="flex-1 text-right text-[12px] sm:text-[13px] font-bold truncate text-slate-800 dark:text-slate-200" title={match.home_team}>
                                        {match.home_team}
                                    </div>
                                    <div className="flex items-center justify-center w-10 sm:w-12 shrink-0 bg-slate-100 dark:bg-slate-800 rounded px-1 sm:px-2 py-0.5 border border-slate-200 dark:border-slate-700">
                                        {isLiveOrFinished ? (
                                            <div className="flex items-center gap-1 font-mono font-bold text-[12px] sm:text-[13px] text-slate-800 dark:text-slate-200">
                                                <span>{match.home_score}</span>
                                                <span className="text-slate-400">-</span>
                                                <span>{match.away_score}</span>
                                            </div>
                                        ) : (
                                            <span className="text-slate-400 dark:text-slate-500 font-bold text-xs">-</span>
                                        )}
                                    </div>
                                    <div className="flex-1 text-left text-[12px] sm:text-[13px] font-bold truncate text-slate-800 dark:text-slate-200" title={match.away_team}>
                                        {match.away_team}
                                    </div>
                                </div>
                            </div>

                            {/* Sağ Alan: Temel Oranlar (Sadece MS) */}
                            <div className="flex items-center justify-start xl:justify-end mt-3 xl:mt-0 overflow-x-auto no-scrollbar w-full xl:w-auto max-w-full">
                                <div className="flex items-center min-w-max pb-1">
                                    <div className="flex items-center pr-2">
                                        {renderOddBtn(ms1, "MS 1")}
                                        {renderOddBtn(ms0, "MS X")}
                                        {renderOddBtn(ms2, "MS 2")}
                                    </div>
                                    <button 
                                        onClick={toggleExpand}
                                        className="p-1.5 ml-1 mr-1 rounded flex items-center justify-center border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors"
                                        title="Diğer Oranlar"
                                    >
                                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Genişletilmiş Oranlar Container */}
                        {isExpanded && (
                            <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700/50 flex flex-wrap gap-x-6 gap-y-4 animate-in slide-in-from-top-2">
                                {/* Çifte Şans */}
                                <div className="flex flex-col gap-1.5">
                                    <span className="text-[10px] font-bold text-slate-505 dark:text-slate-400 uppercase tracking-wider">Çifte Şans</span>
                                    <div className="flex items-center">
                                        {renderOddBtn(cs1x, "1-X")}
                                        {renderOddBtn(cs12, "1-2")}
                                        {renderOddBtn(csx2, "X-2")}
                                    </div>
                                </div>

                                {/* İY Oranları */}
                                <div className="flex flex-col gap-1.5">
                                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">İlk Yarı Sonucu</span>
                                    <div className="flex items-center">
                                        {renderOddBtn(iy1, "İY 1")}
                                        {renderOddBtn(iy0, "İY X")}
                                        {renderOddBtn(iy2, "İY 2")}
                                    </div>
                                </div>

                                {/* İY Çifte Şans */}
                                <div className="flex flex-col gap-1.5">
                                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">İY Çifte Şans</span>
                                    <div className="flex items-center">
                                        {renderOddBtn(iyCs1x, "1-X")}
                                        {renderOddBtn(iyCs12, "1-2")}
                                        {renderOddBtn(iyCsx2, "X-2")}
                                    </div>
                                </div>

                                {/* Alt/Üst Oranları */}
                                <div className="flex flex-col gap-1.5">
                                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Alt / Üst</span>
                                    <div className="flex items-center">
                                        {renderOddBtn(alt15, "1.5 A")}
                                        {renderOddBtn(ust15, "1.5 Ü")}
                                        {renderOddBtn(alt25, "2.5 A")}
                                        {renderOddBtn(ust25, "2.5 Ü")}
                                        {renderOddBtn(alt35, "3.5 A")}
                                        {renderOddBtn(ust35, "3.5 Ü")}
                                    </div>
                                </div>

                                {/* İY Alt/Üst */}
                                <div className="flex flex-col gap-1.5">
                                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">İY Alt / Üst</span>
                                    <div className="flex items-center">
                                        {renderOddBtn(iyAlt15, "1.5 A")}
                                        {renderOddBtn(iyUst15, "1.5 Ü")}
                                    </div>
                                </div>

                                {/* Ev Sahibi Gol */}
                                <div className="flex flex-col gap-1.5">
                                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Ev Gol (0.5)</span>
                                    <div className="flex items-center">
                                        {renderOddBtn(ev05Alt, "Alt")}
                                        {renderOddBtn(ev05Ust, "Üst")}
                                    </div>
                                </div>

                                {/* KG Oranları */}
                                <div className="flex flex-col gap-1.5">
                                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Karşılıklı Gol</span>
                                    <div className="flex items-center">
                                        {renderOddBtn(kgVar, "Var")}
                                        {renderOddBtn(kgYok, "Yok")}
                                    </div>
                                </div>

                                {/* Toplam Gol Aralığı */}
                                <div className="flex flex-col gap-1.5">
                                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Toplam Gol Aralığı</span>
                                    <div className="flex items-center">
                                        {renderOddBtn(tg01, "0-1")}
                                        {renderOddBtn(tg23, "2-3")}
                                        {renderOddBtn(tg45, "4-5")}
                                        {renderOddBtn(tg6plus, "6+")}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
          </div>

          {/* Bahis Yap Kutusu / Zaten Katıldı Uyarısı */}
          {canJoin && (
            <div className="space-y-6">
              {myParticipants.length > 0 && (
                <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/10 dark:to-teal-900/10 border border-emerald-250 dark:border-emerald-900/30 rounded-2xl p-6 backdrop-blur-md transition-colors duration-200 flex flex-col gap-3">
                  <h3 className="text-lg font-bold text-emerald-800 dark:text-emerald-450 flex items-center gap-2">
                    <span>✅</span> Bu Düelloda {myParticipants.length} Katılımınız Var
                  </h3>
                  <div className="space-y-3">
                    {myParticipants.map((p, idx) => (
                      <div key={p.id} className="p-4 bg-white dark:bg-slate-900/60 border border-emerald-100 dark:border-emerald-900/40 rounded-xl flex flex-wrap gap-6 items-center justify-between text-sm">
                        <div>
                          <span className="font-bold text-slate-700 dark:text-slate-300">#{idx + 1} Katılım:</span>
                        </div>
                        <div>
                          <span className="text-slate-550 dark:text-slate-400">Yatırılan Tutar:</span>{" "}
                          <span className="font-bold text-slate-800 dark:text-slate-200">{p.slip?.amount} Coin</span>
                        </div>
                        <div>
                          <span className="text-slate-550 dark:text-slate-400">Toplam Oran:</span>{" "}
                          <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">@{p.slip?.total_odd?.toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-slate-550 dark:text-slate-400">Olası Kazanç:</span>{" "}
                          <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">{(p.slip?.amount * p.slip?.total_odd).toFixed(2)} Coin</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-gradient-to-r from-indigo-50 to-slate-50 dark:from-indigo-950/20 dark:to-slate-900/20 border border-indigo-200 dark:border-indigo-900/30 rounded-2xl p-6 backdrop-blur-md transition-colors duration-200">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Düelloya Katıl (Yeni Kupon)</h3>
                
                <div className="flex flex-wrap items-end gap-4">
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-sm text-slate-550 dark:text-slate-400 mb-2">Katılım Bedeli (Coin)</label>
                    <div className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-250 dark:border-slate-600 text-slate-900 dark:text-white px-4 py-3 rounded-xl flex items-center justify-between font-bold">
                        <span>Sabit Tutar</span>
                        <span className="text-indigo-600 dark:text-indigo-400 font-mono text-lg">500</span>
                    </div>
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
