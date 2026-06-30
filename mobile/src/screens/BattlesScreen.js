import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiService } from '../api/api';

export default function BattlesScreen() {
  const [publicBattles, setPublicBattles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await apiService.getPublicBattles();
      setPublicBattles(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Herkese Açık Lobi</Text>
      </View>
      
      {loading ? (
        <ActivityIndicator size="large" color="#4f46e5" style={{ marginTop: 20 }} />
      ) : publicBattles.length === 0 ? (
        <Text style={styles.centerText}>Şu an açık bir düello yok.</Text>
      ) : (
        <FlatList
          data={publicBattles}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => (
            <View style={styles.battleCard}>
              <Text style={styles.battleId}>Düello Kodu: {item.invite_code}</Text>
              <Text style={styles.creator}>Kurucu: {item.creator_username}</Text>
              <Text style={styles.details}>{item.matches.length} Maç</Text>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  title: { fontSize: 20, fontWeight: 'bold', color: '#1e293b' },
  centerText: { textAlign: 'center', marginTop: 20, color: '#64748b' },
  battleCard: { backgroundColor: '#fff', padding: 16, borderRadius: 8, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  battleId: { fontWeight: 'bold', color: '#1e293b', fontSize: 16, marginBottom: 4 },
  creator: { color: '#4f46e5', fontWeight: 'bold', marginBottom: 4 },
  details: { color: '#64748b' }
});
