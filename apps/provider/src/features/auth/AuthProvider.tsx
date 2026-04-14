import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch, setAccessToken, setUnauthorizedHandler } from '@/lib/api';

type ProviderUser = {
  id: string;
  email: string;
  role: 'provider';
  firstName?: string;
  lastName?: string;
};

type AuthState = {
  user: ProviderUser | null;
  loading: boolean;
  login: (email: string, password: string, mfaCode?: string) => Promise<{ mfaRequired?: boolean }>;
  logout: () => Promise<void>;
};

const AuthCtx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<ProviderUser | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const logout = useCallback(async () => {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch {
      // best-effort
    }
    setAccessToken(null);
    setUser(null);
    navigate('/login', { replace: true });
  }, [navigate]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setAccessToken(null);
      setUser(null);
      navigate('/login', { replace: true });
    });
  }, [navigate]);

  useEffect(() => {
    // attempt silent refresh on boot
    (async () => {
      try {
        const res = await apiFetch<{ accessToken: string; user: ProviderUser }>('/auth/refresh', {
          method: 'POST',
        });
        setAccessToken(res.accessToken);
        if (res.user.role !== 'provider') throw new Error('role');
        setUser(res.user);
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = useCallback<AuthState['login']>(async (email, password, mfaCode) => {
    const res = await apiFetch<
      | { mfaRequired: true }
      | { accessToken: string; user: ProviderUser }
    >('/auth/login', {
      method: 'POST',
      body: { email, password, mfaCode },
    });
    if ('mfaRequired' in res) return { mfaRequired: true };
    if (res.user.role !== 'provider') {
      throw new Error('This portal is for providers only.');
    }
    setAccessToken(res.accessToken);
    setUser(res.user);
    return {};
  }, []);

  const value = useMemo(() => ({ user, loading, login, logout }), [user, loading, login, logout]);
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}
