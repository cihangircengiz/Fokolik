import React, { useState } from 'react';
import {
  View, Text, Modal, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
  TouchableWithoutFeedback, Keyboard
} from 'react-native';
import { useAuthStore } from '../store/useAuthStore';

export default function AuthModal({ visible, onClose }) {
  const [activeTab, setActiveTab] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const login = useAuthStore(s => s.login);
  const register = useAuthStore(s => s.register);
  const fetchUser = useAuthStore(s => s.fetchUser);

  const reset = () => {
    setUsername('');
    setPassword('');
    setLoading(false);
  };

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert('Hata', 'Kullanıcı adı ve şifre boş olamaz.');
      return;
    }
    setLoading(true);
    const result = await login(username.trim(), password);
    setLoading(false);
    if (result.success) {
      reset();
      onClose();
    } else {
      Alert.alert('Giriş Başarısız', result.message || 'Kullanıcı adı veya şifre hatalı.');
    }
  };

  const handleRegister = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert('Hata', 'Kullanıcı adı ve şifre boş olamaz.');
      return;
    }
    if (password.length < 4) {
      Alert.alert('Hata', 'Şifre en az 4 karakter olmalıdır.');
      return;
    }
    setLoading(true);
    const regResult = await register(username.trim(), password);
    if (regResult.success) {
      const loginResult = await login(username.trim(), password);
      setLoading(false);
      if (loginResult.success) {
        reset();
        onClose();
      }
    } else {
      setLoading(false);
      Alert.alert('Kayıt Başarısız', regResult.message || 'Bir hata oluştu.');
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.overlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.sheetWrapper}
          >
            <View style={styles.sheet}>
              {/* Handle */}
              <View style={styles.handle} />

              <Text style={styles.title}>
                {activeTab === 'login' ? 'Hoş Geldiniz 👋' : 'Hesap Oluştur'}
              </Text>

              {/* Tabs */}
              <View style={styles.tabRow}>
                <TouchableOpacity
                  style={[styles.tab, activeTab === 'login' && styles.tabActive]}
                  onPress={() => setActiveTab('login')}
                >
                  <Text style={[styles.tabText, activeTab === 'login' && styles.tabTextActive]}>
                    Giriş Yap
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.tab, activeTab === 'register' && styles.tabActiveReg]}
                  onPress={() => setActiveTab('register')}
                >
                  <Text style={[styles.tabText, activeTab === 'register' && styles.tabTextActiveReg]}>
                    Kayıt Ol
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Inputs */}
              <Text style={styles.label}>Kullanıcı Adı</Text>
              <TextInput
                style={styles.input}
                placeholder="Kullanıcı adınız"
                placeholderTextColor="#94a3b8"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Text style={styles.label}>Şifre</Text>
              <TextInput
                style={styles.input}
                placeholder="Şifreniz"
                placeholderTextColor="#94a3b8"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />

              {activeTab === 'register' && (
                <Text style={styles.hint}>
                  Kayıt olduğunuzda <Text style={styles.hintBold}>10.000 Coin</Text> hediye edilir!
                </Text>
              )}

              {/* Submit Button */}
              <TouchableOpacity
                style={[styles.btn, activeTab === 'register' && styles.btnReg]}
                onPress={activeTab === 'login' ? handleLogin : handleRegister}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.btnText}>
                    {activeTab === 'login' ? 'Giriş Yap' : 'Kayıt Ol'}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                <Text style={styles.cancelText}>Vazgeç</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheetWrapper: {
    width: '100%',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 36,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e2e8f0',
    alignSelf: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 16,
    textAlign: 'center',
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 9,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  tabActiveReg: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  tabText: { fontSize: 14, fontWeight: '600', color: '#94a3b8' },
  tabTextActive: { color: '#059669' },
  tabTextActiveReg: { color: '#4f46e5' },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 15,
    color: '#1e293b',
    marginBottom: 14,
  },
  hint: {
    textAlign: 'center',
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 12,
  },
  hintBold: {
    fontWeight: 'bold',
    color: '#059669',
  },
  btn: {
    backgroundColor: '#059669',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 10,
  },
  btnReg: {
    backgroundColor: '#4f46e5',
  },
  btnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  cancelText: {
    color: '#94a3b8',
    fontSize: 14,
  },
});
