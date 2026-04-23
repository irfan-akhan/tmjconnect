import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Lock, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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
  const [trustDevice, setTrustDevice] = useState(false);
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
      {/* ─── Hero ─────────────────────────────────────────────────────────── */}
      <aside className="grain relative hidden overflow-hidden bg-navy-700 text-background lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-sm bg-gold-600 text-navy-900">
            <span className="font-serif text-lg italic leading-none">t</span>
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-serif text-base tracking-tightest">TMJConnect</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] opacity-60">
              Provider · v2.0
            </span>
          </div>
        </div>

        <div className="relative z-10 max-w-lg">
          <div className="mb-6 font-mono text-[10px] uppercase tracking-[0.3em] opacity-60">
            № 001 — Practice workspace
          </div>
          <h1 className="font-serif text-[56px] font-normal leading-[1.02] tracking-tightest">
            See every patient.{' '}
            <em className="text-gold-400">Between every visit.</em>
          </h1>
          <p className="mt-6 max-w-md text-sm leading-relaxed opacity-75">
            Continuity between appointments. Symptom trends without the noise.
            Reports drafted, signed, and filed — in the same place your patients
            report from.
          </p>

          <figure className="mt-10 max-w-md border-l-2 border-gold-600 pl-4">
            <blockquote className="font-serif text-lg leading-snug tracking-tightest">
              “Cuts our after-hours triage in half. The pain trends are the
              first thing I look at every morning.”
            </blockquote>
            <figcaption className="mt-2 font-mono text-[10px] uppercase tracking-[0.22em] opacity-60">
              Dr. M. Chen · Orofacial Pain Specialist
            </figcaption>
          </figure>
        </div>

        <div className="relative z-10 flex items-end justify-between font-mono text-[10px] uppercase tracking-[0.22em] opacity-50">
          <span>HIPAA · SOC 2 · BAA available</span>
          <span>AQION × Orofacial</span>
        </div>
      </aside>

      {/* ─── Form ─────────────────────────────────────────────────────────── */}
      <section className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-navy-600 text-gold-400">
              <span className="font-serif text-base italic leading-none">t</span>
            </div>
            <span className="font-serif text-[15px] tracking-tightest">TMJConnect</span>
          </div>

          <div className="mb-10">
            <Badge variant="muted" size="md" className="mb-4">
              Provider sign-in
            </Badge>
            <h2 className="font-serif text-4xl tracking-tightest">
              Welcome <em className="text-gold-700">back.</em>
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Your patients' updates are waiting.
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label
                htmlFor="email"
                className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground"
              >
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
                placeholder="doctor@clinic.com"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="password"
                  className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground"
                >
                  Password
                </Label>
                <Link
                  to="/forgot-password"
                  className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                >
                  Forgot
                </Link>
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

            {!needMfa && (
              <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={trustDevice}
                  onChange={(e) => setTrustDevice(e.target.checked)}
                  className="h-3.5 w-3.5 rounded-sm border-border accent-navy-600"
                />
                Trust this device for 30 days
              </label>
            )}

            {needMfa && (
              <div className="space-y-2">
                <Label
                  htmlFor="mfa"
                  className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground"
                >
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

            <Button type="submit" className="w-full gap-2" disabled={submitting}>
              {submitting ? 'Signing in…' : needMfa ? 'Verify code' : 'Sign in securely'}
              {!submitting && <ArrowRight className="h-4 w-4" />}
            </Button>
          </form>

          <div className="mt-6 flex items-start gap-3 rounded-sm border border-gold-600/30 bg-gold-100/40 p-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-gold-700" />
            <p className="text-xs leading-relaxed text-muted-foreground">
              <strong className="text-foreground">MFA required.</strong> Provider
              accounts cannot disable two-factor authentication — a HIPAA
              safeguard for patient data.
            </p>
          </div>

          <div className="mt-8 flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              or
            </span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            New to TMJConnect?{' '}
            <Link to="/register" className="inline-flex items-center gap-1 font-semibold text-foreground hover:underline">
              Register as a provider
              <ArrowRight className="h-3 w-3" />
            </Link>
          </p>

          <div className="mt-10 flex items-center justify-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            <Lock className="h-3 w-3" />
            End-to-end encrypted · session timeout 15m
          </div>
        </div>
      </section>
    </div>
  );
}
