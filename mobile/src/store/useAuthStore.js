import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../api/api';

export const useAuthStore = create((set, get) => ({
  user: null,
  token: null,
  loading: true,

  // Called on app startup to restore persisted session
  initAuth: async () => {
    set({ loading: true });
    try {
      const token = await AsyncStorage.getItem('token');
      if (token) {
        set({ token });
        await get().fetchUser(token);
      }
    } catch (err) {
      console.error('initAuth error:', err);
    } finally {
      set({ loading: false });
    }
  },

  fetchUser: async (authToken) => {
    try {
      const token = authToken || get().token;
      const res = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        set({ user: data });
        return true;
      } else {
        get().logout();
        return false;
      }
    } catch (err) {
      console.error('fetchUser error:', err);
      get().logout();
      return false;
    }
  },

  login: async (username, password) => {
    try {
      const formData = new URLSearchParams();
      formData.append('username', username);
      formData.append('password', password);

      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString(),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Giriş başarısız.');
      }

      const data = await res.json();
      await AsyncStorage.setItem('token', data.access_token);
      set({ token: data.access_token, user: data.user });
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },

  register: async (username, password) => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Kayıt başarısız.');
      }
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },

  logout: async () => {
    await AsyncStorage.removeItem('token');
    set({ user: null, token: null });
  },

  refreshUserBalance: () => {
    const { token } = get();
    if (token) get().fetchUser(token);
  },
}));
