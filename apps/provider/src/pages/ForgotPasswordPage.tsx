import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Lock, Mail, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiFetch } from '@/lib/api';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await apiFetch('/auth/forgot-password', { method: 'POST', body: { email } });
      setSent(true);
    } catch (err) {
      setSent(true);
    } finally {
      setBusy(false);
    }
  }

  async function onResend() {
    setBusy(true);
    try {
      await apiFetch('/auth/forgot-password', { method: 'POST', body: { email } });
    } catch { /* best-effort */ }
    setBusy(false);
  }

  if (sent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-sm bg-emerald-500/10">
            <Mail className="h-7 w-7 text-emerald-600" />
          </div>
          <h2 className="mb-2 font-serif text-3xl tracking-tightest">Check your email</h2>
          <p className="mb-6 text-sm text-muted-foreground">
            We've sent a password reset link to{' '}
            <strong className="text-foreground">{email}</strong>. The link expires in 1 hour.
          </p>

          <div className="mb-6 rounded-sm border border-border/70 bg-secondary/30 p-4 text-left">
            <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Didn't receive it?
            </div>
            <ul className="space-y-1 text-xs text-muted-foreground">
              <li>Check your spam or junk folder</li>
              <li>Make sure you entered the correct email</li>
              <li>Wait 2 minutes before requesting again</li>
            </ul>
          </div>

          <Button variant="outline" className="w-full" onClick={onResend} disabled={busy}>
            {busy ? 'Sending…' : 'Resend reset link'}
          </Button>

          <div className="mt-6">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-sm bg-accent/10">
          <Lock className="h-7 w-7 text-accent" />
        </div>
        <h2 className="mb-2 font-serif text-3xl tracking-tightest">Reset your password</h2>
        <p className="mb-8 text-sm text-muted-foreground">
          Enter the email associated with your provider account. We'll send a reset link that expires after 1 hour.
        </p>

        <form onSubmit={onSubmit} className="space-y-4 text-left">
          <div className="space-y-2">
            <Label className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Email address
            </Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="doctor@clinic.com"
              required
              autoFocus
            />
          </div>

          {error && (
            <div className="rounded-sm border-l-2 border-destructive bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? 'Sending…' : 'Send reset link'}
          </Button>
        </form>

        <div className="mt-6">
          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
