import { useCallback, useEffect, useRef, useState } from 'react';
import { Clock, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/features/auth/AuthProvider';

const TIMEOUT_MS = 15 * 60 * 1000;
const EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart'] as const;

export function SessionTimeoutModal() {
  const { user, login, logout } = useAuth();
  const [expired, setExpired] = useState(false);
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [needMfa, setNeedMfa] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetTimer = useCallback(() => {
    if (expired || !user) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setExpired(true), TIMEOUT_MS);
  }, [expired, user]);

  useEffect(() => {
    if (!user) return;
    resetTimer();
    const handler = () => resetTimer();
    for (const e of EVENTS) window.addEventListener(e, handler, { passive: true });
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      for (const e of EVENTS) window.removeEventListener(e, handler);
    };
  }, [user, resetTimer]);

  if (!expired || !user) return null;

  async function onReauth(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await login(user!.email, password, needMfa ? mfaCode : undefined);
      if (res.mfaRequired) {
        setNeedMfa(true);
      } else {
        setExpired(false);
        setPassword('');
        setMfaCode('');
        setNeedMfa(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-sm border border-border bg-background p-8 shadow-lg">
        <div className="mb-6 flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-sm bg-amber-500/10">
            <Clock className="h-7 w-7 text-amber-600" />
          </div>
        </div>

        <h2 className="mb-2 text-center font-serif text-2xl tracking-tightest">
          Session timed out
        </h2>
        <p className="mb-6 text-center text-sm text-muted-foreground">
          Your session expired after 15 minutes of inactivity. Please re-authenticate to continue.
        </p>

        <form onSubmit={onReauth} className="space-y-4">
          <div className="space-y-2">
            <Label className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Password
            </Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              autoFocus
            />
          </div>

          {needMfa && (
            <div className="space-y-2">
              <Label className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                Authentication code
              </Label>
              <Input
                inputMode="numeric"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                placeholder="000 000"
                className="font-mono tracking-[0.3em]"
                required
              />
            </div>
          )}

          {error && (
            <div className="rounded-sm border-l-2 border-destructive bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? 'Authenticating…' : needMfa ? 'Verify code' : 'Re-authenticate'}
          </Button>
        </form>

        {needMfa && (
          <p className="mt-3 text-center text-xs text-muted-foreground">
            MFA verification required for provider accounts
          </p>
        )}

        <div className="mt-6 border-t border-border/70 pt-4 text-center">
          <button
            onClick={logout}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign in as a different user
          </button>
        </div>

        <div className="mt-4 rounded-sm bg-secondary/50 p-3 text-center">
          <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
            HIPAA Requirement
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Provider sessions auto-expire after 15 minutes to protect PHI
          </p>
        </div>
      </div>
    </div>
  );
}
