import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  TextInput, Alert, Modal, ActivityIndicator
} from 'react-native';
import { useBetStore } from '../store/useBetStore';
import { useAuthStore } from '../store/useAuthStore';
import { API_BASE_URL } from '../api/api';

export default function BetSlip({ onBattleCreated }) {
  const { selectedOdds, betAmount, setBetAmount, clearSlip, removeSelection } = useBetStore();
  const user = useAuthStore(s => s.user);
  const token = useAuthStore(s => s.token);
  const refreshUserBalance = useAuthStore(s => s.refreshUserBalance);

  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [battleLoading, setBattleLoading] = useState(false);

  if (selectedOdds.length === 0) return null;

  const totalOddValue = selectedOdds.reduce((acc, item) => acc * item.odd.odd_value, 1.0);
  const potentialWinnings = (parseFloat(betAmount || 0) * totalOddValue).toFixed(2);

  // Get unique match count for battle validation
  const uniqueMatchIds = [...new Set(selectedOdds.map(item => item.match.id))];
  const canCreateBattle = uniqueMatchIds.length >= 2 && uniqueMatchIds.length <= 5
    && selectedOdds.length === uniqueMatchIds.length;

  const handlePlaceSlip = async () => {
    if (!user) {
      Alert.alert('Giriş Gerekli', 'Kupon oynamak için lütfen giriş yapın.');
      return;
    }
    const amount = parseFloat(betAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Hata', 'Geçerli bir tutar girin.');
      return;
    }
    const balance = user.coin_balance ?? user.balance ?? 0;
    if (amount > balance) {
      Alert.alert('Yetersiz Bakiye', 'Bakiyeniz yetersiz.');
      return;
    }
    setLoading(true);
    try {
      const oddIds = selectedOdds.map(item => item.odd.id);
      const res = await fetch(`${API_BASE_URL}/slips/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ odd_ids: oddIds, amount }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Hata');
      }
      Alert.alert('Başarılı! 🎉', 'Kuponunuz başarıyla yatırıldı!');
      clearSlip();
      setIsOpen(false);
      refreshUserBalance();
    } catch (err) {
      Alert.alert('Hata', err.message || 'Kupon yatırılırken bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBattle = async () => {
    if (!user) {
      Alert.alert('Giriş Gerekli', 'Düello oluşturmak için lütfen giriş yapın.');
      return;
    }
    if (!canCreateBattle) {
      Alert.alert(
        'Uyarı',
        uniqueMatchIds.length < 2
          ? 'Düello için en az 2 maç seçmelisiniz.'
          : uniqueMatchIds.length > 5
          ? 'Düello için en fazla 5 maç seçebilirsiniz.'
          : 'Düello için her maçtan sadece bir tahmin seçmelisiniz.'
      );
      return;
    }
    const balance = user.coin_balance ?? user.balance ?? 0;
    if (balance < 500) {
      Alert.alert('Yetersiz Bakiye', 'Düello oluşturmak için 500 Coin gerekiyor.');
      return;
    }

    Alert.alert(
      'Düello Oluştur ⚔️',
      `${uniqueMatchIds.length} maçtan oluşan düello oluşturulacak.\nÜcret: 500 Coin\n\nDevam etmek istiyor musunuz?`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Oluştur',
          onPress: async () => {
            setBattleLoading(true);
            try {
              const payload = {
                match_ids: uniqueMatchIds,
                is_public: true,
                max_participants: null,
                creator_odd_ids: selectedOdds.map(item => item.odd.id),
                creator_bet_amount: 500,
              };
              const res = await fetch(`${API_BASE_URL}/battles/`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify(payload),
              });
              if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || 'Hata');
              }
              const data = await res.json();
              Alert.alert(
                'Düello Oluşturuldu! ⚔️',
                `Düello kodunuz: ${data.invite_code}\n\nArkadaşlarınızla paylaşın!`
              );
              clearSlip();
              setIsOpen(false);
              refreshUserBalance();
              if (onBattleCreated) onBattleCreated(data.invite_code);
            } catch (err) {
              Alert.alert('Hata', err.message || 'Düello oluşturulamadı.');
            } finally {
              setBattleLoading(false);
            }
          },
        },
      ]
    );
  };

  // Minimized bar
  if (!isOpen) {
    return (
      <TouchableOpacity style={s.bar} onPress={() => setIsOpen(true)}>
        <View style={s.barLeft}>
          <Text style={s.barCount}>{selectedOdds.length}</Text>
          <Text style={s.barLabel}>Seçim</Text>
        </View>
        <View style={s.barCenter}>
          <Text style={s.barOdd}>{totalOddValue.toFixed(2)}</Text>
          <Text style={s.barOddLabel}>Toplam Oran</Text>
        </View>
        <View style={s.barRight}>
          <Text style={s.barOpen}>Kuponu Aç ↑</Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <Modal visible={isOpen} animationType="slide" transparent>
      <View style={s.overlay}>
        <View style={s.sheet}>
          {/* Handle */}
          <View style={s.handle} />

          {/* Header */}
          <View style={s.header}>
            <Text style={s.title}>🎟 Bahis Kuponu</Text>
            <TouchableOpacity onPress={() => setIsOpen(false)} style={s.closeBtn}>
              <Text style={s.closeTxt}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Selections */}
          <ScrollView style={s.list} bounces={false}>
            {selectedOdds.map(({ match, odd }) => (
              <View key={`${match.id}-${odd.id}`} style={s.item}>
                <View style={{ flex: 1 }}>
                  <Text style={s.itemMatch} numberOfLines={1}>
                    {match.home_team} - {match.away_team}
                  </Text>
                  <Text style={s.itemOdd}>{odd.bet_type} @ {odd.odd_value.toFixed(2)}</Text>
                </View>
                <TouchableOpacity onPress={() => removeSelection(match.id)} style={s.removeBtn}>
                  <Text style={s.removeTxt}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>

          {/* Footer */}
          <View style={s.footer}>
            <View style={s.row}>
              <Text style={s.fLabel}>Toplam Oran</Text>
              <Text style={s.fOdd}>{totalOddValue.toFixed(2)}</Text>
            </View>

            <View style={s.row}>
              <Text style={s.fLabel}>Tutar (Coin)</Text>
              <TextInput
                style={s.amtInput}
                value={betAmount}
                onChangeText={setBetAmount}
                keyboardType="numeric"
                placeholder="10"
              />
            </View>

            <View style={s.row}>
              <Text style={s.fLabel}>Maks. Kazanç</Text>
              <Text style={s.fWin}>{potentialWinnings} Coin</Text>
            </View>

            {/* Place Slip */}
            <TouchableOpacity
              style={[s.placeBtn, loading && s.btnDisabled]}
              onPress={handlePlaceSlip}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={s.placeTxt}>Kuponu Yatır</Text>
              )}
            </TouchableOpacity>

            {/* Create Battle */}
            {canCreateBattle && (
              <TouchableOpacity
                style={[s.battleBtn, battleLoading && s.btnDisabled]}
                onPress={handleCreateBattle}
                disabled={battleLoading}
              >
                {battleLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Text style={s.battleTxt}>⚔️ Düello Oluştur</Text>
                    <Text style={s.battleSub}>500 Coin · {uniqueMatchIds.length} maç</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {!canCreateBattle && selectedOdds.length > 0 && (
              <View style={s.battleHint}>
                <Text style={s.battleHintTxt}>
                  ⚔️ Düello için her maçtan 1 seçim, 2-5 farklı maç seçin
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  bar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1e293b',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
  },
  barLeft: { alignItems: 'center', marginRight: 16 },
  barCount: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  barLabel: { fontSize: 10, color: '#94a3b8' },
  barCenter: { flex: 1 },
  barOdd: { fontSize: 18, fontWeight: 'bold', color: '#34d399' },
  barOddLabel: { fontSize: 10, color: '#94a3b8' },
  barRight: {},
  barOpen: { fontSize: 13, color: '#818cf8', fontWeight: 'bold' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#e2e8f0', alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9'
  },
  title: { fontSize: 17, fontWeight: 'bold', color: '#1e293b' },
  closeBtn: { padding: 4 },
  closeTxt: { fontSize: 16, color: '#94a3b8' },
  list: { maxHeight: 240, paddingHorizontal: 16, paddingTop: 8 },
  item: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#f8fafc', borderRadius: 10, padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: '#e2e8f0'
  },
  itemMatch: { fontSize: 13, fontWeight: 'bold', color: '#1e293b' },
  itemOdd: { fontSize: 12, color: '#059669', fontWeight: '700', marginTop: 2 },
  removeBtn: { paddingLeft: 10 },
  removeTxt: { fontSize: 14, color: '#ef4444', fontWeight: 'bold' },
  footer: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 28 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  fLabel: { fontSize: 13, color: '#64748b', fontWeight: '600' },
  fOdd: { fontSize: 16, fontWeight: 'bold', color: '#059669' },
  fWin: { fontSize: 18, fontWeight: 'bold', color: '#10b981' },
  amtInput: {
    borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 6, width: 100,
    textAlign: 'right', fontWeight: 'bold', fontSize: 15
  },
  placeBtn: {
    backgroundColor: '#059669', borderRadius: 14, paddingVertical: 14,
    alignItems: 'center', marginTop: 4, marginBottom: 8
  },
  placeTxt: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  battleBtn: {
    backgroundColor: '#4f46e5', borderRadius: 14, paddingVertical: 12,
    alignItems: 'center'
  },
  battleTxt: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  battleSub: { color: '#c7d2fe', fontSize: 11, marginTop: 2 },
  battleHint: {
    backgroundColor: '#f8fafc', borderRadius: 10, padding: 10,
    borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center'
  },
  battleHintTxt: { fontSize: 11, color: '#94a3b8', textAlign: 'center' },
  btnDisabled: { opacity: 0.6 },
});
