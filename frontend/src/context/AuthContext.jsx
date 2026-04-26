import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setAuthToken } from '../services/api';
import { disconnectSocket, getSocket } from '../services/websocket';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('te_token'));
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    setAuthToken(token);
    try {
      const { data } = await api.get('/api/auth/me');
      setUser(data.user);
      applyTheme(data.user.theme);
    } catch {
      setUser(null);
      localStorage.removeItem('te_token');
      setToken(null);
      setAuthToken(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  useEffect(() => {
    if (!token) {
      disconnectSocket();
      return;
    }
    const s = getSocket(token);
    s.connect();
    return () => {
      s.disconnect();
    };
  }, [token]);

  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/api/auth/login', { email, password });
    localStorage.setItem('te_token', data.token);
    setToken(data.token);
    setAuthToken(data.token);
    setUser(data.user);
    applyTheme(data.user.theme);
    return data;
  }, []);

  const register = useCallback(async (payload) => {
    const { data } = await api.post('/api/auth/register', payload);
    localStorage.setItem('te_token', data.token);
    setToken(data.token);
    setAuthToken(data.token);
    setUser(data.user);
    applyTheme(data.user.theme);
    return data;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('te_token');
    setToken(null);
    setUser(null);
    setAuthToken(null);
    disconnectSocket();
  }, []);

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      login,
      register,
      logout,
      refreshUser,
      setUser,
    }),
    [user, token, loading, login, register, logout, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'light') root.classList.add('light');
  else root.classList.remove('light');
}
