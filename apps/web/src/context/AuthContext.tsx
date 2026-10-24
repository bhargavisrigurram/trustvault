import React, { createContext, useContext, useState, useEffect } from 'react';
import { api, setCsrfToken } from '../services/api';
import type { User } from '@trustvault/shared';

interface AuthContextType {
  user: User | null;
  csrfToken: string | null;
  loading: boolean;
  isAdmin: boolean;
  isOwner: boolean;
  isViewer: boolean;
  login: (credentials: any) => Promise<void>;
  register: (data: any) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [csrfToken, setCsrfTokenState] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Check active session on initial load
  const refreshUser = async () => {
    try {
      const data = await api.me();
      setUser(data.user);
      setCsrfTokenState(data.csrfToken);
      setCsrfToken(data.csrfToken);
    } catch {
      setUser(null);
      setCsrfTokenState(null);
      setCsrfToken(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = async (credentials: any) => {
    const data = await api.login(credentials);
    setUser(data.user);
    setCsrfTokenState(data.csrfToken);
    setCsrfToken(data.csrfToken);
  };

  const register = async (data: any) => {
    await api.register(data);
    // After registration, automatically login
    try {
      await login({
        usernameOrEmail: data.username,
        password: data.password,
      });
    } catch (err: any) {
      console.warn('Auto-login after registration could not complete:', err);
      throw new Error('Account created! Please sign in with your credentials.');
    }
  };

  const logout = async () => {
    try {
      await api.logout();
    } finally {
      setUser(null);
      setCsrfTokenState(null);
      setCsrfToken(null);
    }
  };

  const isAdmin = user?.role === 'admin';
  const isOwner = user?.role === 'owner';
  const isViewer = user?.role === 'viewer';

  return (
    <AuthContext.Provider
      value={{
        user,
        csrfToken,
        loading,
        isAdmin,
        isOwner,
        isViewer,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
