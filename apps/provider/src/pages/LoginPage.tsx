import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/features/auth/AuthProvider';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [needMfa, setNeedMfa] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await login(email, password, needMfa ? mfaCode : undefined);
      if (res.mfaRequired) setNeedMfa(true);
      else navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative grid min-h-screen lg:grid-cols-[1.15fr_1fr]">
      {/* Editorial left panel */}
      <aside className="grain relative hidden overflow-hidden bg-primary text-primary-foreground lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-sm bg-accent text-accent-foreground">
            <span className="font-serif text-lg italic leading-none">t</span>
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-serif text-base tracking-tightest">TMJ Connect</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] opacity-60">
              Clinician Portal / Est. 2026
            </span>
          </div>
        </div>

        <div className="relative z-10 max-w-lg">
          <div className="mb-8 font-mono text-[10px] uppercase tracking-[0.3em] opacity-60">
            № 001 — Practice workspace
          </div>
          <h1 className="font-serif text-[56px] font-normal leading-[1.02] tracking-tightest">
            A quieter tool for <em className="text-accent">orofacial</em> pain care.
          </h1>
          <p className="mt-6 max-w-sm text-sm leading-relaxed opacity-70">
            Continuity between appointments. Symptom trends without the noise.
            Reports drafted, signed, and filed — in the same place your patients
            report from.
          </p>
        </div>

        <div className="relative z-10 flex items-end justify-between font-mono text-[10px] uppercase tracking-[0.22em] opacity-50">
          <span>HIPAA · aligned</span>
          <span>AQION × Orofacial</span>
        </div>
      </aside>

      {/* Form panel */}
      <section className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-primary text-primary-foreground">
              <span className="font-serif text-base italic leading-none">t</span>
            </div>
            <span className="font-serif text-[15px] tracking-tightest">TMJ Connect</span>
          </div>

          <div className="mb-10">
            <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
              Provider sign-in
            </div>
            <h2 className="font-serif text-4xl tracking-tightest">
              Welcome <em className="text-accent">back.</em>
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Your patients' updates are waiting.
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={needMfa}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                  Password
                </Label>
                <a href="#" className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
                  Forgot
                </a>
              </div>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={needMfa}
              />
            </div>

            {needMfa && (
              <div className="space-y-2">
                <Label htmlFor="mfa" className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                  Authentication code
                </Label>
                <Input
                  id="mfa"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                  placeholder="000 000"
                  className="font-mono tracking-[0.3em]"
                />
              </div>
            )}

            {error && (
              <div className="rounded-sm border-l-2 border-destructive bg-destructive/5 px-3 py-2 text-xs text-destructive">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Signing in…' : needMfa ? 'Verify code' : 'Continue'}
            </Button>
          </form>

          <div className="mt-10 rule h-px" />
          <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Trouble signing in? Contact your practice administrator.
          </p>
        </div>
      </section>
    </div>
  );
}
