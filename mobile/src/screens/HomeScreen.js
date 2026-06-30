import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiService } from '../api/api';
import { useMatchStore } from '../store/useMatchStore';
import { useAuthStore } from '../store/useAuthStore';
import MatchCard from '../components/MatchCard';
import BetSlip from '../components/BetSlip';
import AuthModal from '../components/AuthModal';

const getDateTabs = () => {
  const tabs = [];
  const now = new Date();
  for (let i = 0; i < 3; i++) {
    const d = new Date();
    d.setDate(now.getDate() + i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const label = d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', weekday: 'short' });
    tabs.push({ label, value: `${yyyy}-${mm}-${dd}` });
  }
  return tabs;
};

export default function HomeScreen() {
  const matches = useMatchStore((state) => state.matches);
  const setMatches = useMatchStore((state) => state.setMatches);
  const updateMatches = useMatchStore((state) => state.updateMatches);
  const user = useAuthStore(s => s.user);

  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [authModalVisible, setAuthModalVisible] = useState(false);

  const dateTabs = getDateTabs();

  useEffect(() => {
    fetchBulletin();

    // Setup WebSocket for live score updates
    const ws = apiService.connectWebSocket((msg) => {
      if (msg.type === 'match_updates') {
        updateMatches(msg.data);
      }
    });

    return () => {
      if (ws && ws.close) ws.close();
    };
  }, [selectedDate]);

  const fetchBulletin = async () => {
    setLoading(true);
    try {
      const data = await apiService.getMatches(selectedDate);
      setMatches(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const upcomingMatches = matches.filter(m => m.status === 'not_started');
  const liveMatches = matches.filter(m => ['live', 'half_time', 'live_1h', 'live_2h'].includes(m.status));
  const finishedMatches = matches.filter(m => m.status === 'finished');

  const sections = [];
  if (liveMatches.length > 0) sections.push({ type: 'section', id: 'live-header', title: '🔴 Canlı Maçlar' }, ...liveMatches.map(m => ({ type: 'match', ...m })));
  if (upcomingMatches.length > 0) sections.push({ type: 'section', id: 'upcoming-header', title: '📅 Yaklaşan Maçlar' }, ...upcomingMatches.map(m => ({ type: 'match', ...m })));
  if (finishedMatches.length > 0) sections.push({ type: 'section', id: 'finished-header', title: '✅ Biten Maçlar' }, ...finishedMatches.map(m => ({ type: 'match', ...m })));

  return (
    <SafeAreaView style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>Fokolik Bülten</Text>
        {user ? null : (
          <TouchableOpacity style={s.loginBtn} onPress={() => setAuthModalVisible(true)}>
            <Text style={s.loginBtnTxt}>Giriş Yap</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Date Tabs */}
      <View style={s.dateTabs}>
        {dateTabs.map(tab => (
          <TouchableOpacity
            key={tab.value}
            style={[s.dateTab, selectedDate === tab.value && s.dateTabActive]}
            onPress={() => setSelectedDate(tab.value)}
          >
            <Text style={[s.dateTabTxt, selectedDate === tab.value && s.dateTabTxtActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#4f46e5" style={{ marginTop: 24 }} />
      ) : sections.length === 0 ? (
        <Text style={s.emptyText}>Bu tarih için maç bulunamadı.</Text>
      ) : (
        <FlatList
          data={sections}
          keyExtractor={item => item.id?.toString() || item.type + item.id}
          renderItem={({ item }) => {
            if (item.type === 'section') {
              return (
                <View style={s.sectionHeader}>
                  <Text style={s.sectionTitle}>{item.title}</Text>
                </View>
              );
            }
            return <MatchCard match={item} />;
          }}
          contentContainerStyle={{ paddingBottom: 120 }}
        />
      )}

      <BetSlip />

      <AuthModal visible={authModalVisible} onClose={() => setAuthModalVisible(false)} />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  title: { fontSize: 20, fontWeight: 'bold', color: '#1e293b' },
  loginBtn: {
    backgroundColor: '#4f46e5',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
  },
  loginBtnTxt: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  dateTabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 6,
  },
  dateTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
  },
  dateTabActive: {
    backgroundColor: '#4f46e5',
  },
  dateTabTxt: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  dateTabTxtActive: { color: '#fff' },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#475569',
  },
  emptyText: {
    textAlign: 'center',
    color: '#94a3b8',
    marginTop: 40,
    fontSize: 15,
  },
});
