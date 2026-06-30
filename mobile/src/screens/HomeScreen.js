import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, SectionList, TouchableOpacity,
  ActivityIndicator, ScrollView, RefreshControl
} from 'react-native';
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
    const label = i === 0
      ? 'Bugün'
      : d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
    tabs.push({ label, value: `${yyyy}-${mm}-${dd}` });
  }
  return tabs;
};

export default function HomeScreen() {
  const matches = useMatchStore(s => s.matches);
  const setMatches = useMatchStore(s => s.setMatches);
  const updateMatches = useMatchStore(s => s.updateMatches);
  const user = useAuthStore(s => s.user);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [authModalVisible, setAuthModalVisible] = useState(false);
  const [flashMatches, setFlashMatches] = useState({});

  const dateTabs = getDateTabs();

  useEffect(() => {
    setLoading(true);
    fetchBulletin();

    const ws = apiService.connectWebSocket((msg) => {
      if (msg.type === 'match_updates') {
        // Flash animation on score change
        const current = useMatchStore.getState().matches;
        msg.data.forEach(update => {
          const m = current.find(x => x.id === update.id);
          if (m) {
            const homeChanged = update.home_score !== m.home_score;
            const awayChanged = update.away_score !== m.away_score;
            if (homeChanged || awayChanged) {
              setFlashMatches(prev => ({ ...prev, [m.id]: { home: homeChanged, away: awayChanged } }));
              setTimeout(() => {
                setFlashMatches(prev => { const c = { ...prev }; delete c[m.id]; return c; });
              }, 3000);
            }
          }
        });
        updateMatches(msg.data);
      }
    });

    return () => {
      if (ws && ws.close) ws.close();
    };
  }, [selectedDate]);

  const fetchBulletin = async () => {
    try {
      const data = await apiService.getMatches(selectedDate);
      setMatches(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchBulletin();
  }, [selectedDate]);

  // Group live matches + sort
  const liveMatches = matches.filter(m => ['live', 'half_time', 'live_1h', 'live_2h'].includes(m.status));
  const upcomingMatches = matches.filter(m => m.status === 'not_started');
  const finishedMatches = matches.filter(m => m.status === 'finished');

  // Group upcoming by league
  const groupedUpcoming = upcomingMatches.reduce((acc, m) => {
    const lg = m.league || 'Diğer Ligler';
    if (!acc[lg]) acc[lg] = [];
    acc[lg].push(m);
    return acc;
  }, {});

  // Sort leagues by earliest match
  const sortedLeagues = Object.entries(groupedUpcoming).sort((a, b) => {
    const ea = Math.min(...a[1].map(m => new Date(m.start_date)));
    const eb = Math.min(...b[1].map(m => new Date(m.start_date)));
    return ea - eb;
  });

  // Build SectionList data
  const sections = [];
  if (liveMatches.length > 0) {
    sections.push({ title: '🔴 Canlı Maçlar', data: liveMatches, key: 'live' });
  }
  sortedLeagues.forEach(([league, leagueMatches]) => {
    sections.push({ title: league, data: leagueMatches, key: `league-${league}` });
  });
  if (finishedMatches.length > 0) {
    sections.push({ title: '✅ Biten Maçlar', data: finishedMatches, key: 'finished' });
  }

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>Fokolik Bülten</Text>
        {!user && (
          <TouchableOpacity style={s.loginBtn} onPress={() => setAuthModalVisible(true)}>
            <Text style={s.loginBtnTxt}>Giriş Yap</Text>
          </TouchableOpacity>
        )}
        {user && (
          <View style={s.balancePill}>
            <Text style={s.balanceTxt}>
              💰 {(user.coin_balance ?? 0).toLocaleString('tr-TR', { maximumFractionDigits: 0 })}
            </Text>
          </View>
        )}
      </View>

      {/* Date Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.dateTabs}
        contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8, gap: 8 }}
      >
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
      </ScrollView>

      {loading ? (
        <ActivityIndicator size="large" color="#4f46e5" style={{ marginTop: 40 }} />
      ) : sections.length === 0 ? (
        <View style={s.emptyBox}>
          <Text style={s.emptyIcon}>📅</Text>
          <Text style={s.emptyTxt}>Bu tarih için maç bulunamadı.</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item, idx) => `${item.id}-${idx}`}
          renderItem={({ item }) => <MatchCard match={item} flashMatches={flashMatches} />}
          renderSectionHeader={({ section }) => (
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>{section.title}</Text>
              <Text style={s.sectionCount}>{section.data.length} maç</Text>
            </View>
          )}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{ paddingBottom: 120 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4f46e5" />
          }
        />
      )}

      <BetSlip />
      <AuthModal visible={authModalVisible} onClose={() => setAuthModalVisible(false)} />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0',
  },
  title: { fontSize: 20, fontWeight: 'bold', color: '#1e293b' },
  loginBtn: { backgroundColor: '#4f46e5', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8 },
  loginBtnTxt: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  balancePill: { backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  balanceTxt: { color: '#059669', fontWeight: 'bold', fontSize: 13 },
  dateTabs: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', flexGrow: 0 },
  dateTab: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, backgroundColor: '#f1f5f9' },
  dateTabActive: { backgroundColor: '#4f46e5' },
  dateTabTxt: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  dateTabTxtActive: { color: '#fff' },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6,
  },
  sectionTitle: { fontSize: 13, fontWeight: 'bold', color: '#334155', flex: 1 },
  sectionCount: { fontSize: 11, color: '#94a3b8', fontWeight: '600' },
  emptyBox: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  emptyIcon: { fontSize: 40 },
  emptyTxt: { color: '#94a3b8', fontSize: 15 },
});
