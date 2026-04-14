import { useEffect, useRef, useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { Camera, Check, Monitor, Smartphone, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  uploadAvatar,
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
    <div className="mx-auto max-w-4xl space-y-12">
      <header className="border-b border-border/70 pb-8">
        <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
          Folio № 06 — Settings
        </div>
        <h1 className="font-serif text-5xl tracking-tightest">
          Your <em className="text-accent">practice profile.</em>
        </h1>
      </header>

      <ProfileSection />
      <SessionsSection />
    </div>
  );
}

// ─── Profile ─────────────────────────────────────────────────────────────────

function ProfileSection() {
  const profile = useProfile();
  return (
    <section className="grid gap-8 lg:grid-cols-[1fr_2fr]">
      <div>
        <h2 className="font-serif text-2xl tracking-tightest">Profile</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Shown to your patients. Your license details remain private.
        </p>
      </div>
      {profile.isLoading ? (
        <div className="h-96 animate-pulse rounded-sm bg-secondary" />
      ) : profile.data ? (
        <ProfileForm profile={profile.data} />
      ) : null}
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
      // Persist immediately so the avatar survives without a separate "Save".
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
            <img
              src={form.avatar_url}
              alt=""
              className="h-20 w-20 rounded-sm border border-border object-cover"
            />
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
          <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Portrait
          </div>
          <p className="mb-3 text-sm text-muted-foreground">
            A clear headshot puts patients at ease. JPG or PNG, square, ~400px.
          </p>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileRef.current?.click()}
              disabled={avatarBusy}
            >
              <Camera className="h-4 w-4" />
              {avatarBusy ? 'Uploading…' : form.avatar_url ? 'Replace' : 'Upload portrait'}
            </Button>
            {avatarError && <span className="text-xs text-destructive">{avatarError}</span>}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={onPickAvatar}
          />
        </div>
      </div>

      {/* Identity */}
      <div className="space-y-4">
        <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          Identity
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="First name">
            <Input
              value={form.first_name ?? ''}
              onChange={(e) => set('first_name', e.target.value)}
              required
            />
          </Field>
          <Field label="Last name">
            <Input
              value={form.last_name ?? ''}
              onChange={(e) => set('last_name', e.target.value)}
              required
            />
          </Field>
        </div>
        <Field label="Email · read-only">
          <Input value={profile.email} disabled />
        </Field>
      </div>

      {/* Practice */}
      <div className="space-y-4">
        <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          Practice
        </div>
        <Field label="Clinic name">
          <Input
            value={form.clinic_name ?? ''}
            onChange={(e) => set('clinic_name', e.target.value)}
            placeholder="Orofacial Wellness Clinic"
          />
        </Field>
        <Field label="Specialty">
          <Input
            value={form.specialty ?? ''}
            onChange={(e) => set('specialty', e.target.value)}
            placeholder="Orofacial pain, TMD"
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="City">
            <Input
              value={form.city ?? ''}
              onChange={(e) => set('city', e.target.value || null)}
            />
          </Field>
          <Field label="State / Region">
            <Input
              value={form.state ?? ''}
              onChange={(e) => set('state', e.target.value || null)}
            />
          </Field>
        </div>
      </div>

      {/* License */}
      <div className="space-y-4">
        <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          Credentials · private
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="License type">
            <Input
              value={form.license_type ?? ''}
              onChange={(e) => set('license_type', e.target.value)}
              placeholder="DDS, MD, PT…"
            />
          </Field>
          <Field label="License number">
            <Input
              value={form.license_number ?? ''}
              onChange={(e) => set('license_number', e.target.value)}
            />
          </Field>
        </div>
        <Field label="Post-nominals · comma-separated">
          <Textarea
            rows={2}
            value={(form.credentials ?? []).join(', ')}
            onChange={(e) =>
              set(
                'credentials',
                e.target.value
                  ? e.target.value
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean)
                  : null,
              )
            }
            placeholder="MSc, FRCD(C)"
          />
        </Field>
      </div>

      {update.isError && (
        <p className="text-sm text-destructive">
          {update.error instanceof Error ? update.error.message : 'Save failed.'}
        </p>
      )}

      <div className="flex items-center justify-end gap-3 border-t border-border/70 pt-6">
        {saved && (
          <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-accent">
            <Check className="h-3.5 w-3.5" />
            Saved
          </span>
        )}
        <Button type="submit" disabled={update.isPending}>
          {update.isPending ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

// ─── Sessions ────────────────────────────────────────────────────────────────

function SessionsSection() {
  const sessions = useSessions();
  const revoke = useRevokeSession();
  const [target, setTarget] = useState<Session | null>(null);

  return (
    <section className="grid gap-8 lg:grid-cols-[1fr_2fr]">
      <div>
        <h2 className="font-serif text-2xl tracking-tightest">Sessions</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Everywhere you're currently signed in. Revoke anything unfamiliar —
          immediately.
        </p>
      </div>

      <div className="overflow-hidden rounded-sm border border-border/70">
        {sessions.isLoading ? (
          Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse border-t border-border/70 bg-secondary first:border-t-0" />
          ))
        ) : !sessions.data || sessions.data.length === 0 ? (
          <p className="bg-card p-8 text-center text-sm text-muted-foreground">
            No active sessions.
          </p>
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
    </section>
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
        <Trash2 className="h-4 w-4" />
        Revoke
      </Button>
    </div>
  );
}
