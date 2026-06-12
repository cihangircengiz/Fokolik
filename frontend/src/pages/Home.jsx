import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { apiService, API_BASE_URL } from '../services/api';
import { Calendar, HelpCircle, Plus, Receipt, Trash2, Coins, ChevronDown, ChevronUp, Globe, Clock, XCircle, Info } from 'lucide-react';
import { toast } from 'sonner';
import ConfirmModal from '../components/ConfirmModal';

export default function Home() {
    const { user, token, refreshUserBalance } = useContext(AuthContext);

    const [matches, setMatches] = useState([]);
    const [slips, setSlips] = useState([]); // Only for active slips footer
    const [selectedOdds, setSelectedOdds] = useState([]);
    const [betAmount, setBetAmount] = useState("10");
    const [loading, setLoading] = useState(false);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [updateError, setUpdateError] = useState(false);
    const [workerStatus, setWorkerStatus] = useState(null);

    const getTodayDateString = () => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    const [selectedDate, setSelectedDate] = useState(getTodayDateString());
    const [activeMainTab, setActiveMainTab] = useState("upcoming");
    const [expandedMatches, setExpandedMatches] = useState({});
    const [expandedOddsGroups, setExpandedOddsGroups] = useState({});
    const [isFooterDrawerOpen, setIsFooterDrawerOpen] = useState(false);
    const [cancelModalState, setCancelModalState] = useState({ isOpen: false, slipId: null });
    const [battleModalState, setBattleModalState] = useState({ isOpen: false });
    const [battleIsPublic, setBattleIsPublic] = useState(true);
    const [battleLimit, setBattleLimit] = useState("");
    const [flashMatches, setFlashMatches] = useState({});
    useEffect(() => {
        fetchBulletin();
        fetchSystemStatus();
        const interval = setInterval(() => {
            fetchBulletin();
            fetchSystemStatus();
        }, 30000);
        return () => clearInterval(interval);
    }, [activeMainTab, selectedDate]);
    useEffect(() => {
        if (user && token) {
            fetchActiveSlips();
        }
    }, [user, token]);

    // Connect to WebSocket for real-time score updates and coupon outcomes
    useEffect(() => {
        const ws = apiService.connectWebSocket(async (msg) => {
            if (msg.type === "match_updates") {
                setMatches((prevMatches) => {
                    return prevMatches.map((m) => {
                        const update = msg.data.find((item) => item.id === m.id);
                        if (update) {
                            const homeScoreChanged = update.home_score !== m.home_score;
                            const awayScoreChanged = update.away_score !== m.away_score;
                            if (homeScoreChanged || awayScoreChanged) {
                                setFlashMatches((prev) => ({
                                    ...prev,
                                    [m.id]: {
                                        home: homeScoreChanged,
                                        away: awayScoreChanged,
                                    },
                                }));
                                // Clear flash animation after 3s
                                setTimeout(() => {
                                    setFlashMatches((prev) => {
                                        const copy = { ...prev };
                                        delete copy[m.id];
                                        return copy;
                                    });
                                }, 3000);
                            }
                            return {
                                ...m,
                                status: update.status,
                                home_score: update.home_score,
                                away_score: update.away_score,
                                minute: update.minute,
                                ht_home_score: update.ht_home_score,
                                ht_away_score: update.ht_away_score,
                            };
                        }
                        return m;
                    });
                });
            } else if (msg.type === "slip_settled") {
                if (user && msg.data.user_id === user.id) {
                    if (msg.data.status === "won") {
                        toast.success(`Tebrikler! Kupon #${msg.data.slip_id} kazandı ve hesabınıza ${msg.data.payout} Coin yatırıldı! 🎉`, { duration: 10000 });
                    } else {
                        toast.error(`Kupon #${msg.data.slip_id} sonuçlandı ve kaybetti. ❌`, { duration: 10000 });
                    }
                    refreshUserBalance();
                    fetchActiveSlips();
                }
            }
        });

        return () => {
            if (ws) {
                ws.close();
            }
        };
    }, [user?.id, token]);

    const fetchBulletin = async () => {
        try {
            setUpdateError(false);
            let data;
            if (activeMainTab === "live") {
                data = await apiService.getLiveMatches();
            } else {
                data = await apiService.getMatches(selectedDate);
            }
            setMatches(data);
            setLastUpdated(new Date());
        } catch (err) {
            console.error(err);
            setUpdateError(true);
        }
    };
    const fetchSystemStatus = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/system/status`);
            if (res.ok) {
                const data = await res.json();
                setWorkerStatus(data);
            }
        } catch (e) {
            console.error("System status error", e);
        }
    };

    const isWorkerDelayed = (isoDateStr) => {
        if (!isoDateStr) return true;
        return (Date.now() - new Date(isoDateStr).getTime()) > 120000; // 2 dakika gecikme
    };

    const fetchActiveSlips = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/slips/my_slips`, {
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
            const res = await fetch(`${API_BASE_URL}/slips/`, {
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
    
    const handleCreateBattle = async () => {
        if (!user) {
            toast.error("Önce giriş yapmalısınız.");
            return;
        }
        const uniqueMatchIds = [...new Set(selectedOdds.map(item => item.match.id))];
        if (uniqueMatchIds.length < 2 || uniqueMatchIds.length > 5) {
            toast.error("Düello başlatmak için 2 ile 5 arasında maç seçmelisiniz.");
            return;
        }
        setLoading(true);
        try {
            const payload = {
                match_ids: uniqueMatchIds,
                is_public: battleIsPublic,
                max_participants: battleLimit ? parseInt(battleLimit) : null
            };
            const res = await fetch(`${API_BASE_URL}/battles/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(payload)
            });
            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.detail || "Hata");
            }
            const data = await res.json();
            toast.success("Düello başarıyla oluşturuldu!");
            setBattleModalState({ isOpen: false });
            setSelectedOdds([]);
            window.location.href = `/battles/${data.invite_code}`;
        } catch (err) {
            toast.error(err.message || "Düello oluşturulamadı.");
        } finally {
            setLoading(false);
        }
    };

    const handleCancelSlipRequest = (slipId) => {
        setCancelModalState({ isOpen: true, slipId });
    };

    const executeCancelSlip = async () => {
        const slipId = cancelModalState.slipId;
        if (!slipId) return;

        try {
            const res = await fetch(`${API_BASE_URL}/slips/${slipId}/cancel`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (res.ok) {
                toast.success("Kupon başarıyla iptal edildi!");
                fetchActiveSlips();
                refreshUserBalance();
            } else {
                const errData = await res.json();
                toast.error(errData.detail || "İptal işlemi başarısız.");
            }
        } catch (error) {
            toast.error("Bir hata oluştu.");
        } finally {
            setCancelModalState({ isOpen: false, slipId: null });
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
        const tabs = [];
        const now = new Date();
        for (let i = 0; i < 7; i++) {
            const d = new Date();
            d.setDate(now.getDate() + i);
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            
            const formattedLabel = d.toLocaleDateString("tr-TR", { day: "numeric", month: "short", weekday: "short" });
            
            tabs.push({
                label: formattedLabel,
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
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
                        <div className="flex items-center gap-3">
                            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                Güncel Maç Bülteni
                            </h2>
                            {workerStatus && (
                                <div className="flex items-center gap-2 ml-2">
                                    {/* Bulletin Worker Status */}
                                    <div className="flex items-center gap-1 text-[10px] bg-slate-50 dark:bg-slate-800/50 px-2 py-0.5 rounded-md border border-slate-100 dark:border-slate-800" title={workerStatus.bulletin_worker?.error || "Bot aktif"}>
                                        <span className={`w-2 h-2 rounded-full ${workerStatus.bulletin_worker?.status === 'ok' && !isWorkerDelayed(workerStatus.bulletin_worker?.last_sync) ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' : 'bg-red-500 animate-pulse'}`}></span>
                                        <span className="text-slate-500 dark:text-slate-400 font-semibold">Veri Botu</span>
                                    </div>
                                    
                                    {/* Live Worker Status */}
                                    {activeMainTab === "live" && (
                                        <div className="flex items-center gap-1 text-[10px] bg-slate-50 dark:bg-slate-800/50 px-2 py-0.5 rounded-md border border-slate-100 dark:border-slate-800" title={workerStatus.live_worker?.error || "Canlı skor botu aktif"}>
                                            <span className={`w-2 h-2 rounded-full ${workerStatus.live_worker?.status === 'ok' && !isWorkerDelayed(workerStatus.live_worker?.last_sync) ? 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)] animate-pulse' : 'bg-red-500 animate-pulse'}`}></span>
                                            <span className="text-slate-500 dark:text-slate-400 font-semibold">Canlı Skor Botu</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        <button onClick={fetchBulletin} className="text-sm font-bold text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 cursor-pointer self-start sm:self-auto flex items-center gap-1">
                            Yenile
                        </button>
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
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden transition-colors duration-200">
                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                            {[...matches]
                                .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))
                                .map(match => {
                                    const isExpanded = expandedMatches[match.id];
                                    const isLiveOrFinished = match.status !== "not_started";

                                    return (
                                        <div key={match.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors duration-150">
                                            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium mb-1.5 flex-wrap">
                                                        <div className="flex items-center gap-1">
                                                            <Calendar size={14} /> {formatDate(match.start_date)}
                                                        </div>
                                                        <span className="bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                                                            {match.league || "Diğer Ligler"}
                                                        </span>
                                                        {match.status === "finished" && <span className="bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded font-bold">MS</span>}
                                                        {isLiveOrFinished && match.status !== "finished" && (
                                                            <span className="bg-red-100 dark:bg-red-950/30 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded font-bold flex items-center gap-1">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span> CANLI
                                                                {match.minute && <span className="text-emerald-600 dark:text-emerald-400 font-bold">{match.minute}'</span>}
                                                            </span>
                                                        )}
                                                    </div>

                                                    <div className="text-base font-bold text-slate-800 dark:text-slate-200 flex items-center gap-3">
                                                        <span className={flashMatches[match.id]?.home ? "text-emerald-500 dark:text-emerald-400 transition-colors duration-300" : ""}>{match.home_team}</span>
                                                        {isLiveOrFinished ? (
                                                            <div className={`px-2 py-0.5 rounded-md border font-mono text-sm transition-all duration-300 flex items-center gap-1 ${
                                                                (flashMatches[match.id]?.home || flashMatches[match.id]?.away)
                                                                    ? "bg-emerald-500 text-white border-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)] scale-110" 
                                                                    : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                                                            }`}>
                                                                <span className={flashMatches[match.id]?.home ? "animate-pulse font-extrabold" : ""}>{match.home_score}</span>
                                                                <span>-</span>
                                                                <span className={flashMatches[match.id]?.away ? "animate-pulse font-extrabold" : ""}>{match.away_score}</span>
                                                            </div>
                                                        ) : <span className="text-slate-400 dark:text-slate-550 font-normal text-xs px-2">vs</span>}
                                                        <span className={flashMatches[match.id]?.away ? "text-emerald-500 dark:text-emerald-400 transition-colors duration-300" : ""}>{match.away_team}</span>
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
                                                        className="px-3 py-2 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer flex items-center gap-2 text-xs font-bold"
                                                    >
                                                        {isExpanded ? "Gizle" : "+ Daha Fazla"} {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                                    </button>
                                                </div>
                                            </div>
                                            {isExpanded && (
                                                <div className="mt-4 pt-4 border-t border-slate-150 dark:border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-4 animate-fade-in">
                                                    {/* Alt/Üst 2.5 */}
                                                    <div className="bg-slate-50 dark:bg-slate-800/30 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
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
                                                                        <span className="text-[10px] text-slate-400 dark:text-slate-550 font-normal">{betType}</span>
                                                                        <span>{odd.odd_value.toFixed(2)}</span>
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                    {/* Karşılıklı Gol */}
                                                    <div className="bg-slate-50 dark:bg-slate-800/30 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                                                        <span className="text-xs font-bold text-slate-400 dark:text-slate-550 uppercase block mb-2">Karşılıklı Gol (KG)</span>
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
                                                                        <span className="text-[10px] text-slate-400 dark:text-slate-550 font-normal">{betType}</span>
                                                                        <span>{odd.odd_value.toFixed(2)}</span>
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                    {/* İlk Yarı Sonucu */}
                                                    <div className="bg-slate-50 dark:bg-slate-800/30 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                                                        <span className="text-xs font-bold text-slate-400 dark:text-slate-550 uppercase block mb-2">İlk Yarı Sonucu (İY)</span>
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
                                                                        <span className="text-[9px] text-slate-400 dark:text-slate-550 font-normal">{betType}</span>
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
                                
                                {/* Battle Button */}
                                {selectedOdds.length >= 2 && selectedOdds.length <= 5 && (
                                    <button
                                        onClick={() => setBattleModalState({ isOpen: true })}
                                        className="w-full mt-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold py-3 rounded-xl shadow-md transition-all flex justify-center items-center gap-2 cursor-pointer border border-indigo-400/30"
                                    >
                                        ⚔️ Bu Maçlarla Düello Başlat
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
            {/* Sticky Active Slips Footer */}
            {user && activePendingSlips.length > 0 && (
                <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end">
                    {isFooterDrawerOpen && (
                        <div className="w-[22rem] bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/50 dark:border-slate-700/50 rounded-2xl shadow-2xl mb-4 max-h-[65vh] overflow-hidden flex flex-col transition-all ring-1 ring-slate-900/5 dark:ring-white/5 animate-fade-in">
                            <div className="p-4 border-b border-slate-100/50 dark:border-slate-800/50 flex justify-between items-center bg-gradient-to-r from-slate-50 to-white dark:from-slate-800/50 dark:to-slate-900/50 relative">
                                <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                    <div className="p-1.5 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-lg">
                                        <Clock size={16} />
                                    </div>
                                    Canlı Takip
                                </h3>
                                <button onClick={() => setIsFooterDrawerOpen(false)} className="p-1.5 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg transition-colors cursor-pointer"><XCircle size={18} /></button>
                            </div>
                            <div className="p-4 flex flex-col gap-3 overflow-y-auto">
                                {activePendingSlips.map(slip => (
                                    <div key={slip.id} className="relative overflow-hidden border border-slate-200/80 dark:border-slate-700/50 rounded-xl bg-white dark:bg-slate-800/60 shadow-sm hover:shadow-md transition-all group">
                                        {/* Decorative left accent */}
                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500/80 dark:bg-indigo-500/60 rounded-l-xl"></div>
                                        <div className="p-3 pl-4 flex flex-col gap-2">
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 font-mono tracking-wider">KUPON #{slip.id}</span>
                                                <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100/50 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold rounded-full">
                                                    {slip.selections.length} Seçim
                                                </span>
                                            </div>
                                            
                                            <div className="flex items-center justify-between mt-1 bg-slate-50 dark:bg-slate-900/30 p-2 rounded-lg">
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-semibold">Tutar / Oran</span>
                                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200 mt-0.5">
                                                        {slip.amount} <span className="text-slate-400 font-normal mx-0.5">×</span> {slip.total_odd.toFixed(2)}
                                                    </span>
                                                </div>
                                                <div className="flex flex-col items-end">
                                                    <span className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 uppercase font-semibold">Olası Kazanç</span>
                                                    <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                                                        {(slip.amount * slip.total_odd).toFixed(2)}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="mt-1 flex flex-col gap-1.5 border-t border-slate-100 dark:border-slate-700/50 pt-2">
                                                {slip.selections.map(sel => {
                                                    const d = sel.odd_details;
                                                    return (
                                                        <div key={sel.id} className="flex justify-between items-center text-[10px]">
                                                            <span className="text-slate-600 dark:text-slate-400 truncate pr-2" title={`${d?.home_team} - ${d?.away_team}`}>
                                                                {d?.home_team} <span className="text-slate-300 dark:text-slate-600 mx-0.5">-</span> {d?.away_team}
                                                            </span>
                                                            <div className="flex items-center gap-1.5 shrink-0">
                                                                <span className="font-bold text-slate-700 dark:text-slate-300">{d?.bet_type}</span>
                                                                <span className="text-indigo-600 dark:text-indigo-400 font-mono font-bold">@{d?.odd_value.toFixed(2)}</span>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {isSlipCancelable(slip) && (
                                                <button 
                                                    onClick={() => handleCancelSlipRequest(slip.id)} 
                                                    className="mt-1.5 w-full flex items-center justify-center gap-1 py-1.5 text-xs font-bold border border-red-100 dark:border-red-900/30 text-red-500 hover:text-red-600 dark:text-red-400 bg-red-50/50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg cursor-pointer transition-all"
                                                >
                                                    İptal Et
                                                </button>
                                            )}
                                        </div>
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

            {/* Confirm Modal */}
            <ConfirmModal
                isOpen={cancelModalState.isOpen}
                onClose={() => setCancelModalState({ isOpen: false, slipId: null })}
                onConfirm={executeCancelSlip}
                title="Kupon İptali"
                message={`#${cancelModalState.slipId} numaralı aktif kuponunuzu iptal etmek istediğinize emin misiniz? (Bu işlem geri alınamaz ve bakiye iade edilir.)`}
                confirmText="İptal Et"
                cancelText="Vazgeç"
                isDestructive={true}
            />

            {/* Battle Creation Modal */}
            {battleModalState.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl max-w-md w-full p-6 animate-scale-in">
                        <div className="flex justify-between items-center mb-5">
                            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                ⚔️ Düello Ayarları
                            </h3>
                            <button onClick={() => setBattleModalState({ isOpen: false })} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                                <XCircle size={24} />
                            </button>
                        </div>
                        
                        <div className="space-y-4 mb-6">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Gizlilik</label>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => setBattleIsPublic(true)}
                                        className={`flex-1 py-2 rounded-xl border font-bold text-sm transition-all ${battleIsPublic ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'}`}
                                    >
                                        🌍 Herkese Açık
                                    </button>
                                    <button 
                                        onClick={() => setBattleIsPublic(false)}
                                        className={`flex-1 py-2 rounded-xl border font-bold text-sm transition-all ${!battleIsPublic ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'}`}
                                    >
                                        🔒 Gizli (Sadece Kodla)
                                    </button>
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Kişi Limiti (Opsiyonel)</label>
                                <input 
                                    type="number" 
                                    placeholder="Örn: 10 (Boş bırakırsanız limitsiz olur)"
                                    value={battleLimit}
                                    onChange={(e) => setBattleLimit(e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-800 dark:text-slate-100 focus:border-indigo-500 outline-none transition-all"
                                />
                            </div>
                        </div>

                        <button 
                            onClick={handleCreateBattle}
                            disabled={loading}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50"
                        >
                            {loading ? 'Oluşturuluyor...' : 'Düelloyu Başlat'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
