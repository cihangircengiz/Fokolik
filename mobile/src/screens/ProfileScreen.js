import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../store/useAuthStore';
import { apiService } from '../api/api';
import AuthModal from '../components/AuthModal';

const STATUS_COLORS = {
  pending: { bg: '#fef9c3', text: '#854d0e', label: 'Bekliyor' },
  won: { bg: '#dcfce7', text: '#166534', label: 'Kazandı' },
  lost: { bg: '#fee2e2', text: '#991b1b', label: 'Kaybetti' },
  cancelled: { bg: '#f1f5f9', text: '#475569', label: 'İptal' },
};

export default function ProfileScreen() {
  const user = useAuthStore(s => s.user);
  const token = useAuthStore(s => s.token);
  const logout = useAuthStore(s => s.logout);
  const [slips, setSlips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [expandedSlips, setExpandedSlips] = useState({});
  const [authModalVisible, setAuthModalVisible] = useState(false);

  useEffect(() => {
    if (user) fetchSlips();
    else setLoading(false);
  }, [user]);

  const fetchSlips = async () => {
    setLoading(true);
    try {
      const data = await apiService.getUserSlips();
      setSlips(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setSlips([]);
    } finally {
      setLoading(false);
    }
  };

  const cancelSlip = async (slipId) => {
    try {
      await apiService.cancelSlip(slipId);
      Alert.alert('Başarılı', 'Kupon iptal edildi.');
      fetchSlips();
    } catch (err) {
      Alert.alert('Hata', 'İptal başarısız oldu.');
    }
  };

  const confirmCancel = (slipId) => {
    Alert.alert(
      'Kupon İptali',
      `#${slipId} numaralı kuponu iptal etmek istiyor musunuz?`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        { text: 'İptal Et', style: 'destructive', onPress: () => cancelSlip(slipId) },
      ]
    );
  };

  const toggleExpand = (id) => {
    setExpandedSlips(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const isSlipCancelable = (slip) => {
    if (slip.status !== 'pending') return false;
    const now = new Date();
    return slip.selections?.every(sel => {
      if (!sel.odd_details) return false;
      return new Date(sel.odd_details.start_date) > now;
    });
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  const filteredSlips = slips.filter(s => s.status === activeTab);
  const tabs = [
    { id: 'pending', label: 'Bekleyen' },
    { id: 'won', label: 'Kazanan' },
    { id: 'lost', label: 'Kaybeden' },
    { id: 'cancelled', label: 'İptal' },
  ];

  if (!user) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.header}>
          <Text style={s.title}>Profilim</Text>
        </View>
        <View style={s.loginPrompt}>
          <Text style={s.loginPromptTxt}>Kupon geçmişinizi görmek için</Text>
          <Text style={s.loginPromptTxt}>giriş yapmanız gerekiyor.</Text>
          <TouchableOpacity style={s.loginBtn} onPress={() => setAuthModalVisible(true)}>
            <Text style={s.loginBtnTxt}>Giriş Yap / Kayıt Ol</Text>
          </TouchableOpacity>
        </View>
        <AuthModal visible={authModalVisible} onClose={() => setAuthModalVisible(false)} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.title}>@{user.username}</Text>
          <Text style={s.balance}>{(user.coin_balance ?? user.balance ?? 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} Coin</Text>
        </View>
        <TouchableOpacity style={s.logoutBtn} onPress={() => Alert.alert('Çıkış', 'Oturumu kapatmak istiyor musunuz?', [
          { text: 'Vazgeç', style: 'cancel' },
          { text: 'Çıkış Yap', style: 'destructive', onPress: logout },
        ])}>
          <Text style={s.logoutTxt}>Çıkış</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={s.tabRow}>
        {tabs.map(tab => (
          <TouchableOpacity
            key={tab.id}
            style={[s.tab, activeTab === tab.id && s.tabActive]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Text style={[s.tabTxt, activeTab === tab.id && s.tabTxtActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#4f46e5" style={{ marginTop: 20 }} />
      ) : filteredSlips.length === 0 ? (
        <Text style={s.emptyTxt}>Bu kategoride kupon yok.</Text>
      ) : (
        <FlatList
          data={filteredSlips}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
          renderItem={({ item }) => {
            const isExpanded = !!expandedSlips[item.id];
            const cancelable = isSlipCancelable(item);
            const winnings = (item.amount * item.total_odd).toFixed(2);
            const statusMeta = STATUS_COLORS[item.status] || STATUS_COLORS.pending;

            return (
              <TouchableOpacity style={s.slipCard} onPress={() => toggleExpand(item.id)} activeOpacity={0.85}>
                <View style={s.slipHeader}>
                  <View>
                    <Text style={s.slipId}>KUPON #{item.id}</Text>
                    <Text style={s.slipDate}>{formatDate(item.created_at)}</Text>
                  </View>
                  <View style={[s.statusBadge, { backgroundColor: statusMeta.bg }]}>
                    <Text style={[s.statusTxt, { color: statusMeta.text }]}>{statusMeta.label}</Text>
                  </View>
                </View>

                <View style={s.slipMeta}>
                  <View style={s.metaItem}>
                    <Text style={s.metaLabel}>Tutar</Text>
                    <Text style={s.metaVal}>{item.amount}</Text>
                  </View>
                  <View style={s.metaItem}>
                    <Text style={s.metaLabel}>Oran</Text>
                    <Text style={s.metaVal}>{item.total_odd?.toFixed(2)}</Text>
                  </View>
                  <View style={s.metaItem}>
                    <Text style={[s.metaLabel, { color: '#059669' }]}>Kazanç</Text>
                    <Text style={[s.metaVal, { color: '#059669' }]}>{winnings}</Text>
                  </View>
                </View>

                {cancelable && (
                  <TouchableOpacity style={s.cancelBtn} onPress={() => confirmCancel(item.id)}>
                    <Text style={s.cancelBtnTxt}>İptal Et</Text>
                  </TouchableOpacity>
                )}

                {isExpanded && item.selections?.map(sel => {
                  const d = sel.odd_details;
                  const selStatus = {
                    won: { color: '#059669', label: 'Kazandı' },
                    lost: { color: '#ef4444', label: 'Kaybetti' },
                    void: { color: '#f59e0b', label: 'İade' },
                    pending: { color: '#94a3b8', label: 'Bekliyor' },
                  }[sel.status] || { color: '#94a3b8', label: sel.status };

                  return (
                    <View key={sel.id} style={s.selRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.selMatch}>{d?.home_team} - {d?.away_team}</Text>
                        <Text style={s.selDate}>{formatDate(d?.start_date)}</Text>
                      </View>
                      <View style={s.selRight}>
                        <Text style={s.selBetType}>{d?.bet_type}</Text>
                        <Text style={s.selOdd}>@{d?.odd_value?.toFixed(2)}</Text>
                        <Text style={{ color: selStatus.color, fontSize: 10, fontWeight: 'bold' }}>{selStatus.label}</Text>
                      </View>
                    </View>
                  );
                })}
              </TouchableOpacity>
            );
          }}
        />
      )}
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
  title: { fontSize: 17, fontWeight: 'bold', color: '#1e293b' },
  balance: { fontSize: 14, color: '#059669', fontWeight: '700', marginTop: 1 },
  logoutBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  logoutTxt: { color: '#ef4444', fontWeight: 'bold', fontSize: 13 },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
  },
  tabActive: { backgroundColor: '#4f46e5' },
  tabTxt: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  tabTxtActive: { color: '#fff' },
  emptyTxt: { textAlign: 'center', color: '#94a3b8', marginTop: 40, fontSize: 15 },
  loginPrompt: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 6 },
  loginPromptTxt: { color: '#64748b', fontSize: 15 },
  loginBtn: {
    marginTop: 16,
    backgroundColor: '#4f46e5',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  loginBtnTxt: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  slipCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  slipHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  slipId: { fontWeight: 'bold', color: '#1e293b', fontSize: 14 },
  slipDate: { color: '#94a3b8', fontSize: 11, marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusTxt: { fontSize: 11, fontWeight: 'bold' },
  slipMeta: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  metaItem: { alignItems: 'center' },
  metaLabel: { fontSize: 10, color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase' },
  metaVal: { fontSize: 13, fontWeight: 'bold', color: '#1e293b' },
  cancelBtn: { backgroundColor: '#fee2e2', borderRadius: 8, paddingVertical: 8, alignItems: 'center', marginTop: 4 },
  cancelBtnTxt: { color: '#ef4444', fontWeight: 'bold', fontSize: 13 },
  selRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    marginTop: 8,
  },
  selMatch: { fontSize: 12, fontWeight: '600', color: '#1e293b' },
  selDate: { fontSize: 10, color: '#94a3b8', marginTop: 2 },
  selRight: { alignItems: 'flex-end', gap: 2 },
  selBetType: { fontSize: 10, color: '#64748b', backgroundColor: '#f1f5f9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  selOdd: { fontSize: 13, fontWeight: 'bold', color: '#4f46e5' },
});
