import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { setUnauthorizedHandler } from '../lib/api';
import { logout as apiLogout } from '../lib/auth.api';
import { clearTokens, getAccessToken, getRefreshToken, saveTokens } from '../lib/tokens';

type Status = 'loading' | 'authed' | 'anon';
type PostAuth = 'loading' | 'ready' | 'needs-tos' | 'needs-onboarding';

type AuthContextValue = {
  status: Status;
  postAuth: PostAuth;
  setAuthed: (tokens: { access_token: string; refresh_token: string }) => Promise<void>;
  signOut: () => Promise<void>;
  completeOnboarding: () => void;
  completeTos: () => void;
  setPostAuth: (v: PostAuth) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [postAuth, setPostAuth] = useState<PostAuth>('loading');

  useEffect(() => {
    let alive = true;
    (async () => {
      const access = await getAccessToken();
      if (alive) setStatus(access ? 'authed' : 'anon');
    })();
    return () => { alive = false; };
  }, []);

  const signOut = useCallback(async () => {
    const refresh = await getRefreshToken();
    await apiLogout(refresh).catch(() => {});
    await clearTokens();
    setPostAuth('loading');
    setStatus('anon');
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setPostAuth('loading');
      setStatus('anon');
    });
    return () => setUnauthorizedHandler(() => {});
  }, []);

  const setAuthed = useCallback<AuthContextValue['setAuthed']>(async (tokens) => {
    await saveTokens(tokens.access_token, tokens.refresh_token);
    setStatus('authed');
  }, []);

  const completeOnboarding = useCallback(() => setPostAuth('ready'), []);
  const completeTos = useCallback(() => setPostAuth('needs-onboarding'), []);

  const value = useMemo<AuthContextValue>(
    () => ({ status, postAuth, setAuthed, signOut, completeOnboarding, completeTos, setPostAuth }),
    [status, postAuth, setAuthed, signOut, completeOnboarding, completeTos],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
