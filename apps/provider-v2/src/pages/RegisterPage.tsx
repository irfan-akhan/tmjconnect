import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/api';

type FormState = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  date_of_birth: string;
  specialty: string;
  license_number: string;
  license_type: string;
  clinic_name: string;
  password: string;
  confirm_password: string;
};

const PW_RULES: Array<{ label: string; test: (p: string, c: string) => boolean }> = [
  { label: '8+ characters', test: (p) => p.length >= 8 },
  { label: '1 number', test: (p) => /\d/.test(p) },
  { label: '1 special character', test: (p) => /[!@#$%^&*]/.test(p) },
  { label: 'Passwords match', test: (p, c) => c.length > 0 && p === c },
];

const VALUE_PROPS = [
  'Free during pilot programme',
  'No app installation — runs in your browser',
  'Set up in under 5 minutes',
  'HIPAA-compliant with mandatory MFA',
];

export function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    date_of_birth: '',
    specialty: '',
    license_number: '',
    license_type: '',
    clinic_name: '',
    password: '',
    confirm_password: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [agreed, setAgreed] = useState(false);

  function set<K extends keyof FormState>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.password !== form.confirm_password) {
      setError('Passwords do not match');
      return;
    }
    if (!agreed) {
      setError('You must agree to the Terms of Service');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch('/auth/provider/register', {
        method: 'POST',
        body: {
          first_name: form.first_name,
          last_name: form.last_name,
          email: form.email,
          phone: form.phone,
          date_of_birth: form.date_of_birth,
          specialty: form.specialty,
          license_number: form.license_number,
          license_type: form.license_type,
          clinic_name: form.clinic_name,
          password: form.password,
        },
      });
      navigate(`/verify?email=${encodeURIComponent(form.email)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
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
              Provider Portal
            </span>
          </div>
        </div>

        <div className="relative z-10 max-w-lg">
          <div className="mb-8 font-mono text-[10px] uppercase tracking-[0.3em] opacity-60">
            Built for specialists. Trusted by clinics.
          </div>
          <h1 className="font-serif text-[48px] font-normal leading-[1.02] tracking-tightest">
            Start managing your patients{' '}
            <em className="text-gold-400">between visits.</em>
          </h1>
          <div className="mt-10 space-y-4">
            {VALUE_PROPS.map((text) => (
              <div key={text} className="flex items-center gap-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-sm bg-gold-600/15">
                  <Check className="h-3.5 w-3.5 text-gold-400" />
                </div>
                <span className="text-sm opacity-80">{text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 font-mono text-[10px] uppercase tracking-[0.22em] opacity-50">
          AQION × Orofacial · HIPAA · SOC 2
        </div>
      </aside>

      {/* ─── Form ─────────────────────────────────────────────────────────── */}
      <section className="flex items-start justify-center overflow-y-auto px-6 py-10">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-navy-600 text-gold-400">
              <span className="font-serif text-base italic leading-none">t</span>
            </div>
            <span className="font-serif text-[15px] tracking-tightest">TMJConnect</span>
          </div>

          <div className="mb-8">
            <Badge variant="muted" size="md" className="mb-3">
              Create account
            </Badge>
            <h2 className="font-serif text-3xl tracking-tightest">
              Create your <em className="text-gold-700">account.</em>
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              All fields marked with * are required.
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-6">
            <Section label="Personal information">
              <div className="grid grid-cols-2 gap-3">
                <Field label="First name *">
                  <Input required value={form.first_name} onChange={(e) => set('first_name', e.target.value)} />
                </Field>
                <Field label="Last name *">
                  <Input required value={form.last_name} onChange={(e) => set('last_name', e.target.value)} />
                </Field>
              </div>
              <Field label="Email *">
                <Input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => set('email', e.target.value)}
                  placeholder="doctor@clinic.com"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Phone * (E.164)">
                  <Input
                    type="tel"
                    required
                    value={form.phone}
                    onChange={(e) => set('phone', e.target.value)}
                    placeholder="+15551234567"
                  />
                </Field>
                <Field label="Date of birth *">
                  <Input
                    type="date"
                    required
                    value={form.date_of_birth}
                    onChange={(e) => set('date_of_birth', e.target.value)}
                  />
                </Field>
              </div>
            </Section>

            <Section label="Professional credentials">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Specialty *">
                  <Input
                    required
                    value={form.specialty}
                    onChange={(e) => set('specialty', e.target.value)}
                    placeholder="Orofacial Pain"
                  />
                </Field>
                <Field label="License type *">
                  <Input
                    required
                    value={form.license_type}
                    onChange={(e) => set('license_type', e.target.value)}
                    placeholder="DDS, DMD, PT"
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="License number *">
                  <Input
                    required
                    value={form.license_number}
                    onChange={(e) => set('license_number', e.target.value)}
                  />
                </Field>
                <Field label="Clinic name *">
                  <Input
                    required
                    value={form.clinic_name}
                    onChange={(e) => set('clinic_name', e.target.value)}
                  />
                </Field>
              </div>
            </Section>

            <Section label="Security">
              <Field label="Password *">
                <Input
                  type="password"
                  required
                  value={form.password}
                  onChange={(e) => set('password', e.target.value)}
                />
              </Field>
              <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                {PW_RULES.map((rule) => {
                  const met = rule.test(form.password, form.confirm_password);
                  return (
                    <li
                      key={rule.label}
                      className={cn(
                        'flex items-center gap-2 text-[11px] transition-colors',
                        met ? 'text-ok-dark' : 'text-muted-foreground',
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-3.5 w-3.5 items-center justify-center rounded-sm border transition-colors',
                          met ? 'border-ok bg-ok' : 'border-border',
                        )}
                      >
                        {met && <Check className="h-2 w-2 text-background" />}
                      </span>
                      {rule.label}
                    </li>
                  );
                })}
              </ul>
              <Field label="Confirm password *">
                <Input
                  type="password"
                  required
                  value={form.confirm_password}
                  onChange={(e) => set('confirm_password', e.target.value)}
                />
              </Field>
            </Section>

            <div className="flex items-start gap-3 rounded-sm border border-gold-600/30 bg-gold-100/40 p-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-gold-700" />
              <p className="text-xs leading-relaxed text-muted-foreground">
                Provider accounts require <strong className="text-foreground">multi-factor authentication</strong>.
                You'll set up an authenticator app after verifying your email.
              </p>
            </div>

            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-1 h-3.5 w-3.5 rounded-sm border-border accent-navy-600"
              />
              <span className="text-xs leading-relaxed text-muted-foreground">
                I agree to the{' '}
                <Link to="/terms" className="font-semibold text-foreground underline-offset-2 hover:underline">
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link to="/privacy" className="font-semibold text-foreground underline-offset-2 hover:underline">
                  Privacy Policy
                </Link>
              </span>
            </label>

            {error && (
              <div className="rounded-sm border-l-2 border-destructive bg-destructive/5 px-3 py-2 text-xs text-destructive">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Creating account…' : 'Create provider account'}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-foreground hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
        {label}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}
