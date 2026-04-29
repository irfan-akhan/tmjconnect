import { useRef, useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import {
  Activity as ActivityIcon,
  AlertTriangle,
  Bell,
  Camera,
  Check,
  CheckCircle2,
  CreditCard,
  FileText,
  HelpCircle,
  Lock,
  Monitor,
  ShieldCheck,
  Smartphone,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage, initials } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useAuth } from '@/features/auth/AuthProvider';
import {
  uploadAvatar,
  useActivity,
  useProfile,
  useRevokeSession,
  useSessions,
  useUpdateProfile,
  type ProfileUpdate,
  type ProviderProfile,
  type Session,
} from '@/features/settings/queries';
import {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
} from '@/features/settings/notification-prefs-queries';
import { useBilling } from '@/features/settings/billing-queries';
import { useAcceptTos, useTosStatus } from '@/features/settings/legal-queries';
import { Section } from '@/components/ui/section';

type SectionKey =
  | 'profile'
  | 'security'
  | 'activity'
  | 'notifications'
  | 'billing'
  | 'help'
  | 'legal'
  | 'danger';

const SECTIONS: Array<{
  key: SectionKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  group: 'account' | 'support' | 'danger';
}> = [
  { key: 'profile', label: 'Profile', icon: User, group: 'account' },
  { key: 'security', label: 'Security & sessions', icon: Lock, group: 'account' },
  { key: 'activity', label: 'Activity log', icon: ActivityIcon, group: 'account' },
  { key: 'notifications', label: 'Notifications', icon: Bell, group: 'account' },
  { key: 'billing', label: 'Billing & plan', icon: CreditCard, group: 'account' },
  { key: 'help', label: 'Help & support', icon: HelpCircle, group: 'support' },
  { key: 'legal', label: 'Legal & documents', icon: FileText, group: 'support' },
  { key: 'danger', label: 'Delete account', icon: Trash2, group: 'danger' },
];

export function SettingsPage() {
  const [section, setSection] = useState<SectionKey>('profile');
  const profile = useProfile();

  const sectionMeta = SECTIONS.find((s) => s.key === section)!;
  const fullName =
    profile.data?.first_name && profile.data?.last_name
      ? `${profile.data.first_name} ${profile.data.last_name}`
      : 'Provider';

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <PageHeader
        eyebrow="Account"
        title="Settings."
        description="Manage your identity, security, and account preferences."
      />

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        {/* Left sub-nav */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          {(['account', 'support', 'danger'] as const).map((group) => (
            <div key={group} className="mb-5 last:mb-0">
              <div className="mb-1.5 px-3 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                {group === 'account' ? 'Account' : group === 'support' ? 'Support' : 'Danger zone'}
              </div>
              <ul className="space-y-px">
                {SECTIONS.filter((s) => s.group === group).map((item) => {
                  const Icon = item.icon;
                  const active = section === item.key;
                  return (
                    <li key={item.key}>
                      <button
                        type="button"
                        onClick={() => setSection(item.key)}
                        className={cn(
                          'group relative flex w-full items-center gap-3 rounded-sm px-3 py-2 text-sm transition-colors',
                          active
                            ? 'bg-secondary text-foreground before:absolute before:left-0 before:top-1/2 before:h-5 before:w-0.5 before:-translate-y-1/2 before:bg-gold-600'
                            : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                          group === 'danger' && 'text-destructive hover:text-destructive',
                        )}
                      >
                        <Icon className="h-4 w-4 stroke-[1.5]" />
                        <span className="flex-1 text-left">{item.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </aside>

        {/* Right panel */}
        <main className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-serif text-2xl tracking-tightest text-foreground">
                {sectionMeta.label}
              </h2>
            </div>
            {section === 'security' && (
              <Badge variant="improving" size="md">
                <ShieldCheck className="h-3 w-3" />
                Posture: Strong
              </Badge>
            )}
          </div>

          {section === 'profile' && (
            <ProfileSection profileQuery={profile} fullName={fullName} />
          )}
          {section === 'security' && <SecuritySection />}
          {section === 'activity' && <ActivitySection />}
          {section === 'notifications' && <NotificationsSection />}
          {section === 'billing' && <BillingSection />}
          {section === 'help' && <HelpStub />}
          {section === 'legal' && <LegalSection />}
          {section === 'danger' && <DangerSection />}
        </main>
      </div>
    </div>
  );
}

// ─── Profile section ──────────────────────────────────────────────────────

function ProfileSection({
  profileQuery,
  fullName,
}: {
  profileQuery: ReturnType<typeof useProfile>;
  fullName: string;
}) {
  if (profileQuery.isLoading) {
    return (
      <>
        <Skeleton className="h-32" />
        <Skeleton className="h-72" />
      </>
    );
  }
  if (!profileQuery.data) return null;

  return (
    <>
      <ProfileIdentityCard profile={profileQuery.data} fullName={fullName} />
      <ProfileForm profile={profileQuery.data} />
    </>
  );
}

function ProfileIdentityCard({ profile, fullName }: { profile: ProviderProfile; fullName: string }) {
  const credText = (profile.credentials ?? []).join(', ');
  const memberSince = format(new Date(profile.created_at), 'MMM yyyy');
  return (
    <section className="rounded-sm border border-border/70 bg-card p-6 shadow-navy-xs">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <Avatar size="xl">
          {profile.avatar_url && <AvatarImage src={profile.avatar_url} alt="" />}
          <AvatarFallback className="bg-navy-600 text-background">
            {initials(profile.first_name, profile.last_name)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <h3 className="font-serif text-2xl tracking-tightest">
            {fullName}
            {credText && <span className="text-muted-foreground"> · {credText}</span>}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {profile.specialty || 'Provider'}
            {profile.clinic_name && (
              <>
                {' · '}
                <span className="text-foreground">{profile.clinic_name}</span>
              </>
            )}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {profile.license_number && (
              <Badge variant="improving">
                <CheckCircle2 className="h-3 w-3" />
                License active · {profile.license_type ?? '—'} #{profile.license_number}
              </Badge>
            )}
            <Badge variant="improving">
              <CheckCircle2 className="h-3 w-3" />
              Email verified
            </Badge>
            <Badge variant="muted">BAA on file</Badge>
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Member since
          </div>
          <div className="mt-1 font-serif text-xl tracking-tightest">{memberSince}</div>
        </div>
      </div>
    </section>
  );
}

function ProfileForm({ profile }: { profile: ProviderProfile }) {
  const update = useUpdateProfile();
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<ProfileUpdate>(() => ({
    first_name: profile.first_name,
    last_name: profile.last_name,
    city: profile.city,
    state: profile.state,
    timezone: profile.timezone ?? undefined,
    avatar_url: profile.avatar_url,
    license_number: profile.license_number ?? undefined,
    license_type: profile.license_type ?? undefined,
    specialty: profile.specialty ?? undefined,
    clinic_name: profile.clinic_name ?? undefined,
    credentials: profile.credentials,
  }));
  const [dirty, setDirty] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  function set<K extends keyof ProfileUpdate>(k: K, v: ProfileUpdate[K]) {
    setForm((f) => ({ ...f, [k]: v }));
    setDirty(true);
  }

  function discard() {
    setForm({
      first_name: profile.first_name,
      last_name: profile.last_name,
      city: profile.city,
      state: profile.state,
      timezone: profile.timezone ?? undefined,
      avatar_url: profile.avatar_url,
      license_number: profile.license_number ?? undefined,
      license_type: profile.license_type ?? undefined,
      specialty: profile.specialty ?? undefined,
      clinic_name: profile.clinic_name ?? undefined,
      credentials: profile.credentials,
    });
    setDirty(false);
  }

  async function onPickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarBusy(true);
    setAvatarError(null);
    try {
      const { url } = await uploadAvatar(file);
      await update.mutateAsync({ avatar_url: url });
      set('avatar_url', url);
      setDirty(false);
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setAvatarBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function onRemoveAvatar() {
    setAvatarBusy(true);
    setAvatarError(null);
    try {
      await update.mutateAsync({ avatar_url: null });
      set('avatar_url', null);
      setDirty(false);
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : 'Remove failed');
    } finally {
      setAvatarBusy(false);
    }
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    try {
      await update.mutateAsync(form);
      toast.success('Profile saved.');
      setDirty(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed.');
    }
  }

  return (
    <form onSubmit={onSave} className="space-y-6">
      <Card title="Portrait" subtitle="A clear headshot puts patients at ease.">
        <div className="flex items-center gap-5">
          <div className="relative">
            <Avatar size="lg">
              {form.avatar_url && <AvatarImage src={form.avatar_url} alt="" />}
              <AvatarFallback className="bg-navy-600 text-background">
                {initials(form.first_name, form.last_name)}
              </AvatarFallback>
            </Avatar>
            {form.avatar_url && (
              <button
                type="button"
                onClick={onRemoveAvatar}
                disabled={avatarBusy}
                className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:text-destructive"
                aria-label="Remove avatar"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileRef.current?.click()}
              disabled={avatarBusy}
            >
              <Camera className="mr-2 h-3.5 w-3.5" />
              {avatarBusy ? 'Uploading…' : form.avatar_url ? 'Replace portrait' : 'Upload portrait'}
            </Button>
            <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              JPG or PNG · square · ~400px
            </p>
            {avatarError && (
              <p className="mt-1 text-xs text-destructive">{avatarError}</p>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={onPickAvatar}
          />
        </div>
      </Card>

      <Card title="Basic information">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="First name *">
            <Input value={form.first_name ?? ''} onChange={(e) => set('first_name', e.target.value)} required />
          </Field>
          <Field label="Last name *">
            <Input value={form.last_name ?? ''} onChange={(e) => set('last_name', e.target.value)} required />
          </Field>
          <Field label="Email · login identifier">
            <div className="relative">
              <Input value={profile.email} disabled className="pr-10" />
              <CheckCircle2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ok-dark" />
            </div>
          </Field>
          <Field label="Phone · MFA fallback">
            <Input value={profile.phone ?? '—'} disabled />
          </Field>
        </div>
      </Card>

      <Card title="Practice & specialty">
        <div className="space-y-4">
          <Field label="Clinic name">
            <Input
              value={form.clinic_name ?? ''}
              onChange={(e) => set('clinic_name', e.target.value)}
              placeholder="Bayshore Jaw & Pain Clinic"
            />
          </Field>
          <Field label="Specialty">
            <Input
              value={form.specialty ?? ''}
              onChange={(e) => set('specialty', e.target.value)}
              placeholder="Orofacial pain, TMD"
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="City">
              <Input value={form.city ?? ''} onChange={(e) => set('city', e.target.value || null)} />
            </Field>
            <Field label="State / region">
              <Input value={form.state ?? ''} onChange={(e) => set('state', e.target.value || null)} />
            </Field>
          </div>
        </div>
      </Card>

      <Card title="Credentials · private">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="License type">
            <Input
              value={form.license_type ?? ''}
              onChange={(e) => set('license_type', e.target.value)}
              placeholder="DDS, MD, PT…"
            />
          </Field>
          <Field label="License number · locked after verification">
            <div className="relative">
              <Input
                value={form.license_number ?? ''}
                onChange={(e) => set('license_number', e.target.value)}
                className="pr-10"
              />
              <Lock className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            </div>
          </Field>
        </div>
        <Field label="Post-nominals · comma-separated">
          <Textarea
            rows={2}
            value={(form.credentials ?? []).join(', ')}
            onChange={(e) =>
              set(
                'credentials',
                e.target.value ? e.target.value.split(',').map((s) => s.trim()).filter(Boolean) : null,
              )
            }
            placeholder="MSc, FRCD(C)"
          />
        </Field>
      </Card>

      {/* Sticky save bar */}
      {dirty && (
        <div className="sticky bottom-4 z-10 flex items-center justify-between rounded-sm border border-gold-600/40 bg-card p-3 shadow-navy-sm">
          <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-warn-dark">
            <span className="h-1.5 w-1.5 rounded-full bg-gold-600" />
            You have unsaved changes
          </span>
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={discard}>
              Discard
            </Button>
            <Button type="submit" size="sm" disabled={update.isPending}>
              {update.isPending ? (
                'Saving…'
              ) : (
                <>
                  <Check className="mr-1.5 h-3.5 w-3.5" /> Save changes
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </form>
  );
}

// ─── Security section ─────────────────────────────────────────────────────

function SecuritySection() {
  const sessions = useSessions();
  const revoke = useRevokeSession();
  const [target, setTarget] = useState<Session | null>(null);

  return (
    <div className="space-y-6">
      <Card
        title="Password"
        subtitle="Last changed — TODO · API doesn't return last-rotated-at yet"
        action={
          <Button variant="outline" size="sm" onClick={() => document.getElementById('change-pw-section')?.scrollIntoView({ behavior: 'smooth' })}>
            Change password
          </Button>
        }
      >
        <p className="text-sm text-muted-foreground">
          Use a unique password — something you don't reuse on other sites. Required to be ≥ 8
          characters with at least one digit and one symbol.
        </p>
      </Card>

      <Card
        title="Multi-factor authentication"
        subtitle="Required by HIPAA for all provider accounts. Cannot be disabled entirely."
      >
        <ul className="divide-y divide-border/60">
          <MfaRow
            icon={<Smartphone className="h-4 w-4" />}
            iconClass="bg-gold-600/15 text-gold-700"
            title="Authenticator app"
            badge={<Badge variant="improving">Primary</Badge>}
            meta="Google Authenticator · set up at registration"
            actionLabel="Reconfigure"
          />
          <MfaRow
            icon={<Smartphone className="h-4 w-4" />}
            iconClass="bg-secondary text-muted-foreground"
            title="SMS fallback"
            meta="Used as backup only. Add a number on the phone field above."
            actionLabel="Change number"
            disabled
          />
          <MfaRow
            icon={<FileText className="h-4 w-4" />}
            iconClass="bg-warn/15 text-warn-dark"
            title="Recovery codes"
            meta="One-time-use codes, stored when you first set up MFA"
            actionLabel="View / regenerate"
            disabled
          />
        </ul>
      </Card>

      <Card
        title="Active sessions"
        subtitle="Everywhere you're currently signed in. Revoke anything unfamiliar."
      >
        <div className="overflow-hidden rounded-sm border border-border/60">
          {sessions.isLoading ? (
            Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-16" />)
          ) : !sessions.data || sessions.data.length === 0 ? (
            <p className="bg-card p-6 text-center text-sm text-muted-foreground">
              No active sessions.
            </p>
          ) : (
            sessions.data.map((s) => (
              <SessionRow key={s.id} s={s} onRevoke={() => setTarget(s)} />
            ))
          )}
        </div>
      </Card>

      <ChangePasswordSection />

      <Dialog open={Boolean(target)} onOpenChange={(v) => !v && setTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Revoke this session?</DialogTitle>
            <DialogDescription>
              The device will be signed out immediately. If it's yours, you'll need to sign in again.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={revoke.isPending}
              onClick={async () => {
                if (!target) return;
                try {
                  await revoke.mutateAsync(target.id);
                  toast.success('Session revoked.');
                  setTarget(null);
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'Failed to revoke.');
                }
              }}
            >
              {revoke.isPending ? 'Revoking…' : 'Revoke session'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MfaRow({
  icon,
  iconClass,
  title,
  badge,
  meta,
  actionLabel,
  disabled,
}: {
  icon: React.ReactNode;
  iconClass: string;
  title: string;
  badge?: React.ReactNode;
  meta: string;
  actionLabel: string;
  disabled?: boolean;
}) {
  return (
    <li className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
      <span className={cn('flex h-9 w-9 items-center justify-center rounded-sm', iconClass)}>{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-serif text-sm tracking-tightest text-foreground">{title}</span>
          {badge}
        </div>
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          {meta}
        </div>
      </div>
      <Button variant="outline" size="sm" disabled={disabled}>
        {actionLabel}
      </Button>
    </li>
  );
}

function SessionRow({ s, onRevoke }: { s: Session; onRevoke: () => void }) {
  const { label, kind } = readDevice(s.device_info);
  const Icon = kind === 'mobile' ? Smartphone : Monitor;
  return (
    <div className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-4 border-b border-border/60 bg-card p-4 first:rounded-t-sm last:border-b-0 last:rounded-b-sm">
      <span className="flex h-9 w-9 items-center justify-center rounded-sm bg-secondary text-muted-foreground">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <div className="truncate font-serif text-base tracking-tightest">{label}</div>
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          {s.ip_address ?? 'Unknown IP'} · since {format(new Date(s.created_at), 'd MMM')}
        </div>
      </div>
      <div className="text-right font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        <div className="text-muted-foreground/60">Active</div>
        <div className="text-foreground normal-case tracking-normal">
          {formatDistanceToNow(new Date(s.last_active), { addSuffix: true })}
        </div>
      </div>
      <Button variant="ghost" size="sm" onClick={onRevoke}>
        <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Revoke
      </Button>
    </div>
  );
}

function ChangePasswordSection() {
  const [current, setCurrent] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPw !== confirm) {
      setError('Passwords do not match');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const { apiFetch } = await import('@/lib/api');
      await apiFetch('/auth/change-password', {
        method: 'PATCH',
        body: { current_password: current, new_password: newPw },
      });
      toast.success('Password changed.');
      setCurrent('');
      setNewPw('');
      setConfirm('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card id="change-pw-section" title="Change password">
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Current password">
          <Input
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required
            placeholder="Enter current password"
          />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="New password">
            <Input
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              required
            />
          </Field>
          <Field label="Confirm new password">
            <Input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </Field>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={busy}>
            {busy ? 'Updating…' : 'Update password'}
          </Button>
        </div>
      </form>
    </Card>
  );
}

// ─── Activity section ─────────────────────────────────────────────────────

const ACTION_LABELS: Record<string, { label: string; status: 'success' | 'failed' | 'neutral' }> = {
  'auth.login.success': { label: 'Login successful', status: 'success' },
  'auth.login.failed': { label: 'Login failed', status: 'failed' },
  'auth.logout': { label: 'Logged out', status: 'neutral' },
  'auth.logout_all': { label: 'Logged out all devices', status: 'neutral' },
  'auth.password_reset': { label: 'Password reset', status: 'success' },
  'auth.change_password': { label: 'Password changed', status: 'success' },
  'auth.mfa_enabled': { label: 'MFA enabled', status: 'success' },
  'auth.mfa_verify': { label: 'MFA verified', status: 'success' },
  'auth.email_change_requested': { label: 'Email change requested', status: 'neutral' },
  'auth.email_change_verified': { label: 'Email changed', status: 'success' },
  session_revoked: { label: 'Session revoked', status: 'neutral' },
  provider_profile_updated: { label: 'Profile updated', status: 'success' },
};

function ActivitySection() {
  const activity = useActivity(40);
  return (
    <Card
      title="Login activity"
      subtitle="HIPAA audit trail · last 40 events · retained for 6 years"
      action={
        <Button variant="outline" size="sm" disabled>
          Export CSV
        </Button>
      }
    >
      {activity.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10" />
          ))}
        </div>
      ) : !activity.data || activity.data.length === 0 ? (
        <div className="rounded-sm border border-dashed border-border bg-card/40 p-8 text-center text-sm text-muted-foreground">
          No activity recorded yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/70 bg-secondary/30">
                <th className="px-4 py-2 text-left font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                  Event
                </th>
                <th className="px-4 py-2 text-left font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                  Device
                </th>
                <th className="px-4 py-2 text-left font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                  IP
                </th>
                <th className="px-4 py-2 text-right font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                  Date
                </th>
              </tr>
            </thead>
            <tbody>
              {activity.data.map((entry) => {
                const meta = ACTION_LABELS[entry.action] ?? {
                  label: entry.action,
                  status: 'neutral' as const,
                };
                const ua = entry.user_agent?.slice(0, 40) ?? '—';
                return (
                  <tr key={entry.id} className="border-b border-border/40 last:border-b-0">
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1.5',
                          meta.status === 'success' && 'text-ok-dark',
                          meta.status === 'failed' && 'text-destructive',
                          meta.status === 'neutral' && 'text-muted-foreground',
                        )}
                      >
                        {meta.status === 'success' && '✓ '}
                        {meta.status === 'failed' && '✕ '}
                        {meta.label}
                      </span>
                    </td>
                    <td className="max-w-[180px] truncate px-4 py-3 text-xs text-muted-foreground">
                      {ua}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {entry.ip_address ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                      {format(new Date(entry.created_at), 'd MMM yyyy · HH:mm')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

// ─── Notifications section (real, wired to /notifications/preferences) ──

function NotificationsSection() {
  const prefs = useNotificationPreferences();
  const update = useUpdateNotificationPreferences();

  if (prefs.isLoading || !prefs.data) {
    return <Skeleton className="h-72" />;
  }
  const p = prefs.data;
  const toggle = (k: keyof typeof p) =>
    update.mutate({ [k]: !p[k] } as Partial<typeof p>);

  return (
    <Card
      title="Notification preferences"
      subtitle="Choose what reaches you and where. Email digest cadence applies to non-urgent updates."
    >
      <ul className="divide-y divide-border/60">
        <ToggleRow
          title="Exercise reminders"
          meta="Pushed when a patient misses 2+ assigned exercise days."
          checked={p.exercise_reminders}
          onToggle={() => toggle('exercise_reminders')}
          disabled={update.isPending}
        />
        <ToggleRow
          title="Symptom check-in"
          meta="Daily nudge if you have unread symptom logs from active patients."
          checked={p.symptom_checkin}
          onToggle={() => toggle('symptom_checkin')}
          disabled={update.isPending}
        />
        <ToggleRow
          title="Provider messages"
          meta="In-app messages from patients and other providers on shared cases."
          checked={p.provider_messages}
          onToggle={() => toggle('provider_messages')}
          disabled={update.isPending}
        />
        <ToggleRow
          title="Report updates"
          meta="A patient submits a new report or replies to one of yours."
          checked={p.report_updates}
          onToggle={() => toggle('report_updates')}
          disabled={update.isPending}
        />
        <ToggleRow
          title="Tips & product updates"
          meta="Occasional clinical tips and product release notes."
          checked={p.tips_updates}
          onToggle={() => toggle('tips_updates')}
          disabled={update.isPending}
        />
      </ul>
      <div className="mt-6 border-t border-border/60 pt-5">
        <Field label="Email digest cadence">
          <select
            value={p.email_digest}
            onChange={(e) =>
              update.mutate({ email_digest: e.target.value as typeof p.email_digest })
            }
            disabled={update.isPending}
            className="block w-full rounded-sm border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-gold-600"
          >
            <option value="instant">Instant — email per event</option>
            <option value="daily">Daily — once each morning</option>
            <option value="weekly">Weekly — Monday morning</option>
            <option value="off">Off — no email digests</option>
          </select>
        </Field>
      </div>
    </Card>
  );
}

function ToggleRow({
  title,
  meta,
  checked,
  onToggle,
  disabled,
}: {
  title: string;
  meta: string;
  checked: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <li className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0 flex-1">
        <div className="font-serif text-sm tracking-tightest text-foreground">{title}</div>
        <div className="text-xs text-muted-foreground">{meta}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={onToggle}
        disabled={disabled}
        className={cn(
          'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-50',
          checked ? 'bg-navy-600' : 'bg-secondary',
        )}
      >
        <span
          className={cn(
            'inline-block h-4 w-4 transform rounded-full bg-background transition-transform',
            checked ? 'translate-x-4' : 'translate-x-0.5',
          )}
        />
      </button>
    </li>
  );
}

// ─── Billing section ────────────────────────────────────────────────────

function BillingSection() {
  const billing = useBilling();
  if (billing.isLoading || !billing.data) return <Skeleton className="h-72" />;
  const { plan, payment_method, invoices } = billing.data;

  const tierLabel = plan.tier.charAt(0).toUpperCase() + plan.tier.slice(1);
  const monthly =
    plan.monthly_price_cents === 0
      ? 'Free'
      : `$${(plan.monthly_price_cents / 100).toFixed(2)} / mo`;

  return (
    <div className="space-y-6">
      <Card
        title="Current plan"
        subtitle="Your subscription tier and billing cycle. Pilot accounts are free during onboarding."
      >
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Tier
            </div>
            <div className="mt-1 flex items-center gap-2">
              <span className="font-serif text-2xl tracking-tightest text-foreground">
                {tierLabel}
              </span>
              <Badge variant={plan.status === 'active' ? 'improving' : 'moderate'}>
                {plan.status}
              </Badge>
            </div>
          </div>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Price
            </div>
            <div className="mt-1 font-serif text-2xl tracking-tightest text-foreground">
              {monthly}
            </div>
          </div>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              {plan.current_period_end ? 'Renews' : 'Started'}
            </div>
            <div className="mt-1 font-serif text-base tracking-tightest text-foreground">
              {plan.current_period_end
                ? format(new Date(plan.current_period_end), 'd MMM yyyy')
                : format(new Date(plan.started_at), 'd MMM yyyy')}
            </div>
          </div>
        </div>
        {plan.tier === 'pilot' && (
          <p className="mt-5 rounded-sm border-l-2 border-gold-600 bg-gold-100/40 px-3 py-2 text-xs text-foreground">
            You're on the free pilot. We'll reach out before any paid tier is required.
          </p>
        )}
      </Card>

      <Card
        title="Payment method"
        action={
          <Button variant="outline" size="sm" disabled>
            {payment_method ? 'Change card' : 'Add card'}
          </Button>
        }
      >
        {payment_method ? (
          <p className="text-sm text-foreground">
            {payment_method.brand.toUpperCase()} ·••• {payment_method.last4} · expires{' '}
            {payment_method.exp_month}/{payment_method.exp_year}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            No payment method on file. Not required while you're on the pilot tier.
          </p>
        )}
      </Card>

      <Card title="Invoices">
        {invoices.length === 0 ? (
          <p className="text-sm text-muted-foreground">No invoices yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/70 bg-secondary/30">
                <th className="px-3 py-2 text-left font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                  Date
                </th>
                <th className="px-3 py-2 text-left font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                  Status
                </th>
                <th className="px-3 py-2 text-right font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                  Amount
                </th>
                <th className="px-3 py-2 text-right font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground" />
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-b border-border/40 last:border-b-0">
                  <td className="px-3 py-3 font-mono text-xs text-foreground">
                    {format(new Date(inv.issued_at), 'd MMM yyyy')}
                  </td>
                  <td className="px-3 py-3">
                    <Badge
                      variant={
                        inv.status === 'paid'
                          ? 'improving'
                          : inv.status === 'open'
                            ? 'moderate'
                            : 'inactive'
                      }
                    >
                      {inv.status}
                    </Badge>
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-xs text-foreground">
                    ${(inv.amount_cents / 100).toFixed(2)}
                  </td>
                  <td className="px-3 py-3 text-right">
                    {inv.pdf_url && (
                      <a
                        href={inv.pdf_url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold-700 hover:text-gold-800"
                      >
                        PDF
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

function HelpStub() {
  return (
    <Card title="Help & support">
      <p className="text-sm text-muted-foreground">
        See the dedicated{' '}
        <a href="/help" className="font-medium text-foreground hover:underline">
          Help & support
        </a>{' '}
        page for FAQs, contact form, and system status.
      </p>
    </Card>
  );
}

// ─── Legal section (real, wired to /auth/tos/current + /auth/tos/accept) ──

function LegalSection() {
  const status = useTosStatus();
  const accept = useAcceptTos();
  if (status.isLoading || !status.data) return <Skeleton className="h-48" />;
  const t = status.data;
  return (
    <div className="space-y-6">
      <Card
        title="Terms of Service"
        subtitle={`Current version ${t.current_version} · published ${format(new Date(t.published_at), 'd MMM yyyy')}`}
        action={
          t.accepted ? (
            <Badge variant="improving">
              <CheckCircle2 className="h-3 w-3" />
              Accepted
            </Badge>
          ) : (
            <Button
              size="sm"
              disabled={accept.isPending}
              onClick={() => accept.mutate(t.current_version)}
            >
              {accept.isPending ? 'Recording…' : 'Accept current version'}
            </Button>
          )
        }
      >
        <p className="text-sm text-muted-foreground">
          {t.accepted_at
            ? `You accepted version ${t.accepted_version ?? '—'} on ${format(new Date(t.accepted_at), 'd MMM yyyy · HH:mm')}.`
            : 'You have not yet accepted the current Terms of Service.'}
        </p>
        {!t.accepted && t.accepted_version && (
          <p className="mt-2 rounded-sm border-l-2 border-warn bg-warn/5 px-3 py-2 text-xs text-warn-dark">
            A new version is available. Re-accept to continue using PHI-touching
            features after the next gating window.
          </p>
        )}
      </Card>

      <Card title="Documents">
        <ul className="space-y-2 text-sm">
          <li>
            <a
              href="https://tmjconnect.com/legal/tos"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-foreground hover:underline"
            >
              Terms of Service ({t.current_version})
            </a>
          </li>
          <li>
            <a
              href="https://tmjconnect.com/legal/privacy"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-foreground hover:underline"
            >
              Privacy Policy
            </a>
          </li>
          <li>
            <a
              href="https://tmjconnect.com/legal/baa"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-foreground hover:underline"
            >
              Business Associate Agreement (BAA)
            </a>
          </li>
        </ul>
      </Card>
    </div>
  );
}

// ─── Danger ──────────────────────────────────────────────────────────────

function DangerSection() {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const { logout } = useAuth();

  return (
    <div className="rounded-sm border border-destructive/30 bg-destructive/5 p-6">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-sm bg-destructive/10 text-destructive">
          <AlertTriangle className="h-4 w-4" />
        </span>
        <h3 className="font-serif text-xl tracking-tightest text-destructive">Delete your account</h3>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        Permanently delete your provider account and all associated data. This action cannot be undone.
      </p>
      <ul className="mb-6 space-y-1.5 text-sm text-muted-foreground">
        <li className="flex gap-2">
          <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
          All patient connections will be severed immediately
        </li>
        <li className="flex gap-2">
          <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
          Your exercise library and uploaded videos will be permanently deleted
        </li>
        <li className="flex gap-2">
          <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
          All report history and response data will be erased
        </li>
        <li className="flex gap-2">
          <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
          Patients will be notified that you are no longer on the platform
        </li>
      </ul>
      <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
        Delete account
      </Button>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive">Confirm account deletion</DialogTitle>
            <DialogDescription>
              Type <strong>DELETE</strong> below to confirm. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            placeholder='Type "DELETE" to confirm'
            className="font-mono"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteConfirm !== 'DELETE'}
              onClick={async () => {
                try {
                  const { apiFetch } = await import('@/lib/api');
                  await apiFetch('/providers/me', { method: 'DELETE' });
                } catch {
                  /* best-effort */
                }
                await logout();
              }}
            >
              Delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Shared components ────────────────────────────────────────────────────

function Card({
  id,
  title,
  subtitle,
  action,
  children,
}: {
  id?: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Section id={id} title={title} subtitle={subtitle} action={action}>
      {children}
    </Section>
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

function readDevice(info: Session['device_info']): {
  label: string;
  kind: 'mobile' | 'desktop';
} {
  if (!info) return { label: 'Unknown device', kind: 'desktop' };
  const obj = typeof info === 'string' ? { raw: info } : info;
  const ua = String(
    (obj as Record<string, unknown>).user_agent ?? (obj as Record<string, unknown>).raw ?? '',
  );
  const os = String((obj as Record<string, unknown>).os ?? '');
  const name = String((obj as Record<string, unknown>).name ?? '');
  const isMobile = /iphone|ipad|android|mobile/i.test(ua);
  const label = name || os || (ua ? ua.slice(0, 60) : 'Unknown device');
  return { label, kind: isMobile ? 'mobile' : 'desktop' };
}
