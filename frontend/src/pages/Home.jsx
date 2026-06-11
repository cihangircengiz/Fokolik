import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { apiService } from '../services/api';
import { Calendar, HelpCircle, Plus, Receipt, Trash2, Coins, ChevronDown, ChevronUp, Globe, Clock, XCircle, Info } from 'lucide-react';
import { toast } from 'sonner';
export default function Home() {
    const { user, token, refreshUserBalance } = useContext(AuthContext);

    const [matches, setMatches] = useState([]);
    const [slips, setSlips] = useState([]); // Only for active slips footer
    const [selectedOdds, setSelectedOdds] = useState([]);
    const [betAmount, setBetAmount] = useState("10");
    const [loading, setLoading] = useState(false);

    const [selectedDate, setSelectedDate] = useState(null);
    const [activeMainTab, setActiveMainTab] = useState("upcoming");
    const [expandedMatches, setExpandedMatches] = useState({});
    const [expandedOddsGroups, setExpandedOddsGroups] = useState({});
    const [isFooterDrawerOpen, setIsFooterDrawerOpen] = useState(false);
    const [flashMatches, setFlashMatches] = useState({});
    useEffect(() => {
        fetchBulletin();
        const interval = setInterval(() => fetchBulletin(), 30000);
        return () => clearInterval(interval);
    }, [activeMainTab, selectedDate]);
    useEffect(() => {
        if (user && token) {
            fetchActiveSlips();
        }
    }, [user, token]);
    const fetchBulletin = async () => {
        try {
            let data;
            if (activeMainTab === "live") {
                data = await apiService.getLiveMatches();
            } else {
                data = await apiService.getMatches(selectedDate);
            }
            setMatches(data);
        } catch (err) {
            console.error(err);
        }
    };
    const fetchActiveSlips = async () => {
        try {
            const res = await fetch(`http://localhost:8000/slips/my_slips`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setSlips(data);
            }
        } catch (err) {
            console.error(err);
        }
    };
    const handleSelectOdd = (match, odd) => {
        if (!user) {
            toast.error("Bahis yapabilmek için lütfen giriş yapın.");
            return;
        }
        setSelectedOdds(prev => {
            const exactMatch = prev.find(item => item.odd.id === odd.id);
            if (exactMatch) return prev.filter(item => item.odd.id !== odd.id);

            const matchExists = prev.find(item => item.match.id === match.id);
            if (matchExists) return prev.map(item => item.match.id === match.id ? { match, odd } : item);

            return [...prev, { match, odd }];
        });
    };
    const handleRemoveSelection = (matchId) => {
        setSelectedOdds(prev => prev.filter(item => item.match.id !== matchId));
    };
    const handlePlaceSlip = async () => {
        if (!user || selectedOdds.length === 0) return;
        const amount = parseFloat(betAmount);
        if (isNaN(amount) || amount <= 0) {
            toast.error("Lütfen geçerli bir bahis miktarı girin.");
            return;
        }
        if (amount > (user.coin_balance ?? user.balance ?? 0)) {
            toast.error("Yetersiz bakiye! Lütfen kupon tutarını düşürün.");
            return;
        }
        setLoading(true);
        try {
            const oddIds = selectedOdds.map(item => item.odd.id);
            const res = await fetch(`http://localhost:8000/slips/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ odd_ids: oddIds, amount })
            });

            if (!res.ok) throw new Error(await res.text());

            toast.success("Kuponunuz başarıyla yatırıldı!");
            setSelectedOdds([]);
            refreshUserBalance();
            fetchActiveSlips();
        } catch (err) {
            toast.error("Kupon yatırılırken bir hata oluştu.");
        } finally {
            setLoading(false);
        }
    };
    const handleCancelSlip = async (slipId) => {
        if (!window.confirm(`Kupon #${slipId} iptal edilecek, emin misiniz?`)) return;
        try {
            const res = await fetch(`http://localhost:8000/slips/${slipId}/cancel`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                toast.success("Kupon iptal edildi ve iade sağlandı.");
                refreshUserBalance();
                fetchActiveSlips();
            } else {
                toast.error("İptal edilemedi.");
            }
        } catch (err) {
            console.error(err);
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
    const totalOddValue = selectedOdds.reduce((acc, item) => acc * item.odd.odd_value, 1.0);
    const formattedTotalOdd = selectedOdds.length > 0 ? totalOddValue.toFixed(2) : "0.00";
    const potentialWinnings = selectedOdds.length > 0 ? (parseFloat(betAmount || 0) * totalOddValue).toFixed(2) : "0.00";
    const getGroupedMatches = () => {
        return matches.reduce((acc, match) => {
            const league = match.league || "Diğer Ligler";
            if (!acc[league]) acc[league] = [];
            acc[league].push(match);
            return acc;
        }, {});
    };
    const formatDate = (dateStr) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
    };
    const getDateTabs = () => {
        const tabs = [{ label: "Tümü", value: null }];
        const now = new Date();
        for (let i = 0; i < 7; i++) {
            const d = new Date();
            d.setDate(now.getDate() + i);
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            tabs.push({
                label: i === 0 ? "Bugün" : i === 1 ? "Yarın" : d.toLocaleDateString("tr-TR", { day: "numeric", month: "short" }),
                value: `${yyyy}-${mm}-${dd}`
            });
        }
        return tabs;
    };
    const activePendingSlips = slips.filter(s => s.status === 'pending');
    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* LEFT CONTENT */}
            <div className="lg:col-span-2 flex flex-col gap-6">

                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 transition-colors duration-200">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Güncel Maç Bülteni</h2>
                        <button onClick={fetchBulletin} className="text-sm font-bold text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 cursor-pointer">Yenile</button>
                    </div>

                    <div className="flex gap-3 mb-4">
                        <button
                            onClick={() => setActiveMainTab("live")}
                            className={`flex-1 sm:flex-none px-6 py-2 rounded-xl font-bold text-sm transition-all border cursor-pointer ${activeMainTab === "live" ? "bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-900/50" : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"}`}
                        >
                            Canlı Maçlar
                        </button>
                        <button
                            onClick={() => setActiveMainTab("upcoming")}
                            className={`flex-1 sm:flex-none px-6 py-2 rounded-xl font-bold text-sm transition-all border cursor-pointer ${activeMainTab === "upcoming" ? "bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900/50" : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"}`}
                        >
                            Yaklaşan Maçlar
                        </button>
                    </div>
                    {activeMainTab === "live" && (
                        <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-lg text-amber-700 dark:text-amber-300 text-sm transition-colors duration-200">
                            <Info size={18} />
                            <span>Canlı maç verileri <strong>60 saniye</strong> gecikmeli gelmektedir.</span>
                        </div>
                    )}
                    {activeMainTab === "upcoming" && (
                        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                            {getDateTabs().map(tab => (
                                <button
                                    key={tab.label}
                                    onClick={() => setSelectedDate(tab.value)}
                                    className={`px-4 py-1.5 rounded-lg text-sm font-semibold whitespace-nowrap border cursor-pointer transition-all ${selectedDate === tab.value ? "bg-indigo-600 text-white border-indigo-600 dark:bg-indigo-600 dark:border-indigo-600" : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"}`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                {/* Match List */}
                {matches.length === 0 ? (
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center text-slate-500 dark:text-slate-400 transition-colors duration-200">
                        <HelpCircle className="w-10 h-10 mx-auto mb-3 text-slate-300 dark:text-slate-700" />
                        <p>Maç bulunamadı.</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-6">
                        {Object.entries(getGroupedMatches()).map(([league, leagueMatches]) => (
                            <div key={league} className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden transition-colors duration-200">
                                <div className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between transition-colors duration-200">
                                    <div className="flex items-center gap-2">
                                        <Globe className="w-4 h-4 text-emerald-500" />
                                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">{league}</span>
                                    </div>
                                    <span className="text-xs font-semibold text-slate-400 dark:text-slate-550">{leagueMatches.length} Maç</span>
                                </div>

                                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {leagueMatches.map(match => {
                                        const isExpanded = expandedMatches[match.id];
                                        const isLiveOrFinished = match.status !== "not_started";

                                        return (
                                            <div key={match.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors duration-150">
                                                <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium mb-1.5">
                                                            <div className="flex items-center gap-1">
                                                                <Calendar size={14} /> {formatDate(match.start_date)}
                                                            </div>
                                                            {match.status === "finished" && <span className="bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded font-bold">MS</span>}
                                                            {isLiveOrFinished && match.status !== "finished" && (
                                                                <span className="bg-red-100 dark:bg-red-950/30 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded font-bold flex items-center gap-1">
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span> CANLI
                                                                </span>
                                                            )}
                                                            {match.minute && <span className="text-emerald-600 dark:text-emerald-400 font-bold">{match.minute}</span>}
                                                        </div>

                                                        <div className="text-base font-bold text-slate-800 dark:text-slate-200 flex items-center gap-3">
                                                            <span>{match.home_team}</span>
                                                            {isLiveOrFinished ? (
                                                                <div className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-mono text-sm transition-colors duration-200">
                                                                    {match.home_score} - {match.away_score}
                                                                </div>
                                                            ) : <span className="text-slate-400 dark:text-slate-500 font-normal text-xs px-2">vs</span>}
                                                            <span>{match.away_team}</span>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-2">
                                                        {/* MS Odds */}
                                                        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-lg transition-colors duration-200">
                                                            {["MS 1", "MS 0", "MS 2"].map(betType => {
                                                                const odd = match.odds.find(o => o.bet_type === betType);
                                                                if (!odd) return <div key={betType} className="w-12 h-8"></div>;
                                                                const isSelected = selectedOdds.some(item => item.odd.id === odd.id);
                                                                return (
                                                                    <button
                                                                        key={odd.id}
                                                                        onClick={() => { if (!isLiveOrFinished) handleSelectOdd(match, odd); }}
                                                                        disabled={isLiveOrFinished}
                                                                        className={`px-2 py-1 rounded-md min-w-[50px] flex items-center justify-center gap-1 text-xs font-bold transition-all border cursor-pointer ${isSelected ? "bg-indigo-600 text-white border-indigo-600 shadow-md" :
                                                                                isLiveOrFinished ? "bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 border-slate-200 dark:border-slate-800 cursor-not-allowed" :
                                                                                    "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400"
                                                                            }`}
                                                                    >
                                                                        <span className={isSelected ? "text-indigo-100" : "text-slate-400 dark:text-slate-500 text-[10px]"}>{betType.replace("MS ", "")}</span>
                                                                        <span>{odd.odd_value.toFixed(2)}</span>
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>

                                                        <button
                                                            onClick={() => setExpandedMatches(prev => ({ ...prev, [match.id]: !prev[match.id] }))}
                                                            className="p-2 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                                        >
                                                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                                        </button>
                                                    </div>
                                                </div>
                                                {isExpanded && (
                                                    <div className="mt-4 pt-4 border-t border-slate-150 dark:border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-4 animate-fade-in">
                                                        {/* Alt/Üst 2.5 */}
                                                        <div className="bg-slate-50 dark:bg-slate-850/30 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                                                            <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase block mb-2">Alt / Üst (2.5)</span>
                                                            <div className="grid grid-cols-2 gap-2">
                                                                {["2.5 Alt", "2.5 Üst"].map(betType => {
                                                                    const odd = match.odds.find(o => o.bet_type === betType);
                                                                    if (!odd) return <div key={betType} className="text-xs text-slate-400 text-center py-2 bg-white dark:bg-slate-900 rounded border border-slate-100 dark:border-slate-800">-</div>;
                                                                    const isSelected = selectedOdds.some(item => item.odd.id === odd.id);
                                                                    return (
                                                                        <button
                                                                            key={odd.id}
                                                                            onClick={() => { if (!isLiveOrFinished) handleSelectOdd(match, odd); }}
                                                                            disabled={isLiveOrFinished}
                                                                            className={`px-3 py-1.5 rounded-lg flex flex-col items-center justify-center gap-0.5 text-xs font-bold transition-all border cursor-pointer ${isSelected ? "bg-indigo-600 text-white border-indigo-600 shadow-sm" :
                                                                                    isLiveOrFinished ? "bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 border-slate-200 dark:border-slate-800 cursor-not-allowed" :
                                                                                        "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400"
                                                                                }`}
                                                                        >
                                                                            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">{betType}</span>
                                                                            <span>{odd.odd_value.toFixed(2)}</span>
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                        {/* Karşılıklı Gol */}
                                                        <div className="bg-slate-50 dark:bg-slate-850/30 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                                                            <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase block mb-2">Karşılıklı Gol (KG)</span>
                                                            <div className="grid grid-cols-2 gap-2">
                                                                {["KG Var", "KG Yok"].map(betType => {
                                                                    const odd = match.odds.find(o => o.bet_type === betType);
                                                                    if (!odd) return <div key={betType} className="text-xs text-slate-400 text-center py-2 bg-white dark:bg-slate-900 rounded border border-slate-100 dark:border-slate-800">-</div>;
                                                                    const isSelected = selectedOdds.some(item => item.odd.id === odd.id);
                                                                    return (
                                                                        <button
                                                                            key={odd.id}
                                                                            onClick={() => { if (!isLiveOrFinished) handleSelectOdd(match, odd); }}
                                                                            disabled={isLiveOrFinished}
                                                                            className={`px-3 py-1.5 rounded-lg flex flex-col items-center justify-center gap-0.5 text-xs font-bold transition-all border cursor-pointer ${isSelected ? "bg-indigo-600 text-white border-indigo-600 shadow-sm" :
                                                                                    isLiveOrFinished ? "bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 border-slate-200 dark:border-slate-800 cursor-not-allowed" :
                                                                                        "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400"
                                                                                }`}
                                                                        >
                                                                            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">{betType}</span>
                                                                            <span>{odd.odd_value.toFixed(2)}</span>
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                        {/* İlk Yarı Sonucu */}
                                                        <div className="bg-slate-50 dark:bg-slate-850/30 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                                                            <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase block mb-2">İlk Yarı Sonucu (İY)</span>
                                                            <div className="grid grid-cols-3 gap-1.5">
                                                                {["İY 1", "İY 0", "İY 2"].map(betType => {
                                                                    const odd = match.odds.find(o => o.bet_type === betType);
                                                                    if (!odd) return <div key={betType} className="text-xs text-slate-400 text-center py-2 bg-white dark:bg-slate-900 rounded border border-slate-100 dark:border-slate-800">-</div>;
                                                                    const isSelected = selectedOdds.some(item => item.odd.id === odd.id);
                                                                    return (
                                                                        <button
                                                                            key={odd.id}
                                                                            onClick={() => { if (!isLiveOrFinished) handleSelectOdd(match, odd); }}
                                                                            disabled={isLiveOrFinished}
                                                                            className={`px-2 py-1.5 rounded-lg flex flex-col items-center justify-center gap-0.5 text-xs font-bold transition-all border cursor-pointer ${isSelected ? "bg-indigo-600 text-white border-indigo-600 shadow-sm" :
                                                                                    isLiveOrFinished ? "bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 border-slate-200 dark:border-slate-800 cursor-not-allowed" :
                                                                                        "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400"
                                                                                }`}
                                                                        >
                                                                            <span className="text-[9px] text-slate-400 dark:text-slate-500 font-normal">{betType}</span>
                                                                            <span>{odd.odd_value.toFixed(2)}</span>
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            {/* RIGHT CONTENT - Bet Slip */}
            <div className="lg:col-span-1">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sticky top-24 shadow-sm transition-colors duration-200">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-4 mb-4 flex items-center justify-between transition-colors duration-200">
                        <div className="flex items-center gap-2">
                            <Receipt className="w-5 h-5 text-indigo-500" /> Bahis Kuponu
                        </div>
                        {selectedOdds.length > 0 && <span className="bg-indigo-100 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-300 px-2 py-0.5 rounded text-xs font-bold transition-colors duration-200">{selectedOdds.length} Seçim</span>}
                    </h3>
                    {selectedOdds.length === 0 ? (
                        <div className="text-center py-8 text-slate-400 dark:text-slate-500">
                            <p className="text-sm mb-1">Kuponunuz boş.</p>
                            <p className="text-xs">Oranlara tıklayarak seçim ekleyin.</p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4">
                            <div className="max-h-64 overflow-y-auto pr-2 space-y-2">
                                {selectedOdds.map(({ match, odd }) => (
                                    <div key={match.id} className="bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 p-3 rounded-xl flex items-start justify-between gap-2 transition-colors duration-200">
                                        <div>
                                            <div className="font-semibold text-sm text-slate-800 dark:text-slate-200 mb-1">{match.home_team} - {match.away_team}</div>
                                            <div className="flex items-center gap-2 text-xs">
                                                <span className="font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 px-1.5 py-0.5 rounded transition-colors duration-200">{odd.bet_type}</span>
                                                <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">@{odd.odd_value.toFixed(2)}</span>
                                            </div>
                                        </div>
                                        <button onClick={() => handleRemoveSelection(match.id)} className="text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 cursor-pointer">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-4 transition-colors duration-200">
                                <div className="flex justify-between items-center font-bold text-sm">
                                    <span className="text-slate-600 dark:text-slate-400">Toplam Oran</span>
                                    <span className="text-emerald-600 dark:text-emerald-400 text-lg">{formattedTotalOdd}</span>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">KUPON TUTARI</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={betAmount}
                                        onChange={e => setBetAmount(e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 font-mono font-bold text-slate-800 dark:text-slate-100 focus:border-indigo-500 dark:focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-950 outline-none transition-all"
                                    />
                                </div>
                                <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/50 p-4 rounded-xl flex justify-between items-center transition-colors duration-200">
                                    <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">Maksimum Kazanç</span>
                                    <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono text-lg">{potentialWinnings}</span>
                                </div>
                                <button
                                    onClick={handlePlaceSlip}
                                    disabled={loading}
                                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl shadow-md shadow-emerald-200 dark:shadow-none transition-all flex justify-center items-center gap-2 cursor-pointer disabled:opacity-50"
                                >
                                    <Plus size={20} /> Kuponu Yatır
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            {/* Sticky Active Slips Footer */}
            {user && activePendingSlips.length > 0 && (
                <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end">
                    {isFooterDrawerOpen && (
                        <div className="w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl mb-4 max-h-[60vh] overflow-y-auto transition-all">
                            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center sticky top-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm z-10 transition-colors">
                                <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2"><Clock size={18} className="text-indigo-500 dark:text-indigo-400" /> Aktif Kuponlar</h3>
                                <button onClick={() => setIsFooterDrawerOpen(false)} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"><XCircle size={20} /></button>
                            </div>
                            <div className="p-4 flex flex-col gap-3">
                                {activePendingSlips.map(slip => (
                                    <div key={slip.id} className="border border-slate-200 dark:border-slate-800 rounded-xl p-3 bg-slate-50 dark:bg-slate-800/50 transition-colors">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">#{slip.id}</span>
                                            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{(slip.amount * slip.total_odd).toFixed(2)}</span>
                                        </div>
                                        <div className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                                            {slip.selections.length} Seçim
                                        </div>
                                        {isSlipCancelable(slip) && (
                                            <button onClick={() => handleCancelSlip(slip.id)} className="w-full mt-2 py-1.5 text-xs font-bold border border-red-200 dark:border-red-900/50 text-red-500 dark:text-red-400 bg-white dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-950/20 rounded cursor-pointer transition-colors">İptal Et</button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    <button
                        onClick={() => setIsFooterDrawerOpen(!isFooterDrawerOpen)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-3 rounded-full shadow-lg flex items-center gap-2 transition-all cursor-pointer"
                    >
                        {activePendingSlips.length} Aktif Kupon {isFooterDrawerOpen ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
                    </button>
                </div>
            )}
        </div>
    );
}
