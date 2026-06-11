import React, { createContext, useState, useEffect } from 'react';
import { jwtDecode } from "jwt-decode";
import { toast } from 'sonner';

import { API_BASE_URL } from '../services/api';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      try {
        const decoded = jwtDecode(token);
        // Token exp is in seconds
        if (decoded.exp * 1000 < Date.now()) {
          logout();
        } else {
          fetchUser(token);
        }
      } catch (err) {
        logout();
      }
    } else {
      setLoading(false);
    }
  }, [token]);

  const fetchUser = async (authToken) => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      } else {
        logout();
      }
    } catch (error) {
      console.error("Failed to fetch user", error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (username, password) => {
    try {
      const formData = new URLSearchParams();
      formData.append('username', username);
      formData.append('password', password);

      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Giriş başarısız.");
      }

      const data = await res.json();
      localStorage.setItem('token', data.access_token);
      setToken(data.access_token);
      setUser(data.user);
      toast.success("Başarıyla giriş yapıldı.");
      return true;
    } catch (error) {
      toast.error(error.message);
      return false;
    }
  };

  const register = async (username, password) => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Kayıt başarısız.");
      }

      toast.success("Kayıt başarılı, lütfen giriş yapın.");
      return true;
    } catch (error) {
      toast.error(error.message);
      return false;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setLoading(false);
    toast.info("Oturum kapatıldı.");
  };

  const refreshUserBalance = () => {
    if (token) fetchUser(token);
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, refreshUserBalance }}>
      {children}
    </AuthContext.Provider>
  );
};
