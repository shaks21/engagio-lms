'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import axios from 'axios';

export interface User {
  id: string;
  email: string;
  role: 'STUDENT' | 'TEACHER' | 'ADMIN';
  tenantId: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  userId: string | null;
  tenantId: string | null;
  userName: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setUser: (user: User | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'engagio_token';

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const API = process.env.NEXT_PUBLIC_API_URL ; //|| 'http://localhost:3000';

  // Track token to trigger re-auth when registration sets it
  const [tokenVersion, setTokenVersion] = useState(0);

  // Fetch current user on mount and whenever token changes (e.g., after registration)
  useEffect(() => {
    const fetchUser = async () => {
      const token = localStorage.getItem(TOKEN_KEY);
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const response = await axios.get(
          `${API}/auth/me`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        setUser(response.data);
      } catch {
        // Token might be invalid or expired
        localStorage.removeItem(TOKEN_KEY);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [API, tokenVersion]);

  const login = useCallback(async (email: string, password: string) => {
    const response = await axios.post(
      `${API}/auth/login`,
      { email, password }
    );

    const { accessToken, user: userData } = response.data;
    localStorage.setItem(TOKEN_KEY, accessToken);
    setUser(userData);
    setTokenVersion(v => v + 1); // Trigger re-auth
  }, [API]);

  const logout = useCallback(async () => {
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      if (token) {
        // Call backend to blacklist token
        await axios.post(
          `${API}/auth/logout`,
          {},
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
      }
    } catch (error) {
      // Even if backend call fails, always clear local state
      console.warn('Logout API call failed, clearing local state', error);
    } finally {
      localStorage.removeItem(TOKEN_KEY);
      setUser(null);
      setTokenVersion(v => v + 1); // Reset auth state
      // Navigate to login
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
  }, [API]);

  const isAuthenticated = user !== null;
  const userId = user?.id ?? null;
  const tenantId = user?.tenantId ?? null;
  const userName = user?.email ?? null;

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated,
        userId,
        tenantId,
        userName,
        login,
        logout,
        setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
