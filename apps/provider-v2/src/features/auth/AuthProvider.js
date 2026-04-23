import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch, setAccessToken, setUnauthorizedHandler } from '@/lib/api';
const AuthCtx = createContext(null);
const REFRESH_KEY = 'tmjc.refresh';
async function fetchProviderUser() {
    const res = await apiFetch('/providers/me');
    if (res.data.role !== 'provider')
        throw new Error('This portal is for providers only.');
    return {
        id: res.data.id,
        email: res.data.email,
        role: 'provider',
        firstName: res.data.first_name,
        lastName: res.data.last_name,
    };
}
export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    // Holds the mfa_token between /auth/provider/login (step 1) and /auth/mfa/verify (step 2).
    const mfaTokenRef = useRef(null);
    // StrictMode runs effects twice in dev. Without this guard, both invocations
    // call /auth/refresh with the same token — the second request replays the
    // now-revoked token and the API burns the whole refresh-token family.
    const bootedRef = useRef(false);
    const clearAuth = useCallback(() => {
        localStorage.removeItem(REFRESH_KEY);
        setAccessToken(null);
        setUser(null);
        mfaTokenRef.current = null;
    }, []);
    const logout = useCallback(async () => {
        const refresh_token = localStorage.getItem(REFRESH_KEY);
        try {
            if (refresh_token) {
                await apiFetch('/auth/logout', { method: 'DELETE', body: { refresh_token } });
            }
        }
        catch {
            // best-effort
        }
        clearAuth();
        navigate('/login', { replace: true });
    }, [navigate, clearAuth]);
    useEffect(() => {
        setUnauthorizedHandler(() => {
            clearAuth();
            navigate('/login', { replace: true });
        });
    }, [navigate, clearAuth]);
    useEffect(() => {
        // Silent refresh on boot: if we have a stored refresh token, rotate it for
        // a fresh access token and load the profile. Guarded against StrictMode
        // double-invoke — see bootedRef above.
        if (bootedRef.current)
            return;
        bootedRef.current = true;
        (async () => {
            const refresh_token = localStorage.getItem(REFRESH_KEY);
            if (!refresh_token) {
                setLoading(false);
                return;
            }
            try {
                const tokens = await apiFetch('/auth/refresh', { method: 'POST', body: { refresh_token } });
                localStorage.setItem(REFRESH_KEY, tokens.refresh_token);
                setAccessToken(tokens.access_token);
                const me = await fetchProviderUser();
                setUser(me);
            }
            catch {
                clearAuth();
            }
            finally {
                setLoading(false);
            }
        })();
    }, [clearAuth]);
    const login = useCallback(async (email, password, mfaCode) => {
        // Step 2: we already have an mfa_token — verify the code to exchange for tokens.
        if (mfaCode && mfaTokenRef.current) {
            const tokens = await apiFetch('/auth/mfa/verify', { method: 'POST', body: { mfa_token: mfaTokenRef.current, code: mfaCode, type: 'totp' } });
            localStorage.setItem(REFRESH_KEY, tokens.refresh_token);
            setAccessToken(tokens.access_token);
            mfaTokenRef.current = null;
            const me = await fetchProviderUser();
            setUser(me);
            return {};
        }
        // Step 1: email + password → mfa_token. Providers always have MFA, so this
        // endpoint always returns { mfa_required, mfa_token }.
        const res = await apiFetch('/auth/provider/login', { method: 'POST', body: { email, password } });
        mfaTokenRef.current = res.mfa_token;
        return { mfaRequired: true };
    }, []);
    const value = useMemo(() => ({ user, loading, login, logout }), [user, loading, login, logout]);
    return _jsx(AuthCtx.Provider, { value: value, children: children });
}
export function useAuth() {
    const ctx = useContext(AuthCtx);
    if (!ctx)
        throw new Error('useAuth outside AuthProvider');
    return ctx;
}
