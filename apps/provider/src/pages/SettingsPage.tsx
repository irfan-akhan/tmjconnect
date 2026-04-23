import { useEffect, useRef, useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import {
  AlertTriangle, Camera, Check, Monitor, Shield, Smartphone, Trash2, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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

export function SettingsPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <header className="border-b border-border/70 pb-8">
        <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
          Folio № 08 — Settings
        </div>
        <h1 className="font-serif text-5xl tracking-tightest">
          Your <em className="text-accent">practice profile.</em>
        </h1>
      </header>

      <Tabs defaultValue="profile" className="mt-6">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="danger" className="text-destructive data-[state=active]:text-destructive">
            Danger Zone
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <ProfileTab />
        </TabsContent>

        <TabsContent value="security">
          <SecurityTab />
        </TabsContent>

        <TabsContent value="activity">
          <ActivityTab />
        </TabsContent>

        <TabsContent value="danger">
          <DangerTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Profile Tab ────────────────────────────────────────────────────────────

function ProfileTab() {
  const profile = useProfile();

  return (
    <div className="space-y-2">
      <h2 className="font-serif text-2xl tracking-tightest">Profile</h2>
      <p className="text-sm text-muted-foreground">
        Shown to your patients. Your license details remain private.
      </p>
      <div className="pt-4">
        {profile.isLoading ? (
          <div className="h-96 animate-pulse rounded-sm bg-secondary" />
        ) : profile.data ? (
          <ProfileForm profile={profile.data} />
        ) : null}
      </div>
    </div>
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
  const [saved, setSaved] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  function set<K extends keyof ProfileUpdate>(k: K, v: ProfileUpdate[K]) {
    setForm((f) => ({ ...f, [k]: v }));
    setSaved(false);
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
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : 'Remove failed');
    } finally {
      setAvatarBusy(false);
    }
  }

  const initials = `${form.first_name?.[0] ?? ''}${form.last_name?.[0] ?? ''}`.toUpperCase() || '—';

  useEffect(() => {
    if (update.isSuccess) {
      setSaved(true);
      const t = setTimeout(() => setSaved(false), 2000);
      return () => clearTimeout(t);
    }
  }, [update.isSuccess]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    try {
      await update.mutateAsync(form);
      toast.success('Profile saved.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed.');
    }
  }

  return (
    <form onSubmit={onSave} className="space-y-8 rounded-sm border border-border/70 bg-card p-6">
      {/* Avatar */}
      <div className="flex items-center gap-5 border-b border-border/70 pb-6">
        <div className="relative">
          {form.avatar_url ? (
            <img src={form.avatar_url} alt="" className="h-20 w-20 rounded-sm border border-border object-cover" />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-sm bg-primary font-serif text-2xl tracking-tightest text-primary-foreground">
              {initials}
            </div>
          )}
          {form.avatar_url && (
            <button
              type="button"
              onClick={onRemoveAvatar}
              disabled={avatarBusy}
              className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm transition-colors hover:text-destructive"
              aria-label="Remove avatar"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="flex-1">
          <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Portrait</div>
          <p className="mb-3 text-sm text-muted-foreground">A clear headshot puts patients at ease. JPG or PNG, square, ~400px.</p>
          <div className="flex items-center gap-3">
            <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={avatarBusy}>
              <Camera className="h-4 w-4" />
              {avatarBusy ? 'Uploading…' : form.avatar_url ? 'Replace' : 'Upload portrait'}
            </Button>
            {avatarError && <span className="text-xs text-destructive">{avatarError}</span>}
          </div>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onPickAvatar} />
        </div>
      </div>

      {/* Identity */}
      <div className="space-y-4">
        <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Identity</div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="First name"><Input value={form.first_name ?? ''} onChange={(e) => set('first_name', e.target.value)} required /></Field>
          <Field label="Last name"><Input value={form.last_name ?? ''} onChange={(e) => set('last_name', e.target.value)} required /></Field>
        </div>
        <Field label="Email · read-only"><Input value={profile.email} disabled /></Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Phone · read-only"><Input value={profile.phone ?? '—'} disabled /></Field>
          <Field label="Date of birth · read-only"><Input value={profile.date_of_birth ?? '—'} disabled /></Field>
        </div>
      </div>

      {/* Practice */}
      <div className="space-y-4">
        <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Practice</div>
        <Field label="Clinic name"><Input value={form.clinic_name ?? ''} onChange={(e) => set('clinic_name', e.target.value)} placeholder="Orofacial Wellness Clinic" /></Field>
        <Field label="Specialty"><Input value={form.specialty ?? ''} onChange={(e) => set('specialty', e.target.value)} placeholder="Orofacial pain, TMD" /></Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="City"><Input value={form.city ?? ''} onChange={(e) => set('city', e.target.value || null)} /></Field>
          <Field label="State / Region"><Input value={form.state ?? ''} onChange={(e) => set('state', e.target.value || null)} /></Field>
        </div>
      </div>

      {/* License */}
      <div className="space-y-4">
        <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Credentials · private</div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="License type"><Input value={form.license_type ?? ''} onChange={(e) => set('license_type', e.target.value)} placeholder="DDS, MD, PT…" /></Field>
          <Field label="License number"><Input value={form.license_number ?? ''} onChange={(e) => set('license_number', e.target.value)} /></Field>
        </div>
        <Field label="Post-nominals · comma-separated">
          <Textarea
            rows={2}
            value={(form.credentials ?? []).join(', ')}
            onChange={(e) => set('credentials', e.target.value ? e.target.value.split(',').map((s) => s.trim()).filter(Boolean) : null)}
            placeholder="MSc, FRCD(C)"
          />
        </Field>
      </div>

      {update.isError && (
        <p className="text-sm text-destructive">{update.error instanceof Error ? update.error.message : 'Save failed.'}</p>
      )}

      <div className="flex items-center justify-end gap-3 border-t border-border/70 pt-6">
        {saved && (
          <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-accent">
            <Check className="h-3.5 w-3.5" /> Saved
          </span>
        )}
        <Button type="submit" disabled={update.isPending}>
          {update.isPending ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </form>
  );
}

// ─── Security Tab ───────────────────────────────────────────────────────────

function SecurityTab() {
  const sessions = useSessions();
  const revoke = useRevokeSession();
  const [target, setTarget] = useState<Session | null>(null);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-serif text-2xl tracking-tightest">Sessions</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Everywhere you're currently signed in. Revoke anything unfamiliar — immediately.
        </p>
      </div>

      <div className="overflow-hidden rounded-sm border border-border/70">
        {sessions.isLoading ? (
          Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse border-t border-border/70 bg-secondary first:border-t-0" />
          ))
        ) : !sessions.data || sessions.data.length === 0 ? (
          <p className="bg-card p-8 text-center text-sm text-muted-foreground">No active sessions.</p>
        ) : (
          sessions.data.map((s) => (
            <SessionRow key={s.id} s={s} onRevoke={() => setTarget(s)} />
          ))
        )}
      </div>

      <Dialog open={Boolean(target)} onOpenChange={(v) => !v && setTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Revoke this session?</DialogTitle>
            <DialogDescription>The device will be signed out immediately. If it's yours, you'll need to sign in again.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)}>Cancel</Button>
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

      {/* Change Password */}
      <ChangePasswordSection />
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
    if (newPw !== confirm) { setError('Passwords do not match'); return; }
    setError(null);
    setBusy(true);
    try {
      const { apiFetch } = await import('@/lib/api');
      await apiFetch('/auth/change-password', {
        method: 'PATCH',
        body: { current_password: current, new_password: newPw },
      });
      toast.success('Password changed.');
      setCurrent(''); setNewPw(''); setConfirm('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h3 className="mb-4 font-serif text-xl tracking-tightest">Change password</h3>
      <form onSubmit={onSubmit} className="space-y-4 rounded-sm border border-border/70 bg-card p-6">
        <Field label="Current password">
          <Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required placeholder="Enter current password" />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="New password">
            <Input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} required placeholder="New password" />
          </Field>
          <Field label="Confirm new password">
            <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required placeholder="Confirm password" />
          </Field>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end pt-2">
          <Button type="submit" disabled={busy}>{busy ? 'Updating…' : 'Update password'}</Button>
        </div>
      </form>
    </div>
  );
}

// ─── Activity Tab ───────────────────────────────────────────────────────────

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
  'session_revoked': { label: 'Session revoked', status: 'neutral' },
  'provider_profile_updated': { label: 'Profile updated', status: 'success' },
};

function ActivityTab() {
  const activity = useActivity(20);

  return (
    <div className="space-y-2">
      <h2 className="font-serif text-2xl tracking-tightest">Activity log</h2>
      <p className="text-sm text-muted-foreground">
        Recent account actions — logins, password changes, and security events.
      </p>

      <div className="overflow-hidden rounded-sm border border-border/70 mt-4">
        {activity.isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse border-t border-border/70 bg-secondary first:border-t-0" />
          ))
        ) : !activity.data || activity.data.length === 0 ? (
          <div className="flex flex-col items-center gap-3 bg-card p-10 text-center">
            <Shield className="h-6 w-6 stroke-[1.5] text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/70 bg-secondary/30">
                <th className="px-5 py-3 text-left font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Event</th>
                <th className="px-5 py-3 text-left font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Device</th>
                <th className="px-5 py-3 text-left font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">IP</th>
                <th className="px-5 py-3 text-right font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Date</th>
              </tr>
            </thead>
            <tbody>
              {activity.data.map((entry) => {
                const meta = ACTION_LABELS[entry.action] ?? { label: entry.action, status: 'neutral' as const };
                const ua = entry.user_agent?.slice(0, 40) ?? '—';
                return (
                  <tr key={entry.id} className="border-b border-border/70 last:border-b-0">
                    <td className="px-5 py-3">
                      <span className={
                        meta.status === 'success' ? 'text-emerald-600' : meta.status === 'failed' ? 'text-destructive' : 'text-muted-foreground'
                      }>
                        {meta.status === 'success' && '✓ '}
                        {meta.status === 'failed' && '✕ '}
                        {meta.label}
                      </span>
                    </td>
                    <td className="max-w-[180px] truncate px-5 py-3 text-xs text-muted-foreground">{ua}</td>
                    <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{entry.ip_address ?? '—'}</td>
                    <td className="px-5 py-3 text-right text-xs text-muted-foreground">{format(new Date(entry.created_at), 'MMM d, yyyy · h:mm a')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── Danger Zone Tab ────────────────────────────────────────────────────────

function DangerTab() {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const { logout } = useAuth();

  return (
    <div className="space-y-2">
      <h2 className="font-serif text-2xl tracking-tightest text-destructive">Danger zone</h2>
      <p className="text-sm text-muted-foreground">
        Irreversible actions. Proceed with caution.
      </p>

      <div className="mt-4 rounded-sm border border-destructive/30 bg-destructive/5 p-6">
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-sm bg-destructive/10">
          <AlertTriangle className="h-5 w-5 text-destructive" />
        </div>
        <h3 className="mb-1 text-base font-bold text-destructive">Delete your account</h3>
        <p className="mb-4 text-sm text-muted-foreground">
          Permanently delete your provider account and all associated data. This action cannot be undone.
        </p>
        <ul className="mb-6 space-y-2 text-sm text-muted-foreground">
          <li className="flex gap-2"><span className="font-bold text-destructive">x</span> All patient connections will be severed immediately</li>
          <li className="flex gap-2"><span className="font-bold text-destructive">x</span> Your exercise library and uploaded videos will be permanently deleted</li>
          <li className="flex gap-2"><span className="font-bold text-destructive">x</span> All report history and response data will be erased</li>
          <li className="flex gap-2"><span className="font-bold text-destructive">x</span> Patients will be notified that you are no longer on the platform</li>
        </ul>
        <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
          Delete account
        </Button>
      </div>

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
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteConfirm !== 'DELETE'}
              onClick={async () => {
                try {
                  const { apiFetch } = await import('@/lib/api');
                  await apiFetch('/providers/me', { method: 'DELETE' });
                } catch { /* best-effort */ }
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

// ─── Shared Components ──────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function readDevice(info: Session['device_info']): { label: string; kind: 'mobile' | 'desktop' } {
  if (!info) return { label: 'Unknown device', kind: 'desktop' };
  const obj = typeof info === 'string' ? { raw: info } : info;
  const ua = String((obj as Record<string, unknown>).user_agent ?? (obj as Record<string, unknown>).raw ?? '');
  const os = String((obj as Record<string, unknown>).os ?? '');
  const name = String((obj as Record<string, unknown>).name ?? '');
  const isMobile = /iphone|ipad|android|mobile/i.test(ua);
  const label = name || os || (ua ? ua.slice(0, 60) : 'Unknown device');
  return { label, kind: isMobile ? 'mobile' : 'desktop' };
}

function SessionRow({ s, onRevoke }: { s: Session; onRevoke: () => void }) {
  const { label, kind } = readDevice(s.device_info);
  const Icon = kind === 'mobile' ? Smartphone : Monitor;
  return (
    <div className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-4 border-t border-border/70 bg-card p-5 first:border-t-0">
      <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-secondary">
        <Icon className="h-5 w-5 stroke-[1.5]" />
      </div>
      <div className="min-w-0">
        <div className="truncate font-serif text-base tracking-tightest">{label}</div>
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
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
        <Trash2 className="h-4 w-4" /> Revoke
      </Button>
    </div>
  );
}
