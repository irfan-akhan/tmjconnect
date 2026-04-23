import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../config/api';

interface User {
  id: string;
  email: string;
  role: 'admin';
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ mfa_required: boolean; mfa_token?: string }>;
  verifyMfa: (mfaToken: string, code: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  // Restore session from stored token on mount.
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    const storedUser = localStorage.getItem('admin_user');
    if (token && storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.clear();
      }
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await api.post('/auth/admin/login', { email, password });
    return { mfa_required: data.mfa_required as boolean, mfa_token: data.mfa_token as string | undefined };
  }, []);

  const verifyMfa = useCallback(async (mfaToken: string, code: string) => {
    const { data } = await api.post('/auth/mfa/verify', {
      mfa_token: mfaToken,
      code,
      type: 'totp',
    });
    localStorage.setItem('access_token', data.access_token);
    localStorage.setItem('refresh_token', data.refresh_token);

    // Decode payload to get user info.
    const payload = JSON.parse(atob(data.access_token.split('.')[1]));
    const adminUser: User = { id: payload.sub, email: payload.email, role: 'admin' };
    localStorage.setItem('admin_user', JSON.stringify(adminUser));
    setUser(adminUser);
  }, []);

  const logout = useCallback(() => {
    const refreshToken = localStorage.getItem('refresh_token');
    if (refreshToken) {
      // API expects DELETE with refresh_token in the body (not POST).
      api.delete('/auth/logout', { data: { refresh_token: refreshToken } }).catch(() => {});
    }
    localStorage.clear();
    setUser(null);
    navigate('/login', { replace: true });
  }, [navigate]);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, verifyMfa, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
