import React, { useState, useEffect } from "react";
import { 
  Coins, 
  Calendar, 
  Clock, 
  UserPlus, 
  LogOut, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  HelpCircle,
  Plus,
  TrendingUp,
  Receipt,
  Trash2,
  ChevronDown,
  ChevronUp,
  Filter,
  Globe
} from "lucide-react";
import { apiService } from "./services/api";

function App() {
  // App States
  const [user, setUser] = useState(null);
  const [usernameInput, setUsernameInput] = useState("");
  const [matches, setMatches] = useState([]);
  const [slips, setSlips] = useState([]);
  const [selectedOdds, setSelectedOdds] = useState([]); // Array of { match, odd }
  const [betAmount, setBetAmount] = useState("10");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  
  // New States: Date Filter and History Status Tabs
  const [selectedDate, setSelectedDate] = useState(null); // null = Tümü, "YYYY-MM-DD"
  const [activeMainTab, setActiveMainTab] = useState("upcoming"); // "live" | "upcoming"
  const [activeHistoryTab, setActiveHistoryTab] = useState("all"); // all, pending, settled, cancelled
  
  // UI Accordion State for Slips History
  const [expandedSlips, setExpandedSlips] = useState({}); // { slipId: boolean }
  const [expandedMatches, setExpandedMatches] = useState({}); // { matchId: boolean }
  const [expandedOddsGroups, setExpandedOddsGroups] = useState({}); // { matchId_groupName: boolean }
  const [isFooterDrawerOpen, setIsFooterDrawerOpen] = useState(false);

  // Live Score animations and notifications
  const [flashMatches, setFlashMatches] = useState({}); // { matchId: { home: boolean, away: boolean } }
  const [toasts, setToasts] = useState([]); // Array of { id, message, type }
  const [unseenSettledCount, setUnseenSettledCount] = useState(0);

  // Toast notification helper
  const addToast = (message, type = "info") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 7000);
  };

  // Load bulletin data
  const fetchBulletin = async (tab = activeMainTab, date = selectedDate) => {
    try {
      let data;
      if (tab === "live") {
        data = await apiService.getLiveMatches();
      } else {
        data = await apiService.getMatches(date);
      }
      setMatches(data);
    } catch (err) {
      console.error("Failed to load bulletin:", err);
    }
  };

  // Load user slips history
  const fetchUserSlips = async (userId) => {
    try {
      const data = await apiService.getUserSlips(userId);
      setSlips(data);
    } catch (err) {
      console.error("Failed to load user slips:", err);
    }
  };

  // Poll bulletin with the selected date
  useEffect(() => {
    fetchBulletin(activeMainTab, selectedDate);
    const interval = setInterval(() => fetchBulletin(activeMainTab, selectedDate), 30000);
    return () => clearInterval(interval);
  }, [activeMainTab, selectedDate]);

  // Sync user details slowly as backup
  useEffect(() => {
    if (user) {
      fetchUserSlips(user.id);
      const userInterval = setInterval(async () => {
        try {
          const updatedUser = await apiService.getUser(user.username);
          setUser(updatedUser);
          fetchUserSlips(updatedUser.id);
        } catch (err) {
          console.error("Failed to sync user data:", err);
        }
      }, 30000);
      return () => clearInterval(userInterval);
    }
  }, [user?.id]);

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

        // Also update selection scores in the slips list
        setSlips((prevSlips) => {
          return prevSlips.map((slip) => {
            const nextSelections = slip.selections.map((sel) => {
              if (sel.odd_details) {
                const update = msg.data.find((item) => item.id === sel.odd_details.match_id);
                if (update) {
                  return {
                    ...sel,
                    odd_details: {
                      ...sel.odd_details,
                      match_status: update.status,
                      home_score: update.home_score,
                      away_score: update.away_score,
                      minute: update.minute,
                    },
                  };
                }
              }
              return sel;
            });
            return {
              ...slip,
              selections: nextSelections,
            };
          });
        });
      } else if (msg.type === "slip_settled") {
        if (user && msg.data.user_id === user.id) {
          if (msg.data.status === "won") {
            addToast(`Tebrikler! Kupon #${msg.data.slip_id} kazandı ve hesabınıza ${msg.data.payout} Coin yatırıldı! 🎉`, "success");
          } else {
            addToast(`Kupon #${msg.data.slip_id} sonuçlandı ve kaybetti. ❌`, "error");
          }

          if (activeHistoryTab !== "settled" && activeHistoryTab !== "all") {
            setUnseenSettledCount((prev) => prev + 1);
          }

          try {
            const updatedUser = await apiService.getUser(user.username);
            setUser(updatedUser);
            fetchUserSlips(updatedUser.id);
          } catch (err) {
            console.error("Failed to sync user data after settlement:", err);
          }
        }
      }
    });

    return () => {
      ws.close();
    };
  }, [user?.id, activeHistoryTab]);

  // Handle Login or Register
  const handleAuth = async (e) => {
    e.preventDefault();
    if (!usernameInput.trim()) return;

    setError("");
    setLoading(true);
    try {
      let userData;
      try {
        userData = await apiService.getUser(usernameInput.trim());
      } catch (err) {
        userData = await apiService.createUser(usernameInput.trim());
      }
      setUser(userData);
      setUsernameInput("");
    } catch (err) {
      setError(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  // Handle Log Out
  const handleLogOut = () => {
    setUser(null);
    setSlips([]);
    setSelectedOdds([]);
    setError("");
    setSuccess("");
  };

  // Handle Selection (Accumulator Logic)
  const handleSelectOdd = (match, odd) => {
    setError("");
    setSuccess("");
    if (!user) {
      setError("Bahis yapabilmek için lütfen giriş yapın.");
      return;
    }

    setSelectedOdds((prev) => {
      // 1. Check if the exact same odd option is already selected -> Toggle off
      const exactMatch = prev.find((item) => item.odd.id === odd.id);
      if (exactMatch) {
        return prev.filter((item) => item.odd.id !== odd.id);
      }

      // 2. Check if a selection for this match already exists -> Replace it
      const matchExists = prev.find((item) => item.match.id === match.id);
      if (matchExists) {
        return prev.map((item) => 
          item.match.id === match.id ? { match, odd } : item
        );
      }

      // 3. Otherwise, append to selections
      return [...prev, { match, odd }];
    });
  };

  // Remove selection from slip
  const handleRemoveSelection = (matchId) => {
    setSelectedOdds((prev) => prev.filter((item) => item.match.id !== matchId));
  };

  // Place multi-match slip bet
  const handlePlaceSlip = async () => {
    if (!user || selectedOdds.length === 0) return;
    const amount = parseFloat(betAmount);

    if (isNaN(amount) || amount <= 0) {
      setError("Lütfen geçerli bir bahis miktarı girin.");
      return;
    }

    if (amount > user.coin_balance) {
      setError("Yetersiz bakiye! Lütfen kupon tutarını düşürün.");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const oddIds = selectedOdds.map((item) => item.odd.id);
      await apiService.placeSlip(user.id, oddIds, amount);

      // Sync user and slips
      const updatedUser = await apiService.getUser(user.username);
      setUser(updatedUser);
      await fetchUserSlips(updatedUser.id);

      setSuccess("Kuponunuz başarıyla yatırıldı!");
      setSelectedOdds([]); // Clear slip
    } catch (err) {
      setError(err.message || "Kupon yatırılırken bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  // Cancel coupon slip
  const handleCancelSlip = async (slipId) => {
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      await apiService.cancelSlip(slipId);
      
      // Sync user and slips
      const updatedUser = await apiService.getUser(user.username);
      setUser(updatedUser);
      await fetchUserSlips(updatedUser.id);

      setSuccess("Kupon başarıyla iptal edildi ve tutar iade edildi!");
    } catch (err) {
      setError(err.message || "Kupon iptal edilirken bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  // Combined odds calculation
  const totalOddValue = selectedOdds
    .reduce((acc, item) => acc * item.odd.odd_value, 1.0);
  
  const formattedTotalOdd = selectedOdds.length > 0 ? totalOddValue.toFixed(2) : "0.00";
  const potentialWinnings = selectedOdds.length > 0 
    ? (parseFloat(betAmount || 0) * totalOddValue).toFixed(2) 
    : "0.00";

  // Check if slip is cancelable (all matches start dates in the future)
  const isSlipCancelable = (slip) => {
    if (slip.status !== "pending") return false;
    const now = new Date();
    return slip.selections.every((sel) => {
      if (!sel.odd_details) return false;
      return new Date(sel.odd_details.start_date) > now;
    });
  };

  // Generate Date Tabs (All, Today, Tomorrow, +5 Days)
  const getDateTabs = () => {
    const tabs = [
      { label: "Tümü", value: null }
    ];
    const now = new Date();
    
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(now.getDate() + i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const value = `${yyyy}-${mm}-${dd}`;
      
      let label = "";
      if (i === 0) label = "Bugün";
      else if (i === 1) label = "Yarın";
      else {
        // format as e.g. "12 Haz"
        label = d.toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
      }
      
      tabs.push({ label, value });
    }
    return tabs;
  };

  // Filter slips history based on selected status tab
  const filteredSlips = slips.filter((slip) => {
    if (activeHistoryTab === "all") return true;
    if (activeHistoryTab === "pending") return slip.status === "pending";
    if (activeHistoryTab === "settled") return slip.status === "won" || slip.status === "lost";
    if (activeHistoryTab === "cancelled") return slip.status === "cancelled";
    return true;
  });

  // Toggle Accordion
  const toggleAccordion = (slipId) => {
    setExpandedSlips((prev) => ({
      ...prev,
      [slipId]: !prev[slipId]
    }));
  };

  // Format date helper
  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("tr-TR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  // Group matches by league helper
  const getGroupedMatches = () => {
    return matches.reduce((acc, match) => {
      const league = match.league || "Diğer Ligler";
      if (!acc[league]) acc[league] = [];
      acc[league].push(match);
      return acc;
    }, {});
  };

  const toggleOddsGroup = (matchId, groupName) => {
    const key = `${matchId}_${groupName}`;
    setExpandedOddsGroups(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Helper to render a group of odds
  const renderOddsGroup = (match, groupTitle, betTypes) => {
    const groupOdds = match.odds.filter((o) => betTypes.includes(o.bet_type));
    if (groupOdds.length === 0) return null;

    const isGroupExpanded = !!expandedOddsGroups[`${match.id}_${groupTitle}`];
    const isLiveOrFinished = match.status !== "not_started";

    return (
      <div className="market-block border border-slate-200/50 rounded-lg overflow-hidden bg-white">
        <button 
          onClick={() => toggleOddsGroup(match.id, groupTitle)}
          className="w-full flex items-center justify-between p-2.5 hover:bg-slate-100/50 transition-colors cursor-pointer"
        >
          <span className="text-xs font-bold text-slate-700">{groupTitle}</span>
          {isGroupExpanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-500"/> : <ChevronDown className="w-3.5 h-3.5 text-slate-500"/>}
        </button>
        
        {isGroupExpanded && (
          <div className="p-2.5 pt-0 grid grid-flow-col auto-cols-fr gap-1.5 border-t border-slate-200/30 mt-1">
            {betTypes.map((betType) => {
              const odd = groupOdds.find((o) => o.bet_type === betType);
              if (!odd) return (
                <div 
                  key={betType}
                  className="px-2 py-1.5 rounded-lg text-[10px] bg-white/10 border border-slate-200/30 text-slate-400 flex flex-col items-center justify-center min-h-[38px] select-none"
                >
                  <span className="text-[7px] uppercase tracking-wider text-slate-400">{betType}</span>
                  <span className="font-mono text-slate-400 text-[10px]">-</span>
                </div>
              );

              const isSelected = selectedOdds.some((item) => item.odd.id === odd.id);
              return (
                <button
                  key={odd.id}
                  onClick={() => { if (!isLiveOrFinished) handleSelectOdd(match, odd) }}
                  disabled={isLiveOrFinished}
                  className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all duration-150 border flex flex-col items-center justify-center min-h-[38px] ${
                    isSelected
                      ? "bg-emerald-500 border-emerald-450 text-zinc-950 shadow-md shadow-emerald-500/20 scale-[1.02]"
                      : isLiveOrFinished
                      ? "bg-white/30 border-slate-200 text-zinc-600 opacity-50 cursor-not-allowed"
                      : "bg-white/60 hover:bg-slate-100/80 border-slate-200 hover:border-zinc-750 text-slate-600 hover:text-slate-900 cursor-pointer"
                  }`}
                >
                  <span className={`text-[7px] uppercase tracking-wider mb-0.5 ${
                    isSelected ? "text-zinc-950 font-extrabold" : "text-slate-500"
                  }`}>
                    {odd.bet_type}
                  </span>
                  <span className="font-mono text-[10px]">{odd.odd_value.toFixed(2)}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // Toggle match details expansion
  const toggleMatchDetails = (matchId) => {
    setExpandedMatches((prev) => ({
      ...prev,
      [matchId]: !prev[matchId]
    }));
  };

  // Helper to render a group of odds in a compact format (e.g. for header row)
  const renderOddsGroupCompact = (match, betTypes) => {
    const groupOdds = match.odds.filter((o) => betTypes.includes(o.bet_type));
    if (groupOdds.length === 0) return null;
    
    const isLiveOrFinished = match.status !== "not_started";

    return (
      <div className="flex items-center gap-1 bg-slate-50/20 p-1 rounded-lg border border-slate-200/60 shadow-inner">
        {betTypes.map((betType) => {
          const odd = groupOdds.find((o) => o.bet_type === betType);
          if (!odd) return (
            <div 
              key={betType}
              className="px-2 py-1 rounded-md text-[9px] bg-white/10 text-slate-400 flex items-center justify-center min-w-[50px] min-h-[28px] select-none font-semibold"
            >
              <span className="uppercase text-slate-400 font-extrabold text-[8px] mr-1">{betType.replace("MS ", "")}</span>
              <span>-</span>
            </div>
          );

          const isSelected = selectedOdds.some((item) => item.odd.id === odd.id);
          return (
            <button
              key={odd.id}
              onClick={() => { if (!isLiveOrFinished) handleSelectOdd(match, odd) }}
              disabled={isLiveOrFinished}
              className={`px-2 py-1 rounded-md text-[10px] font-extrabold transition-all duration-150 border flex items-center gap-1 min-w-[50px] min-h-[28px] justify-center ${
                isSelected
                  ? "bg-emerald-500 border-emerald-450 text-zinc-950 shadow-md shadow-emerald-500/20 scale-[1.02]"
                  : isLiveOrFinished
                  ? "bg-white/30 border-slate-200 text-zinc-600 opacity-50 cursor-not-allowed"
                  : "bg-white/60 hover:bg-zinc-850 border-slate-200 hover:border-zinc-750 text-slate-600 hover:text-zinc-150 cursor-pointer"
              }`}
            >
              <span className={`uppercase font-extrabold text-[8px] ${
                isSelected ? "text-zinc-950" : "text-slate-500"
              }`}>{betType.replace("MS ", "")}</span>
              <span className="font-mono text-[10px]">{odd.odd_value.toFixed(2)}</span>
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-300">
      {/* Top Navbar */}
      <header className="border-b border-slate-200 bg-white backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-black tracking-wider bg-gradient-to-r from-emerald-400 via-teal-400 to-indigo-400 bg-clip-text text-transparent drop-shadow-[0_0_15px_rgba(52,211,153,0.15)]">
              FOKOLİK
            </span>
            <span className="text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-600 border border-slate-300 font-mono">
              PARLAY V3
            </span>
          </div>

          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-4">
                {/* Balance Card */}
                <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-inner shadow-black/40">
                  <Coins className="w-5 h-5 text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
                  <span className="font-mono font-bold text-emerald-300">
                    {user.coin_balance.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-xs font-semibold text-slate-500">Coin</span>
                </div>
                
                {/* Username & Log Out */}
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-slate-700">@{user.username}</span>
                  <button 
                    onClick={handleLogOut}
                    className="p-2 hover:bg-slate-100 text-slate-600 hover:text-rose-400 rounded-lg transition-colors border border-transparent hover:border-slate-300 cursor-pointer"
                    title="Çıkış Yap"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleAuth} className="flex items-center gap-2">
                <input 
                  type="text" 
                  placeholder="Kullanıcı Adı"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  className="bg-white border border-slate-200 focus:border-indigo-500 focus:outline-none px-3 py-1.5 rounded-lg text-sm text-slate-900 placeholder-zinc-500 transition-colors w-40 sm:w-48"
                  disabled={loading}
                />
                <button 
                  type="submit"
                  disabled={loading}
                  className="bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-medium text-sm px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all shadow-md shadow-indigo-950/50 hover:shadow-indigo-500/20 disabled:opacity-50 cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Giriş / Kayıt</span>
                </button>
              </form>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left/Middle Column - Bulletin & User Slips */}
        <div className="lg:col-span-2 flex flex-col gap-8">
          
          {/* Status Message for Not Logged In */}
          {!user && (
            <div className="bg-gradient-to-r from-indigo-950/30 to-zinc-900/60 border border-indigo-900/40 p-6 rounded-2xl flex items-start gap-4">
              <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-400 border border-indigo-500/20">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 mb-1">Futbol Bahis Simülasyonuna Hoş Geldiniz!</h2>
                <p className="text-slate-600 text-sm leading-relaxed">
                  Lütfen yukarıdan bir kullanıcı adı girerek giriş yapın. Sistem otomatik olarak hesabınıza <strong>1000 Coin</strong> bakiye tanımlayacaktır. İstediğiniz maçları kombine ederek kendi bahis kuponunuzu oluşturun!
                </p>
              </div>
            </div>
          )}

          {/* Error / Success Alerts */}
          {error && (
            <div className="bg-rose-950/40 border border-rose-500/20 text-rose-300 p-4 rounded-xl flex items-center gap-2.5">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
              <span className="text-sm font-medium">{error}</span>
            </div>
          )}

          {success && (
            <div className="bg-emerald-950/40 border border-emerald-500/20 text-emerald-300 p-4 rounded-xl flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span className="text-sm font-medium">{success}</span>
            </div>
          )}

          {/* Bulletin Board */}
          <section className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 border-b border-slate-200 pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-6 bg-emerald-500 rounded-full"></div>
                  <h2 className="text-xl font-bold tracking-tight">Güncel Maç Bülteni</h2>
                </div>
                <button 
                  onClick={() => fetchBulletin(selectedDate)}
                  className="text-xs text-slate-500 hover:text-slate-700 transition-colors underline cursor-pointer"
                >
                  Yenile
                </button>
              </div>

              {/* Main Tabs (Canlı / Yaklaşan) */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setActiveMainTab("live")}
                  className={`flex-1 sm:flex-none px-6 py-2 rounded-xl font-bold text-sm transition-all cursor-pointer border flex items-center justify-center gap-2 ${
                    activeMainTab === "live"
                      ? "bg-rose-600 border-rose-500 text-white shadow-md shadow-rose-900/30 scale-[1.02]"
                      : "bg-white border-slate-200 text-slate-600 hover:text-slate-800 hover:bg-slate-100/60"
                  }`}
                >
                  <span className="relative flex h-2.5 w-2.5">
                    {activeMainTab === "live" && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>}
                    <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${activeMainTab === "live" ? "bg-white" : "bg-zinc-500"}`}></span>
                  </span>
                  Canlı Maçlar
                </button>
                <button
                  onClick={() => setActiveMainTab("upcoming")}
                  className={`flex-1 sm:flex-none px-6 py-2 rounded-xl font-bold text-sm transition-all cursor-pointer border flex items-center justify-center gap-2 ${
                    activeMainTab === "upcoming"
                      ? "bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-900/30 scale-[1.02]"
                      : "bg-white border-slate-200 text-slate-600 hover:text-slate-800 hover:bg-slate-100/60"
                  }`}
                >
                  Yaklaşan Maçlar
                </button>
              </div>

              {/* Yatay Tarih Şeridi (Calendar Date Filter Strip) - Only visible if upcoming */}
              {activeMainTab === "upcoming" && (
                <div className="flex gap-2 pt-3 overflow-x-auto pb-1 no-scrollbar animate-slide-in">
                  {getDateTabs().map((tab) => {
                    const isSelected = selectedDate === tab.value;
                    return (
                      <button
                        key={tab.label}
                        onClick={() => setSelectedDate(tab.value)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer border ${
                          isSelected
                            ? "bg-indigo-600 border-indigo-500 text-slate-900 shadow-md shadow-indigo-950/30 scale-[1.02]"
                            : "bg-white border-slate-200 text-slate-600 hover:text-slate-800"
                        }`}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {matches.length === 0 ? (
              <div className="bg-white border border-slate-200/60 rounded-xl p-12 text-center text-slate-500">
                <HelpCircle className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                <p>Seçilen tarihte aktif bülten bulunamadı.</p>
                <p className="text-xs text-zinc-600 mt-1">Takvimden başka bir günü seçebilir veya tüm maçları inceleyebilirsiniz.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                {Object.entries(getGroupedMatches()).map(([league, leagueMatches]) => (
                  <div key={league} className="league-container flex flex-col">
                    {/* League Header Strip */}
                    <div className="league-header flex items-center justify-between px-4 py-3 shadow-sm">
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs font-extrabold text-slate-900 tracking-wider uppercase">
                          {league}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-600 font-bold uppercase">
                        {leagueMatches.length} Maç
                      </span>
                    </div>

                    {/* Matches List in League */}
                    <div className="p-3.5 flex flex-col gap-3.5">
                      {leagueMatches.map((match) => {
                        const isExpanded = expandedMatches[match.id];
                        return (
                          <div 
                            key={match.id}
                            className="bg-slate-50/40 border border-slate-200/80 hover:border-slate-200 rounded-xl p-4 transition-all duration-200 shadow-sm flex flex-col gap-3.5"
                          >
                            {/* Match Card Top Segment: Teams & MS Odds + Toggle */}
                            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                              {/* Match Info & Teams */}
                              <div className="flex-1">
                                <div className="flex items-center flex-wrap gap-2 text-xs text-slate-500 font-bold mb-2">
                                  <span className="bg-white px-1.5 py-0.5 rounded text-slate-600 font-mono text-[9px]">{match.id}</span>
                                  {match.status === "finished" ? (
                                    <span className="bg-slate-100 text-slate-600 border border-slate-300 px-1.5 py-0.5 rounded text-[9px] font-bold">MS</span>
                                  ) : match.status !== "not_started" ? (
                                    <span className="bg-rose-500/10 text-rose-400 border border-rose-500/20 px-1.5 py-0.5 rounded text-[9px] font-bold flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                                      CANLI
                                    </span>
                                  ) : null}
                                  <div className="flex items-center gap-1">
                                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                    <span>{formatDate(match.start_date)}</span>
                                  </div>
                                  {match.status !== "not_started" && match.status !== "finished" && match.minute && (
                                    <span className="text-emerald-400 font-semibold">{match.minute}</span>
                                  )}
                                  {match.status !== "not_started" && (match.ht_home_score > 0 || match.ht_away_score > 0 || match.status === "half_time" || match.status === "finished") && (
                                    <span className="text-[10px] text-slate-500 font-mono">
                                      (İY: {match.ht_home_score}-{match.ht_away_score})
                                    </span>
                                  )}
                                </div>
                                
                                <div className="text-sm font-bold text-slate-900 flex items-center gap-3">
                                  <span className={`w-2/5 text-left truncate ${flashMatches[match.id]?.home ? "animate-flash-score-home" : ""}`}>{match.home_team}</span>
                                  {match.status !== "not_started" ? (
                                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg font-mono text-slate-900 text-xs font-extrabold shadow-inner">
                                      <span className={flashMatches[match.id]?.home ? "text-emerald-400 scale-125 transition-all inline-block" : ""}>{match.home_score}</span>
                                      <span className="text-slate-400">:</span>
                                      <span className={flashMatches[match.id]?.away ? "text-emerald-400 scale-125 transition-all inline-block" : ""}>{match.away_score}</span>
                                    </div>
                                  ) : (
                                    <span className="text-slate-400 font-normal text-xs px-2 shrink-0">vs</span>
                                  )}
                                  <span className={`w-2/5 text-left truncate ${flashMatches[match.id]?.away ? "animate-flash-score-away" : ""}`}>{match.away_team}</span>
                                </div>
                              </div>

                              {/* MS Odds + Expand Button Row */}
                              <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                                {/* Maç Sonucu Odds */}
                                {renderOddsGroupCompact(match, ["MS 1", "MS 0", "MS 2"])}

                                {/* Details Toggle Button */}
                                <button
                                  onClick={() => toggleMatchDetails(match.id)}
                                  className={`px-3 py-2 rounded-lg border transition-all duration-150 flex items-center gap-1.5 cursor-pointer text-xs font-bold ${
                                    isExpanded
                                      ? "bg-slate-100 border-slate-300 text-slate-900"
                                      : "bg-white/60 border-slate-200 hover:border-zinc-750 text-slate-600 hover:text-slate-800"
                                  }`}
                                >
                                  <span>{isExpanded ? "Bahisleri Gizle" : "Diğer Bahisler"}</span>
                                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                </button>
                              </div>
                            </div>

                            {/* Expanded Market Details */}
                            {isExpanded && (
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 border-t border-slate-200/60 pt-3.5 animate-slide-in">
                                {renderOddsGroup(match, "İlk Yarı Sonucu", ["İY 1", "İY 0", "İY 2"])}
                                {renderOddsGroup(match, "Alt/Üst (2.5)", ["2.5 Alt", "2.5 Üst"])}
                                {renderOddsGroup(match, "Karşılıklı Gol", ["KG Var", "KG Yok"])}
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
          </section>

          {/* User Parlay Slips History */}
          {user && (
            <section className="flex flex-col gap-4">
              <div className="flex flex-col gap-3 border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-6 bg-indigo-500 rounded-full"></div>
                  <h2 className="text-xl font-bold tracking-tight">Kuponlarım & Bahis Geçmişi</h2>
                </div>

                {/* Kupon Geçmişi Durum Sekmeleri (Status Tabs) */}
                <div className="flex flex-wrap gap-2 pt-1">
                  {[
                    { id: "all", label: "Tümü" },
                    { id: "pending", label: "Bekleyenler" },
                    { id: "settled", label: "Sonuçlananlar" },
                    { id: "cancelled", label: "İptaller" }
                  ].map((tab) => {
                    const isActive = activeHistoryTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => {
                          setActiveHistoryTab(tab.id);
                          if (tab.id === "settled" || tab.id === "all") {
                            setUnseenSettledCount(0);
                          }
                        }}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer border flex items-center gap-1.5 ${
                          isActive
                            ? "bg-slate-100 border-zinc-750 text-slate-900"
                            : "bg-transparent border-transparent text-slate-500 hover:text-slate-600"
                        }`}
                      >
                        <span>{tab.label}</span>
                        {tab.id === "settled" && unseenSettledCount > 0 && (
                          <span className="bg-rose-500 text-white font-mono text-[10px] w-4 h-4 rounded-full flex items-center justify-center animate-pulse">
                            {unseenSettledCount}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {filteredSlips.length === 0 ? (
                <div className="bg-white border border-slate-200/40 rounded-xl p-8 text-center text-slate-400">
                  <Receipt className="w-6 h-6 mx-auto mb-2 text-slate-400" />
                  <p className="text-sm">Bu filtreye uygun kupon bulunamadı.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {filteredSlips.map((slip) => {
                    const isExpanded = !!expandedSlips[slip.id];
                    const cancelable = isSlipCancelable(slip);
                    const winnings = (slip.amount * slip.total_odd).toFixed(2);
                    
                    return (
                      <div 
                        key={slip.id} 
                        className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm"
                      >
                        {/* Accordion Header */}
                        <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border-b border-slate-200/50">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => toggleAccordion(slip.id)}
                              className="text-slate-500 hover:text-slate-700 transition-colors p-1 rounded hover:bg-slate-100 cursor-pointer"
                            >
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                            <div>
                              <span className="font-mono font-semibold text-slate-500 text-xs block">KUPON #{slip.id}</span>
                              <span className="text-[11px] text-slate-500">{formatDate(slip.created_at)}</span>
                            </div>
                            <span className="px-2 py-0.5 bg-slate-100 border border-zinc-750 rounded text-xs text-indigo-400 font-bold font-mono">
                              {slip.selections.length} Maç
                            </span>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-6">
                            {/* Summary Values */}
                            <div className="flex items-center gap-4 text-xs font-mono">
                              <div>
                                <span className="text-slate-500 block text-[10px] uppercase">Tutar</span>
                                <span className="font-bold text-slate-700">{slip.amount} Coin</span>
                              </div>
                              <div>
                                <span className="text-slate-500 block text-[10px] uppercase">Oran</span>
                                <span className="font-bold text-slate-600">{slip.total_odd.toFixed(2)}</span>
                              </div>
                              <div>
                                <span className="text-slate-500 block text-[10px] uppercase">Kazanç</span>
                                <span className="font-bold text-emerald-400">{winnings} Coin</span>
                              </div>
                            </div>

                            {/* Status and Action */}
                            <div className="flex items-center gap-3">
                              {slip.status === "pending" && (
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                                  Beklemede
                                </span>
                              )}
                              {slip.status === "won" && (
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                  Kazanıldı
                                </span>
                              )}
                              {slip.status === "lost" && (
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                  Kaybedildi
                                </span>
                              )}
                              {slip.status === "cancelled" && (
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-500 border border-slate-300">
                                  İptal Edildi
                                </span>
                              )}

                              {cancelable && (
                                <button
                                  onClick={() => handleCancelSlip(slip.id)}
                                  className="text-xs bg-rose-600/10 hover:bg-rose-600 hover:text-white border border-rose-500/20 text-rose-400 font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer"
                                >
                                  İptal Et
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Accordion Selections Details */}
                        {isExpanded && (
                          <div className="bg-slate-50/40 p-3 flex flex-col gap-1.5">
                            {slip.selections.map((sel) => {
                              const d = sel.odd_details;
                              return (
                                <div 
                                  key={sel.id} 
                                  className={`py-2.5 px-3 border border-slate-200/60 rounded-xl flex items-center justify-between text-xs gap-4 transition-all ${
                                    sel.status === "won"
                                      ? "bg-emerald-500/5 border-emerald-500/10 text-emerald-300"
                                      : sel.status === "lost"
                                      ? "bg-rose-500/5 border-rose-500/10 text-rose-350"
                                      : d?.match_status !== "not_started" && d?.match_status !== "finished"
                                      ? "bg-amber-500/5 border-amber-500/20 text-amber-300"
                                      : "bg-white/10 border-transparent text-slate-600"
                                  }`}
                                >
                                  <div>
                                    {d ? (
                                      <div>
                                        <div className="flex items-center gap-2">
                                          <span className="font-bold">{d.home_team} vs {d.away_team}</span>
                                          {d.match_status !== "not_started" && (
                                            <span className="font-mono bg-slate-50 px-1.5 py-0.5 rounded text-[11px] border border-slate-200 text-slate-900 font-extrabold shadow-inner shrink-0">
                                              {d.home_score} - {d.away_score}
                                            </span>
                                          )}
                                          {d.match_status !== "not_started" && d.match_status !== "finished" && d.minute && (
                                            <span className="text-[10px] text-rose-450 font-bold shrink-0 animate-pulse">{d.minute}</span>
                                          )}
                                        </div>
                                        <span className="text-[10px] text-slate-500 block mt-0.5">{formatDate(d.start_date)}</span>
                                      </div>
                                    ) : (
                                      <span className="text-slate-400 font-mono">Bilinmeyen Maç</span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3 shrink-0">
                                    <span className="bg-white text-indigo-300 border border-slate-200/85 px-2 py-0.5 rounded font-bold uppercase tracking-wider text-[10px]">
                                      {d?.bet_type || "N/A"}
                                    </span>
                                    <span className="font-mono font-bold">@{d?.odd_value.toFixed(2) || "0.00"}</span>
                                    
                                    {sel.status === "pending" && (
                                      <span className="px-2 py-0.5 bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 rounded-lg text-[10px] font-bold">
                                        Bekliyor
                                      </span>
                                    )}
                                    {sel.status === "won" && (
                                      <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg text-[10px] font-bold">
                                        Kazandı
                                      </span>
                                    )}
                                    {sel.status === "lost" && (
                                      <span className="px-2 py-0.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-lg text-[10px] font-bold">
                                        Kaybetti
                                      </span>
                                    )}
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
            </section>
          )}

        </div>

        <div className="lg:col-span-1">
          <div className="bg-white/30 border border-slate-200 rounded-2xl p-6 sticky top-24 shadow-md shadow-black/25">
            <h3 className="text-lg font-bold text-slate-900 border-b border-slate-200 pb-3 mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-indigo-400" />
                <span>Bahis Kuponu</span>
              </div>
              {selectedOdds.length > 0 && (
                <span className="text-xs bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-full font-bold font-mono">
                  {selectedOdds.length} Seçim
                </span>
              )}
            </h3>

            {selectedOdds.length > 0 ? (
              <div className="flex flex-col gap-4">
                
                {/* Selections List */}
                <div className="flex flex-col gap-2 max-h-[280px] overflow-y-auto pr-1">
                  {selectedOdds.map(({ match, odd }) => (
                    <div 
                      key={match.id} 
                      className="bg-slate-50 border border-slate-200 p-3 rounded-lg flex items-start justify-between gap-3 text-xs"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] text-slate-500 mb-0.5 truncate">
                          Kod: {match.id} | {formatDate(match.start_date)}
                        </div>
                        <div className="font-bold text-slate-800 truncate mb-1">
                          {match.home_team} - {match.away_team}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-indigo-400 font-bold uppercase">{odd.bet_type}</span>
                          <span className="text-zinc-660">@</span>
                          <span className="text-emerald-400 font-mono font-bold">{odd.odd_value.toFixed(2)}</span>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => handleRemoveSelection(match.id)}
                        className="text-zinc-600 hover:text-rose-400 transition-colors p-1 rounded hover:bg-white cursor-pointer"
                        title="Seçimi Kaldır"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Combined Totals */}
                <div className="border-t border-slate-200 pt-4 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-semibold">Toplam Oran:</span>
                    <span className="font-mono font-bold text-emerald-400 text-sm">
                      {formattedTotalOdd}
                    </span>
                  </div>

                  {/* Bet Amount Input */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Kupon Tutarı</label>
                    <div className="relative">
                      <input
                        type="number"
                        min="1"
                        placeholder="Tutar girin"
                        value={betAmount}
                        onChange={(e) => setBetAmount(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:outline-none px-4 py-2 pl-9 rounded-xl font-mono text-slate-900 text-base transition-colors"
                      />
                      <Coins className="w-4 h-4 text-zinc-600 absolute left-3 top-3" />
                      <span className="absolute right-3 top-2.5 text-xs text-slate-500 font-bold">Coin</span>
                    </div>
                  </div>

                  {/* Potential Win display */}
                  <div className="bg-emerald-500/5 border border-emerald-500/10 p-3.5 rounded-xl flex items-center justify-between mt-1">
                    <div>
                      <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider">Maksimum Kazanç</span>
                      <span className="text-lg font-mono font-extrabold text-emerald-400">
                        {potentialWinnings}
                      </span>
                    </div>
                    <Coins className="w-7 h-7 text-emerald-400/20" />
                  </div>
                </div>

                {/* Place Bet Button */}
                <button
                  onClick={handlePlaceSlip}
                  disabled={loading}
                  className="w-full bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-zinc-950 font-bold py-3 rounded-xl transition-all shadow-lg shadow-emerald-950/20 hover:shadow-emerald-500/10 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Plus className="w-5 h-5 text-zinc-950" />
                  <span>Kuponu Yatır</span>
                </button>
              </div>
            ) : (
              <div className="text-center py-12 text-zinc-600 border-2 border-dashed border-slate-200 rounded-xl">
                <HelpCircle className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                <p className="text-sm font-semibold text-slate-500">Kuponunuz boş.</p>
                <p className="text-xs text-slate-400 mt-1 max-w-[200px] mx-auto leading-relaxed">
                  Bültenden oranlara tıklayarak maç kombine edin. Farklı maçlardan birden fazla seçim ekleyebilirsiniz.
                </p>
              </div>
            )}
          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-slate-50/50 py-6 text-center text-xs text-slate-400 mt-auto">
        <p>© 2026 Fokolik Futbol Bahis Simülasyonu. Tüm hakları saklıdır.</p>
        <p className="mt-1 text-[10px] text-slate-400">Bu bir simülasyon oyunudur, gerçek para kullanılmaz.</p>
      </footer>

      {/* Toast Notifications */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`p-4 rounded-xl shadow-lg border text-sm flex items-start justify-between gap-3 animate-slide-in ${
              toast.type === "success"
                ? "bg-emerald-950 border-emerald-500/30 text-emerald-250 font-medium"
                : toast.type === "error"
                ? "bg-rose-950 border-rose-500/30 text-rose-250 font-medium"
                : "bg-white border-slate-200 text-zinc-150"
            }`}
          >
            <div className="flex-1">
              {toast.message}
            </div>
            <button
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
              className="text-slate-500 hover:text-slate-700 text-base font-bold font-mono leading-none cursor-pointer"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {/* Sticky Footer for Active Slips */}
      {user && (
        <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end pointer-events-none">
          {/* Drawer Content */}
          <div className={`w-full max-w-sm sm:max-w-md bg-slate-50 border border-slate-200 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] transition-all duration-300 overflow-hidden pointer-events-auto ${isFooterDrawerOpen ? "max-h-[60vh] overflow-y-auto opacity-100 mb-3" : "max-h-0 opacity-0 mb-0 border-transparent"}`}>
             <div className="p-4 flex flex-col gap-3">
               <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-2 sticky top-0 bg-slate-50 z-10 pt-2">
                 <h3 className="text-slate-900 font-bold flex items-center gap-2">
                   <Clock className="w-5 h-5 text-emerald-400"/>
                   Aktif Kuponlar (Canlı Takip)
                 </h3>
                 <button onClick={() => setIsFooterDrawerOpen(false)} className="text-slate-500 hover:text-slate-700 cursor-pointer">
                   <XCircle className="w-6 h-6"/>
                 </button>
               </div>
               
               {slips.filter(s => s.status === 'pending').length === 0 ? (
                 <div className="text-center text-slate-500 py-8 text-sm">Bekleyen kuponunuz bulunmuyor.</div>
               ) : (
                 <div className="flex flex-col gap-4">
                   {slips.filter(s => s.status === 'pending').map(slip => (
                      <div key={slip.id} className="bg-white border border-slate-200 rounded-xl p-4">
                        <div className="flex justify-between items-center mb-3">
                          <span className="font-mono text-xs text-slate-600 font-bold">KUPON #{slip.id}</span>
                          <span className="text-sm font-bold text-indigo-400">{slip.amount} Coin &rarr; <span className="text-emerald-400">{(slip.amount * slip.total_odd).toFixed(2)} Coin</span></span>
                        </div>
                        <div className="flex flex-col gap-2">
                          {slip.selections.map(sel => {
                            const d = sel.odd_details;
                            return (
                              <div key={sel.id} className="flex flex-col sm:flex-row sm:items-center justify-between bg-slate-50/50 border border-slate-200 rounded-lg p-2.5 text-xs gap-2">
                                <div className="flex items-center gap-2 font-bold text-slate-800">
                                  <span>{d?.home_team} vs {d?.away_team}</span>
                                  {d?.match_status !== "not_started" && (
                                    <span className="font-mono bg-white px-2 py-0.5 rounded border border-slate-300 text-slate-900 font-extrabold shadow-inner shrink-0 text-[11px]">
                                      <span className={flashMatches[d?.match_id]?.home ? "text-emerald-400 inline-block transition-all scale-125" : ""}>{d?.home_score || 0}</span>
                                      <span className="mx-1">-</span>
                                      <span className={flashMatches[d?.match_id]?.away ? "text-emerald-400 inline-block transition-all scale-125" : ""}>{d?.away_score || 0}</span>
                                    </span>
                                  )}
                                  {d?.match_status !== "not_started" && d?.match_status !== "finished" && d?.minute && (
                                    <span className="text-[10px] text-rose-450 font-bold shrink-0 animate-pulse">{d.minute}</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 justify-end sm:justify-start">
                                  <span className="text-[9px] font-bold uppercase text-slate-500 bg-white px-2 py-1 rounded">{d?.bet_type}</span>
                                  <span className="font-mono font-bold text-emerald-400">@{d?.odd_value.toFixed(2)}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                   ))}
                 </div>
               )}
             </div>
          </div>
          
          {/* Sticky Tab */}
          <button 
             onClick={() => setIsFooterDrawerOpen(!isFooterDrawerOpen)}
             className="bg-white/95 backdrop-blur-md border border-slate-300/50 px-6 py-3 rounded-2xl text-slate-900 font-bold text-sm shadow-[0_4px_25px_rgba(0,0,0,0.8)] flex items-center gap-2 hover:bg-slate-100 transition-colors cursor-pointer pointer-events-auto"
          >
             <span className="relative flex h-3 w-3 mr-1">
               <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
               <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
             </span>
             {slips.filter(s => s.status === 'pending').length} Aktif Kupon
             {isFooterDrawerOpen ? <ChevronDown className="w-5 h-5 ml-1 text-slate-600"/> : <ChevronUp className="w-5 h-5 ml-1 text-slate-600"/>}
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
