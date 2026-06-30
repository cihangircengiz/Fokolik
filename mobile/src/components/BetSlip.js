import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Alert, Modal } from 'react-native';
import { useBetStore } from '../store/useBetStore';
import { apiService } from '../api/api';
// Assuming we have auth store or we just mock user ID for now
// A real app would get this from AuthContext/useAuthStore

export default function BetSlip() {
  const { selectedOdds, betAmount, setBetAmount, clearSlip, removeSelection } = useBetStore();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  if (selectedOdds.length === 0) return null;

  const totalOddValue = selectedOdds.reduce((acc, item) => acc * item.odd.odd_value, 1.0);
  const potentialWinnings = (parseFloat(betAmount || 0) * totalOddValue).toFixed(2);

  const handlePlaceSlip = async () => {
    // Basic mock user logic for now
    const userId = 1; 
    setLoading(true);
    try {
      const oddIds = selectedOdds.map(item => item.odd.id);
      await apiService.placeSlip(userId, oddIds, betAmount);
      Alert.alert("Başarılı", "Kuponunuz başarıyla yatırıldı!");
      clearSlip();
      setIsOpen(false);
    } catch (err) {
      Alert.alert("Hata", "Kupon yatırılırken bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <TouchableOpacity style={styles.minimizedContainer} onPress={() => setIsOpen(true)}>
        <View>
          <Text style={styles.minTitle}>Seçilen Maç: {selectedOdds.length}</Text>
        </View>
        <View>
          <Text style={styles.minOdd}>Toplam Oran: {totalOddValue.toFixed(2)}</Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <Modal visible={isOpen} animationType="slide" transparent={true}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.title}>Bahis Kuponu</Text>
            <TouchableOpacity onPress={() => setIsOpen(false)}>
              <Text style={styles.closeBtn}>Kapat</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.oddsList}>
            {selectedOdds.map(({ match, odd }) => (
              <View key={match.id} style={styles.oddItem}>
                <View>
                  <Text style={styles.oddMatchText}>{match.home_team} - {match.away_team}</Text>
                  <Text style={styles.oddTypeText}>{odd.bet_type} @ {odd.odd_value.toFixed(2)}</Text>
                </View>
                <TouchableOpacity onPress={() => removeSelection(match.id)}>
                  <Text style={styles.removeBtn}>Sil</Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>

          <View style={styles.footer}>
            <View style={styles.row}>
              <Text style={styles.label}>Toplam Oran</Text>
              <Text style={styles.val}>{totalOddValue.toFixed(2)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Tutar</Text>
              <TextInput 
                style={styles.input}
                value={betAmount}
                onChangeText={setBetAmount}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Maks. Kazanç</Text>
              <Text style={styles.winVal}>{potentialWinnings}</Text>
            </View>

            <TouchableOpacity style={styles.placeBtn} onPress={handlePlaceSlip} disabled={loading}>
              <Text style={styles.placeBtnText}>{loading ? "Bekleniyor..." : "Kuponu Yatır"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  minimizedContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5
  },
  minTitle: {
    fontWeight: 'bold',
    color: '#1e293b'
  },
  minOdd: {
    fontWeight: 'bold',
    color: '#059669' // emerald-600
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end'
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 10
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b'
  },
  closeBtn: {
    color: '#4f46e5',
    fontWeight: 'bold'
  },
  oddsList: {
    maxHeight: 250,
    marginBottom: 16
  },
  oddItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8
  },
  oddMatchText: {
    fontWeight: 'bold',
    color: '#1e293b',
    fontSize: 14
  },
  oddTypeText: {
    color: '#059669',
    fontWeight: 'bold',
    fontSize: 12,
    marginTop: 4
  },
  removeBtn: {
    color: '#ef4444',
    fontWeight: 'bold'
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 16
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  label: {
    fontWeight: 'bold',
    color: '#64748b'
  },
  val: {
    fontWeight: 'bold',
    color: '#059669',
    fontSize: 16
  },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    width: 100,
    textAlign: 'right',
    fontWeight: 'bold'
  },
  winVal: {
    fontWeight: 'bold',
    color: '#10b981', // emerald-500
    fontSize: 18
  },
  placeBtn: {
    backgroundColor: '#059669', // emerald-600
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8
  },
  placeBtnText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16
  }
});
