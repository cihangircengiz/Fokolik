import { useState, useEffect, useContext } from "react";
import { useNavigate, Link } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { API_BASE_URL } from "../services/api";

export default function Battles() {
  const { token } = useContext(AuthContext);
  const [publicBattles, setPublicBattles] = useState([]);
  const [myBattles, setMyBattles] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [inviteCodeInput, setInviteCodeInput] = useState("");
  const [activeTab, setActiveTab] = useState("today");
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, [token]);

  const fetchData = async () => {
    try {
      const headers = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      
      const promises = [
        fetch(`${API_BASE_URL}/battles/public`, { headers }),
        token ? fetch(`${API_BASE_URL}/battles/my`, { headers }) : Promise.resolve(null),
        fetch(`${API_BASE_URL}/battles/leaderboard`, { headers })
      ];
      
      const [pubRes, myRes, leadRes] = await Promise.all(promises);
      
      const pubData = pubRes && pubRes.ok ? await pubRes.json() : [];
      const myData = myRes && myRes.ok ? await myRes.json() : [];
      const leadData = leadRes && leadRes.ok ? await leadRes.json() : [];

      setPublicBattles(pubData);
      setMyBattles(myData);
      setLeaderboard(leadData);
    } catch (err) {
      console.error("Error fetching battles data", err);
    }
  };

  const handleJoinPrivate = (e) => {
    e.preventDefault();
    if (!inviteCodeInput.trim()) return;
    navigate(`/battles/${inviteCodeInput.trim().toUpperCase()}`);
  };

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      <div className="flex flex-col md:flex-row justify-between items-center bg-white dark:bg-slate-900/40 p-6 rounded-2xl border border-slate-200 dark:border-slate-700/50 backdrop-blur-md transition-colors duration-200 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Düellolar (Battles)</h1>
          <p className="text-slate-650 dark:text-slate-400">Diğer kullanıcılarla yarış, itibar kazan ve ay sonu büyük ödülü kap!</p>
        </div>
        <form onSubmit={handleJoinPrivate} className="flex gap-2 w-full md:w-auto">
          <input
            type="text"
            placeholder="Davet Kodu (Örn: A1B2C3D4)"
            className="w-full md:w-auto bg-white dark:bg-slate-900/60 border border-slate-250 dark:border-slate-600 text-slate-900 dark:text-white px-4 py-2 rounded-xl focus:outline-none focus:border-indigo-500 transition-colors uppercase"
            value={inviteCodeInput}
            onChange={(e) => setInviteCodeInput(e.target.value)}
          />
          <button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-xl font-bold transition-colors shadow-lg shadow-indigo-500/20 cursor-pointer whitespace-nowrap">
            Katıl
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Sol Taraf: Lobi ve Benim Düellolarım */}
        <div className="lg:col-span-2 space-y-8">
          <div className="flex gap-6 border-b border-slate-200 dark:border-slate-700/50">
            <button 
              onClick={() => setActiveTab('today')}
              className={`pb-3 px-2 font-bold text-lg transition-colors relative ${activeTab === 'today' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
            >
              Bugün
              {activeTab === 'today' && <div className="absolute bottom-[-1px] left-0 w-full h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-t-full"></div>}
            </button>
            <button 
              onClick={() => setActiveTab('past')}
              className={`pb-3 px-2 font-bold text-lg transition-colors relative ${activeTab === 'past' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
            >
              Geçmiş
              {activeTab === 'past' && <div className="absolute bottom-[-1px] left-0 w-full h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-t-full"></div>}
            </button>
          </div>

          {activeTab === 'today' ? (
            <>
              {/* Benim Düellolarım */}
              {myBattles.filter(b => b.status !== 'completed').length > 0 && (
            <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700/50 rounded-2xl p-6 backdrop-blur-md transition-colors duration-200">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <span className="text-indigo-500">⚔️</span> Benim Düellolarım
              </h2>
              <div className="grid gap-4">
                {myBattles.filter(b => b.status !== 'completed').map(b => (
                  <Link key={b.id} to={`/battles/${b.invite_code}`} className="block bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-xl p-4 transition-all hover:scale-[1.01]">
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="text-slate-900 dark:text-white font-bold mb-1">Düello: {b.invite_code}</div>
                        <div className="text-sm text-slate-500 dark:text-slate-400">{b.matches.length} Maç • <span className={`font-semibold ${b.status === 'started' ? 'text-amber-500' : 'text-emerald-500'}`}>{b.status === 'active' ? 'Açık (Katılım Bekleniyor)' : 'Başladı (Oynanıyor)'}</span></div>
                      </div>
                      <div className="text-indigo-600 dark:text-indigo-400 font-bold">
                        Görüntüle ➔
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Genel Lobi */}
          <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700/50 rounded-2xl p-6 backdrop-blur-md transition-colors duration-200">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <span className="text-indigo-500">🌍</span> Herkese Açık Lobi
            </h2>
            {publicBattles.filter(b => b.status !== 'completed').length === 0 ? (
              <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                Şu an açık bir düello yok. Ana sayfadan maç seçerek sen başlat!
              </div>
            ) : (
              <div className="grid gap-4">
                {publicBattles.filter(b => b.status !== 'completed').map(b => (
                  <Link key={b.id} to={`/battles/${b.invite_code}`} className="block bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-xl p-4 transition-all hover:scale-[1.01]">
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-slate-900 dark:text-white font-bold">{b.creator_username}</span>
                          <span className="text-xs text-slate-550 dark:text-slate-400 px-2 py-0.5 bg-slate-200/50 dark:bg-slate-800 rounded-full">Kurucu</span>
                        </div>
                        <div className="text-sm text-slate-500 dark:text-slate-400">
                          {b.matches.length} Maç seçildi • {b.max_participants ? `${b.participants.length}/${b.max_participants} Kişi` : 'Limitsiz'}
                        </div>
                      </div>
                      <div className="text-indigo-600 dark:text-indigo-400 font-bold">
                        Meydan Oku ➔
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
            </>
          ) : (
            <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700/50 rounded-2xl p-6 backdrop-blur-md transition-colors duration-200">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <span className="text-slate-500">📜</span> Geçmiş Düellolarım
              </h2>
              {myBattles.filter(b => b.status === 'completed').length === 0 ? (
                <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                  Henüz tamamlanmış bir düellon yok.
                </div>
              ) : (
                <div className="grid gap-4">
                  {myBattles.filter(b => b.status === 'completed').map(b => (
                    <Link key={b.id} to={`/battles/${b.invite_code}`} className="block bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-xl p-4 transition-all hover:scale-[1.01]">
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="text-slate-900 dark:text-white font-bold mb-1">Düello: {b.invite_code}</div>
                          <div className="text-sm text-slate-500 dark:text-slate-400">{b.matches.length} Maç • <span className="text-slate-500 font-semibold">Tamamlandı</span></div>
                        </div>
                        <div className="text-indigo-600 dark:text-indigo-400 font-bold">
                          Görüntüle ➔
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sağ Taraf: Leaderboard */}
        <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700/50 rounded-2xl p-6 backdrop-blur-md self-start sticky top-6 transition-colors duration-200">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-1 flex items-center justify-center gap-2">
              <span className="text-yellow-400">👑</span> Ayın En İyileri
            </h2>
            <p className="text-sm text-slate-550 dark:text-slate-400">Ay sonu ilk 2'ye devasa Coin ödülü!</p>
          </div>
          
          <div className="space-y-3">
            {leaderboard.length === 0 ? (
              <div className="text-center py-4 text-slate-500 dark:text-slate-400 text-sm">
                Henüz kimse puan kazanmadı.
              </div>
            ) : (
              leaderboard.map((user, index) => (
                <Link key={user.user_id} to={`/users/${user.username}`} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors border border-slate-200 dark:border-slate-700/30">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                      index === 0 ? 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border border-yellow-500/50' : 
                      index === 1 ? 'bg-slate-200 text-slate-650 dark:bg-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-600' : 
                      index === 2 ? 'bg-orange-400/20 text-orange-600 dark:text-orange-400 border border-orange-400/50' : 
                      'bg-slate-300 dark:bg-slate-800 text-slate-550 dark:text-slate-400'
                    }`}>
                      {index + 1}
                    </div>
                    <div>
                      <div className="text-slate-900 dark:text-white font-semibold">{user.username}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{user.monthly_won_battles} galibiyet</div>
                    </div>
                  </div>
                  <div className="text-yellow-600 dark:text-yellow-400 font-bold bg-yellow-500/10 px-3 py-1 rounded-lg">
                    {user.reputation} Puan
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
