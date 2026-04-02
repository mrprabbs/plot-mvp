import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import * as SecureStore from 'expo-secure-store';

import { apiFetch } from '../lib/api';
import type { PublicUser } from '../lib/types';

const TOKEN_KEY = 'plot.mobile.token';

type AuthContextValue = {
  bootstrapped: boolean;
  token: string | null;
  user: PublicUser | null;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: { fullName: string; email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [bootstrapped, setBootstrapped] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<PublicUser | null>(null);

  useEffect(() => {
    void (async () => {
      const storedToken = await SecureStore.getItemAsync(TOKEN_KEY);
      if (storedToken) {
        try {
          const session = await apiFetch<{ user: PublicUser }>('/api/mobile/auth/me', {}, storedToken);
          setToken(storedToken);
          setUser(session.user);
        } catch {
          await SecureStore.deleteItemAsync(TOKEN_KEY);
        }
      }
      setBootstrapped(true);
    })();
  }, []);

  const persistSession = async (nextToken: string, nextUser: PublicUser) => {
    await SecureStore.setItemAsync(TOKEN_KEY, nextToken);
    setToken(nextToken);
    setUser(nextUser);
  };

  const value = useMemo<AuthContextValue>(() => ({
    bootstrapped,
    token,
    user,
    async login(email, password) {
      const response = await apiFetch<{ user: PublicUser; token: string }>('/api/mobile/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      await persistSession(response.token, response.user);
    },
    async register(payload) {
      const response = await apiFetch<{ user: PublicUser; token: string }>('/api/mobile/auth/register', {
        method: 'POST',
        body: JSON.stringify({ ...payload, role: 'driver' }),
      });
      await persistSession(response.token, response.user);
    },
    async logout() {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      setToken(null);
      setUser(null);
    },
  }), [bootstrapped, token, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}
