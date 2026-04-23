import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check, Copy, Key, Mail, ShieldCheck, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { apiFetch, setAccessToken } from '@/lib/api';

type Step = 'verify-email' | 'mfa-setup' | 'mfa-verify' | 'backup-codes';
const REFRESH_KEY = 'tmjc.refresh';

export function VerifyAndSetupPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const emailFromQuery = params.get('email') ?? '';

  const [step, setStep] = useState<Step>('verify-email');
  const [email, setEmail] = useState(emailFromQuery);
  const [code, setCode] = useState('');
  const [setupToken, setSetupToken] = useState<string | null>(null);
  const [qrUri, setQrUri] = useState<string | null>(null);
  const [mfaSecret, setMfaSecret] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  async function onVerifyEmail(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await apiFetch<{
        mfa_setup_required?: boolean;
        setup_token?: string;
        access_token?: string;
        refresh_token?: string;
      }>('/auth/verify-email', { method: 'POST', body: { email, code } });

      if (res.setup_token) {
        setSetupToken(res.setup_token);
        const mfa = await apiFetch<{ secret: string; qr_uri: string }>('/auth/mfa/setup', {
          method: 'POST',
          headers: { Authorization: `Bearer ${res.setup_token}` },
        });
        setMfaSecret(mfa.secret);
        setQrUri(mfa.qr_uri);
        setStep('mfa-setup');
      } else if (res.access_token) {
        localStorage.setItem(REFRESH_KEY, res.refresh_token!);
        setAccessToken(res.access_token);
        navigate('/onboarding', { replace: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setBusy(false);
    }
  }

  async function onVerifyMfa(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await apiFetch<{
        backup_codes: string[];
        access_token: string;
        refresh_token: string;
      }>('/auth/mfa/verify-setup', {
        method: 'POST',
        headers: { Authorization: `Bearer ${setupToken}` },
        body: { code: mfaCode },
      });
      setBackupCodes(res.backup_codes);
      localStorage.setItem(REFRESH_KEY, res.refresh_token);
      setAccessToken(res.access_token);
      setStep('backup-codes');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'MFA verification failed');
    } finally {
      setBusy(false);
    }
  }

  async function onResend() {
    setError(null);
    try {
      await apiFetch('/auth/resend-verify-email', { method: 'POST', body: { email } });
      setResendCooldown(60);
      const interval = setInterval(() => {
        setResendCooldown((c) => {
          if (c <= 1) {
            clearInterval(interval);
            return 0;
          }
          return c - 1;
        });
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Resend failed');
    }
  }

  function copyBackupCodes() {
    navigator.clipboard.writeText(backupCodes.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const steps: { key: Step; label: string }[] = [
    { key: 'verify-email', label: 'Email' },
    { key: 'mfa-setup', label: 'MFA setup' },
    { key: 'mfa-verify', label: 'Verify' },
    { key: 'backup-codes', label: 'Backup' },
  ];
  const currentIdx = steps.findIndex((s) => s.key === step);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-16">
      <div className="w-full max-w-md">
        {/* Stepper */}
        <div className="mb-10 grid grid-cols-4 gap-2">
          {steps.map((s, i) => (
            <div key={s.key} className="flex flex-col gap-1.5">
              <div
                className={cn(
                  'h-1 rounded-sm transition-colors',
                  i <= currentIdx ? 'bg-gold-600' : 'bg-secondary',
                )}
              />
              <div
                className={cn(
                  'font-mono text-[10px] uppercase tracking-[0.18em]',
                  i === currentIdx
                    ? 'text-foreground'
                    : i < currentIdx
                      ? 'text-muted-foreground'
                      : 'text-muted-foreground/50',
                )}
              >
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {step === 'verify-email' && (
          <div className="text-center">
            <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-sm bg-navy-100 text-navy-700">
              <Mail className="h-7 w-7" />
            </div>
            <h2 className="mb-2 font-serif text-3xl tracking-tightest">Verify your email</h2>
            <p className="mb-8 text-sm text-muted-foreground">
              We sent a 6-digit code to{' '}
              <strong className="text-foreground">{email || 'your email'}</strong>
            </p>

            <form onSubmit={onVerifyEmail} className="space-y-5 text-left">
              {!emailFromQuery && (
                <div className="space-y-2">
                  <Label className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                    Email
                  </Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="doctor@clinic.com"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                  Verification code
                </Label>
                <DigitsInput value={code} onChange={setCode} />
              </div>

              {error && (
                <div className="rounded-sm border-l-2 border-destructive bg-destructive/5 px-3 py-2 text-xs text-destructive">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={busy || code.length !== 6}>
                {busy ? 'Verifying…' : 'Verify email'}
              </Button>
            </form>

            <div className="mt-6 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              {resendCooldown > 0 ? (
                <span>
                  Resend in <strong className="text-gold-700">{resendCooldown}s</strong>
                </span>
              ) : (
                <button onClick={onResend} className="hover:text-foreground">
                  Resend code
                </button>
              )}
            </div>
          </div>
        )}

        {step === 'mfa-setup' && (
          <div className="text-center">
            <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-sm bg-gold-100 text-gold-700">
              <ShieldCheck className="h-7 w-7" />
            </div>
            <h2 className="mb-2 font-serif text-3xl tracking-tightest">
              Set up two-factor auth
            </h2>
            <p className="mb-6 text-sm text-muted-foreground">
              MFA is mandatory for provider accounts. Scan this QR code with your
              authenticator app (Google Authenticator, Authy, 1Password).
            </p>

            {qrUri && (
              <div className="mb-6 rounded-sm border border-border/70 bg-white p-6">
                {/* TODO(infra): swap external QR-server for a local generator (qrcode.react) before launch. */}
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrUri)}`}
                  alt="MFA QR code"
                  className="mx-auto h-48 w-48"
                />
              </div>
            )}

            {mfaSecret && (
              <div className="mb-6 rounded-sm border border-border/70 bg-secondary/40 p-3">
                <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                  Manual entry key
                </p>
                <p className="select-all font-mono text-sm tracking-wider text-foreground">
                  {mfaSecret}
                </p>
              </div>
            )}

            <Button className="w-full" onClick={() => setStep('mfa-verify')}>
              I've scanned the code
            </Button>

            <div className="mt-4 flex items-start gap-3 rounded-sm border border-gold-600/30 bg-gold-100/40 p-3 text-left">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-gold-700" />
              <p className="text-xs leading-relaxed text-muted-foreground">
                <strong className="text-foreground">HIPAA requirement.</strong> MFA
                cannot be disabled for provider accounts.
              </p>
            </div>
          </div>
        )}

        {step === 'mfa-verify' && (
          <div className="text-center">
            <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-sm bg-navy-100 text-navy-700">
              <Smartphone className="h-7 w-7" />
            </div>
            <h2 className="mb-2 font-serif text-3xl tracking-tightest">Enter your code</h2>
            <p className="mb-8 text-sm text-muted-foreground">
              Open your authenticator app and enter the 6-digit code shown.
            </p>

            <form onSubmit={onVerifyMfa} className="space-y-5">
              <DigitsInput value={mfaCode} onChange={setMfaCode} />

              {error && (
                <div className="rounded-sm border-l-2 border-destructive bg-destructive/5 px-3 py-2 text-xs text-destructive">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={busy || mfaCode.length !== 6}>
                {busy ? 'Verifying…' : 'Verify & activate MFA'}
              </Button>
            </form>

            <button
              onClick={() => setStep('mfa-setup')}
              className="mt-4 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground"
            >
              Back to QR code
            </button>
          </div>
        )}

        {step === 'backup-codes' && (
          <div className="text-center">
            <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-sm bg-ok/10 text-ok-dark">
              <Key className="h-7 w-7" />
            </div>
            <h2 className="mb-2 font-serif text-3xl tracking-tightest">
              Save your backup codes
            </h2>
            <p className="mb-6 text-sm text-muted-foreground">
              These codes can be used if you lose your authenticator.{' '}
              <strong className="text-foreground">They will not be shown again.</strong>
            </p>

            <div className="mb-6 rounded-sm border border-border/70 bg-secondary/30 p-5">
              <div className="grid grid-cols-2 gap-2">
                {backupCodes.map((c) => (
                  <div
                    key={c}
                    className="select-all rounded-sm bg-card px-3 py-2 font-mono text-sm tracking-wider"
                  >
                    {c}
                  </div>
                ))}
              </div>
              <Button variant="outline" size="sm" className="mt-4 w-full" onClick={copyBackupCodes}>
                {copied ? (
                  <>
                    <Check className="mr-1.5 h-3.5 w-3.5" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy all codes
                  </>
                )}
              </Button>
            </div>

            <Button className="w-full" onClick={() => navigate('/onboarding', { replace: true })}>
              Continue to dashboard
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function DigitsInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] ?? '');

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  function setDigit(i: number, char: string) {
    const cleaned = char.replace(/\D/g, '').slice(-1);
    const next = digits.slice();
    next[i] = cleaned;
    const joined = next.join('').slice(0, 6);
    onChange(joined);
    if (cleaned && i < 5) refs.current[i + 1]?.focus();
  }

  function onKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[i] && i > 0) refs.current[i - 1]?.focus();
    if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus();
    if (e.key === 'ArrowRight' && i < 5) refs.current[i + 1]?.focus();
  }

  function onPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    e.preventDefault();
    onChange(pasted);
    refs.current[Math.min(pasted.length, 5)]?.focus();
  }

  return (
    <div className="flex gap-2">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          value={d}
          onChange={(e) => setDigit(i, e.target.value)}
          onKeyDown={(e) => onKeyDown(i, e)}
          onPaste={onPaste}
          maxLength={1}
          className="h-12 w-full rounded-sm border border-border bg-card text-center font-mono text-xl tracking-tightest text-foreground transition-colors focus:border-gold-600 focus:outline-none focus:ring-2 focus:ring-gold-600/20"
          aria-label={`Digit ${i + 1}`}
        />
      ))}
    </div>
  );
}
