import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator,
  TouchableOpacity, TextInput, Alert, RefreshControl, ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiService, API_BASE_URL } from '../api/api';
import { useAuthStore } from '../store/useAuthStore';
import AuthModal from '../components/AuthModal';

export default function BattlesScreen() {
  const user = useAuthStore(s => s.user);
  const token = useAuthStore(s => s.token);

  const [publicBattles, setPublicBattles] = useState([]);
  const [myBattles, setMyBattles] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('lobby'); // lobby | mine | leaderboard
  const [inviteCode, setInviteCode] = useState('');
  const [joiningBattle, setJoiningBattle] = useState(null); // battle being joined
  const [authModalVisible, setAuthModalVisible] = useState(false);

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const [pubRes, leadRes] = await Promise.all([
        fetch(`${API_BASE_URL}/battles/public`, { headers }),
        fetch(`${API_BASE_URL}/battles/leaderboard`, { headers }),
      ]);

      if (pubRes.ok) setPublicBattles(await pubRes.json());
      if (leadRes.ok) setLeaderboard(await leadRes.json());

      if (token) {
        const myRes = await fetch(`${API_BASE_URL}/battles/my`, { headers });
        if (myRes.ok) setMyBattles(await myRes.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [user, token]);

  const handleJoinWithCode = () => {
    if (!inviteCode.trim()) return;
    if (!user) {
      setAuthModalVisible(true);
      return;
    }
    Alert.alert(
      'Düelloya Katıl',
      `${inviteCode.trim().toUpperCase()} kodlu düelloya katılmak istiyor musunuz?`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        { text: 'Detayları Gör', onPress: () => showBattleDetail(inviteCode.trim().toUpperCase()) },
      ]
    );
  };

  const showBattleDetail = async (code) => {
    try {
      const res = await fetch(`${API_BASE_URL}/battles/${code}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (!res.ok) {
        Alert.alert('Bulunamadı', 'Bu kodla bir düello bulunamadı.');
        return;
      }
      const battle = await res.json();
      const matchList = battle.matches.map(m => `• ${m.home_team} - ${m.away_team}`).join('\n');
      Alert.alert(
        `Düello: ${battle.invite_code}`,
        `Kurucu: @${battle.creator_username}\n\nMaçlar:\n${matchList}\n\nKatılmak için maçlara oran seçip Kupon'dan "Düelloya Katıl" yapabilirsiniz.`
      );
    } catch (e) {
      Alert.alert('Hata', 'Düello bilgileri alınamadı.');
    }
  };

  const renderBattleCard = (item, showJoin = false) => {
    const isActive = item.status === 'active';
    const isStarted = item.status === 'started';
    const isCompleted = item.status === 'completed';

    const statusColors = {
      active: { bg: '#dcfce7', text: '#166534', label: 'Katılıma Açık' },
      started: { bg: '#fef9c3', text: '#854d0e', label: 'Oynanıyor' },
      completed: { bg: '#f1f5f9', text: '#475569', label: 'Tamamlandı' },
    };
    const sc = statusColors[item.status] || statusColors.active;

    return (
      <TouchableOpacity
        key={item.id}
        style={s.battleCard}
        onPress={() => showBattleDetail(item.invite_code)}
        activeOpacity={0.8}
      >
        <View style={s.battleCardHeader}>
          <View>
            <Text style={s.battleCode}>#{item.invite_code}</Text>
            <Text style={s.battleCreator}>@{item.creator_username}</Text>
          </View>
          <View style={[s.statusBadge, { backgroundColor: sc.bg }]}>
            <Text style={[s.statusTxt, { color: sc.text }]}>{sc.label}</Text>
          </View>
        </View>

        <View style={s.battleMeta}>
          <Text style={s.metaItem}>⚽ {item.matches?.length ?? 0} Maç</Text>
          <Text style={s.metaItem}>👥 {item.participants?.length ?? 0}{item.max_participants ? `/${item.max_participants}` : ''} Kişi</Text>
        </View>

        <Text style={s.battleCode2}>Kod: {item.invite_code}</Text>
      </TouchableOpacity>
    );
  };

  const tabs = [
    { id: 'lobby', label: '🌍 Lobi' },
    { id: 'mine', label: '⚔️ Düellolarım' },
    { id: 'leaderboard', label: '👑 Sıralama' },
  ];

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>Düellolar</Text>
        {!user && (
          <TouchableOpacity style={s.loginBtn} onPress={() => setAuthModalVisible(true)}>
            <Text style={s.loginBtnTxt}>Giriş Yap</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Invite Code Join Bar */}
      <View style={s.joinBar}>
        <TextInput
          style={s.joinInput}
          placeholder="Davet Kodu (ör: A1B2C3D4)"
          placeholderTextColor="#94a3b8"
          value={inviteCode}
          onChangeText={t => setInviteCode(t.toUpperCase())}
          autoCapitalize="characters"
          autoCorrect={false}
        />
        <TouchableOpacity style={s.joinBtn} onPress={handleJoinWithCode}>
          <Text style={s.joinBtnTxt}>Katıl</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.tabScroll}
        contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8, gap: 6 }}
      >
        {tabs.map(tab => (
          <TouchableOpacity
            key={tab.id}
            style={[s.tab, activeTab === tab.id && s.tabActive]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Text style={[s.tabTxt, activeTab === tab.id && s.tabTxtActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <ActivityIndicator size="large" color="#4f46e5" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={
            activeTab === 'lobby'
              ? publicBattles
              : activeTab === 'mine'
              ? myBattles
              : leaderboard
          }
          keyExtractor={(item, idx) => (item.id ?? item.user_id ?? idx).toString()}
          contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4f46e5" />
          }
          ListEmptyComponent={() => (
            <View style={s.emptyBox}>
              <Text style={s.emptyIcon}>
                {activeTab === 'lobby' ? '🌍' : activeTab === 'mine' ? '⚔️' : '👑'}
              </Text>
              <Text style={s.emptyTxt}>
                {activeTab === 'lobby'
                  ? 'Şu an açık düello yok.\nBülten\'den maç seçerek başlat!'
                  : activeTab === 'mine'
                  ? !user
                    ? 'Düellolarını görmek için\ngiriş yapman gerekiyor.'
                    : 'Henüz düelloya katılmadın.'
                  : 'Henüz puan kazanan yok.'}
              </Text>
            </View>
          )}
          renderItem={({ item }) => {
            if (activeTab === 'leaderboard') {
              const medals = ['🥇', '🥈', '🥉'];
              const idx = leaderboard.indexOf(item);
              return (
                <View style={s.leaderRow}>
                  <Text style={s.leaderRank}>{medals[idx] ?? `#${idx + 1}`}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.leaderName}>@{item.username}</Text>
                    <Text style={s.leaderWins}>{item.monthly_won_battles} galibiyet</Text>
                  </View>
                  <View style={s.reputationBadge}>
                    <Text style={s.reputationTxt}>{item.reputation} Puan</Text>
                  </View>
                </View>
              );
            }
            return renderBattleCard(item);
          }}
        />
      )}

      <AuthModal visible={authModalVisible} onClose={() => setAuthModalVisible(false)} />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0',
  },
  title: { fontSize: 20, fontWeight: 'bold', color: '#1e293b' },
  loginBtn: { backgroundColor: '#4f46e5', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8 },
  loginBtnTxt: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  joinBar: {
    flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0', paddingHorizontal: 12, paddingVertical: 10, gap: 8
  },
  joinInput: {
    flex: 1, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9, fontSize: 14,
    color: '#1e293b', fontWeight: '600',
  },
  joinBtn: { backgroundColor: '#4f46e5', borderRadius: 10, paddingHorizontal: 18, justifyContent: 'center' },
  joinBtnTxt: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  tabScroll: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', flexGrow: 0 },
  tab: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, backgroundColor: '#f1f5f9' },
  tabActive: { backgroundColor: '#4f46e5' },
  tabTxt: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  tabTxtActive: { color: '#fff' },
  battleCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 10,
    borderWidth: 1, borderColor: '#e2e8f0',
  },
  battleCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  battleCode: { fontSize: 15, fontWeight: 'bold', color: '#1e293b' },
  battleCreator: { fontSize: 12, color: '#64748b', marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusTxt: { fontSize: 11, fontWeight: 'bold' },
  battleMeta: { flexDirection: 'row', gap: 16, marginBottom: 8 },
  metaItem: { fontSize: 12, color: '#64748b', fontWeight: '600' },
  battleCode2: { fontSize: 11, color: '#94a3b8', marginTop: 4 },
  leaderRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 12, padding: 14, marginBottom: 8,
    borderWidth: 1, borderColor: '#e2e8f0',
  },
  leaderRank: { fontSize: 22, marginRight: 12, width: 36, textAlign: 'center' },
  leaderName: { fontSize: 15, fontWeight: 'bold', color: '#1e293b' },
  leaderWins: { fontSize: 11, color: '#94a3b8', marginTop: 1 },
  reputationBadge: { backgroundColor: '#fef9c3', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  reputationTxt: { fontSize: 12, fontWeight: 'bold', color: '#854d0e' },
  emptyBox: { paddingTop: 60, alignItems: 'center', gap: 10 },
  emptyIcon: { fontSize: 44 },
  emptyTxt: { color: '#94a3b8', fontSize: 15, textAlign: 'center', lineHeight: 22 },
});
