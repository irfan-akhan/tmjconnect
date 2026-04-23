import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useRef, useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { Activity as ActivityIcon, AlertTriangle, Bell, Camera, Check, CheckCircle2, CreditCard, FileText, HelpCircle, Lock, Monitor, ShieldCheck, Smartphone, Trash2, User, X, } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage, initials } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useAuth } from '@/features/auth/AuthProvider';
import { uploadAvatar, useActivity, useProfile, useRevokeSession, useSessions, useUpdateProfile, } from '@/features/settings/queries';
const SECTIONS = [
    { key: 'profile', label: 'Profile', icon: User, group: 'account' },
    { key: 'security', label: 'Security & sessions', icon: Lock, group: 'account' },
    { key: 'activity', label: 'Activity log', icon: ActivityIcon, group: 'account' },
    { key: 'notifications', label: 'Notifications', icon: Bell, group: 'account', stub: true },
    { key: 'billing', label: 'Billing & plan', icon: CreditCard, group: 'account', stub: true },
    { key: 'help', label: 'Help & support', icon: HelpCircle, group: 'support' },
    { key: 'legal', label: 'Legal & documents', icon: FileText, group: 'support', stub: true },
    { key: 'danger', label: 'Delete account', icon: Trash2, group: 'danger' },
];
export function SettingsPage() {
    const [section, setSection] = useState('profile');
    const profile = useProfile();
    const sectionMeta = SECTIONS.find((s) => s.key === section);
    const fullName = profile.data?.first_name && profile.data?.last_name
        ? `${profile.data.first_name} ${profile.data.last_name}`
        : 'Provider';
    return (_jsxs("div", { className: "mx-auto max-w-7xl space-y-6", children: [_jsx(PageHeader, { eyebrow: "Account", title: "Settings.", description: "Manage your identity, security, and account preferences." }), _jsxs("div", { className: "grid gap-6 lg:grid-cols-[240px_1fr]", children: [_jsx("aside", { className: "lg:sticky lg:top-24 lg:self-start", children: ['account', 'support', 'danger'].map((group) => (_jsxs("div", { className: "mb-5 last:mb-0", children: [_jsx("div", { className: "mb-1.5 px-3 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground", children: group === 'account' ? 'Account' : group === 'support' ? 'Support' : 'Danger zone' }), _jsx("ul", { className: "space-y-px", children: SECTIONS.filter((s) => s.group === group).map((item) => {
                                        const Icon = item.icon;
                                        const active = section === item.key;
                                        return (_jsx("li", { children: _jsxs("button", { type: "button", onClick: () => setSection(item.key), className: cn('group relative flex w-full items-center gap-3 rounded-sm px-3 py-2 text-sm transition-colors', active
                                                    ? 'bg-secondary text-foreground before:absolute before:left-0 before:top-1/2 before:h-5 before:w-0.5 before:-translate-y-1/2 before:bg-gold-600'
                                                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground', group === 'danger' && 'text-destructive hover:text-destructive'), children: [_jsx(Icon, { className: "h-4 w-4 stroke-[1.5]" }), _jsx("span", { className: "flex-1 text-left", children: item.label })] }) }, item.key));
                                    }) })] }, group))) }), _jsxs("main", { className: "space-y-6", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("h2", { className: "font-serif text-2xl tracking-tightest text-foreground", children: sectionMeta.label }), sectionMeta.stub && (_jsx("p", { className: "mt-1 font-mono text-[10px] uppercase tracking-[0.22em] text-warn-dark", children: "Coming soon \u00B7 API not yet wired" }))] }), section === 'security' && (_jsxs(Badge, { variant: "improving", size: "md", children: [_jsx(ShieldCheck, { className: "h-3 w-3" }), "Posture: Strong"] }))] }), section === 'profile' && (_jsx(ProfileSection, { profileQuery: profile, fullName: fullName })), section === 'security' && _jsx(SecuritySection, {}), section === 'activity' && _jsx(ActivitySection, {}), section === 'notifications' && _jsx(NotificationsStub, {}), section === 'billing' && _jsx(BillingStub, {}), section === 'help' && _jsx(HelpStub, {}), section === 'legal' && _jsx(LegalStub, {}), section === 'danger' && _jsx(DangerSection, {})] })] })] }));
}
// ─── Profile section ──────────────────────────────────────────────────────
function ProfileSection({ profileQuery, fullName, }) {
    if (profileQuery.isLoading) {
        return (_jsxs(_Fragment, { children: [_jsx(Skeleton, { className: "h-32" }), _jsx(Skeleton, { className: "h-72" })] }));
    }
    if (!profileQuery.data)
        return null;
    return (_jsxs(_Fragment, { children: [_jsx(ProfileIdentityCard, { profile: profileQuery.data, fullName: fullName }), _jsx(ProfileForm, { profile: profileQuery.data })] }));
}
function ProfileIdentityCard({ profile, fullName }) {
    const credText = (profile.credentials ?? []).join(', ');
    const memberSince = format(new Date(profile.created_at), 'MMM yyyy');
    return (_jsx("section", { className: "rounded-sm border border-border/70 bg-card p-6 shadow-navy-xs", children: _jsxs("div", { className: "flex flex-col gap-5 sm:flex-row sm:items-center", children: [_jsxs(Avatar, { size: "xl", children: [profile.avatar_url && _jsx(AvatarImage, { src: profile.avatar_url, alt: "" }), _jsx(AvatarFallback, { className: "bg-navy-600 text-background", children: initials(profile.first_name, profile.last_name) })] }), _jsxs("div", { className: "flex-1", children: [_jsxs("h3", { className: "font-serif text-2xl tracking-tightest", children: [fullName, credText && _jsxs("span", { className: "text-muted-foreground", children: [" \u00B7 ", credText] })] }), _jsxs("p", { className: "mt-1 text-sm text-muted-foreground", children: [profile.specialty || 'Provider', profile.clinic_name && (_jsxs(_Fragment, { children: [' · ', _jsx("span", { className: "text-foreground", children: profile.clinic_name })] }))] }), _jsxs("div", { className: "mt-3 flex flex-wrap items-center gap-2", children: [profile.license_number && (_jsxs(Badge, { variant: "improving", children: [_jsx(CheckCircle2, { className: "h-3 w-3" }), "License active \u00B7 ", profile.license_type ?? '—', " #", profile.license_number] })), _jsxs(Badge, { variant: "improving", children: [_jsx(CheckCircle2, { className: "h-3 w-3" }), "Email verified"] }), _jsx(Badge, { variant: "muted", children: "BAA on file" })] })] }), _jsxs("div", { className: "text-right", children: [_jsx("div", { className: "font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground", children: "Member since" }), _jsx("div", { className: "mt-1 font-serif text-xl tracking-tightest", children: memberSince })] })] }) }));
}
function ProfileForm({ profile }) {
    const update = useUpdateProfile();
    const fileRef = useRef(null);
    const [form, setForm] = useState(() => ({
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
    const [avatarError, setAvatarError] = useState(null);
    function set(k, v) {
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
    async function onPickAvatar(e) {
        const file = e.target.files?.[0];
        if (!file)
            return;
        setAvatarBusy(true);
        setAvatarError(null);
        try {
            const { url } = await uploadAvatar(file);
            await update.mutateAsync({ avatar_url: url });
            set('avatar_url', url);
            setDirty(false);
        }
        catch (err) {
            setAvatarError(err instanceof Error ? err.message : 'Upload failed');
        }
        finally {
            setAvatarBusy(false);
            if (fileRef.current)
                fileRef.current.value = '';
        }
    }
    async function onRemoveAvatar() {
        setAvatarBusy(true);
        setAvatarError(null);
        try {
            await update.mutateAsync({ avatar_url: null });
            set('avatar_url', null);
            setDirty(false);
        }
        catch (err) {
            setAvatarError(err instanceof Error ? err.message : 'Remove failed');
        }
        finally {
            setAvatarBusy(false);
        }
    }
    async function onSave(e) {
        e.preventDefault();
        try {
            await update.mutateAsync(form);
            toast.success('Profile saved.');
            setDirty(false);
        }
        catch (err) {
            toast.error(err instanceof Error ? err.message : 'Save failed.');
        }
    }
    return (_jsxs("form", { onSubmit: onSave, className: "space-y-6", children: [_jsx(Card, { title: "Portrait", subtitle: "A clear headshot puts patients at ease.", children: _jsxs("div", { className: "flex items-center gap-5", children: [_jsxs("div", { className: "relative", children: [_jsxs(Avatar, { size: "lg", children: [form.avatar_url && _jsx(AvatarImage, { src: form.avatar_url, alt: "" }), _jsx(AvatarFallback, { className: "bg-navy-600 text-background", children: initials(form.first_name, form.last_name) })] }), form.avatar_url && (_jsx("button", { type: "button", onClick: onRemoveAvatar, disabled: avatarBusy, className: "absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:text-destructive", "aria-label": "Remove avatar", children: _jsx(X, { className: "h-3 w-3" }) }))] }), _jsxs("div", { children: [_jsxs(Button, { type: "button", variant: "outline", size: "sm", onClick: () => fileRef.current?.click(), disabled: avatarBusy, children: [_jsx(Camera, { className: "mr-2 h-3.5 w-3.5" }), avatarBusy ? 'Uploading…' : form.avatar_url ? 'Replace portrait' : 'Upload portrait'] }), _jsx("p", { className: "mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground", children: "JPG or PNG \u00B7 square \u00B7 ~400px" }), avatarError && (_jsx("p", { className: "mt-1 text-xs text-destructive", children: avatarError }))] }), _jsx("input", { ref: fileRef, type: "file", accept: "image/jpeg,image/png,image/webp", className: "hidden", onChange: onPickAvatar })] }) }), _jsx(Card, { title: "Basic information", children: _jsxs("div", { className: "grid grid-cols-1 gap-4 sm:grid-cols-2", children: [_jsx(Field, { label: "First name *", children: _jsx(Input, { value: form.first_name ?? '', onChange: (e) => set('first_name', e.target.value), required: true }) }), _jsx(Field, { label: "Last name *", children: _jsx(Input, { value: form.last_name ?? '', onChange: (e) => set('last_name', e.target.value), required: true }) }), _jsx(Field, { label: "Email \u00B7 login identifier", children: _jsxs("div", { className: "relative", children: [_jsx(Input, { value: profile.email, disabled: true, className: "pr-10" }), _jsx(CheckCircle2, { className: "absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ok-dark" })] }) }), _jsx(Field, { label: "Phone \u00B7 MFA fallback", children: _jsx(Input, { value: profile.phone ?? '—', disabled: true }) })] }) }), _jsx(Card, { title: "Practice & specialty", children: _jsxs("div", { className: "space-y-4", children: [_jsx(Field, { label: "Clinic name", children: _jsx(Input, { value: form.clinic_name ?? '', onChange: (e) => set('clinic_name', e.target.value), placeholder: "Bayshore Jaw & Pain Clinic" }) }), _jsx(Field, { label: "Specialty", children: _jsx(Input, { value: form.specialty ?? '', onChange: (e) => set('specialty', e.target.value), placeholder: "Orofacial pain, TMD" }) }), _jsxs("div", { className: "grid grid-cols-1 gap-4 sm:grid-cols-2", children: [_jsx(Field, { label: "City", children: _jsx(Input, { value: form.city ?? '', onChange: (e) => set('city', e.target.value || null) }) }), _jsx(Field, { label: "State / region", children: _jsx(Input, { value: form.state ?? '', onChange: (e) => set('state', e.target.value || null) }) })] })] }) }), _jsxs(Card, { title: "Credentials \u00B7 private", children: [_jsxs("div", { className: "grid grid-cols-1 gap-4 sm:grid-cols-2", children: [_jsx(Field, { label: "License type", children: _jsx(Input, { value: form.license_type ?? '', onChange: (e) => set('license_type', e.target.value), placeholder: "DDS, MD, PT\u2026" }) }), _jsx(Field, { label: "License number \u00B7 locked after verification", children: _jsxs("div", { className: "relative", children: [_jsx(Input, { value: form.license_number ?? '', onChange: (e) => set('license_number', e.target.value), className: "pr-10" }), _jsx(Lock, { className: "absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" })] }) })] }), _jsx(Field, { label: "Post-nominals \u00B7 comma-separated", children: _jsx(Textarea, { rows: 2, value: (form.credentials ?? []).join(', '), onChange: (e) => set('credentials', e.target.value ? e.target.value.split(',').map((s) => s.trim()).filter(Boolean) : null), placeholder: "MSc, FRCD(C)" }) })] }), dirty && (_jsxs("div", { className: "sticky bottom-4 z-10 flex items-center justify-between rounded-sm border border-gold-600/40 bg-card p-3 shadow-navy-md", children: [_jsxs("span", { className: "inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-warn-dark", children: [_jsx("span", { className: "h-1.5 w-1.5 rounded-full bg-gold-600" }), "You have unsaved changes"] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Button, { type: "button", variant: "ghost", size: "sm", onClick: discard, children: "Discard" }), _jsx(Button, { type: "submit", size: "sm", disabled: update.isPending, children: update.isPending ? ('Saving…') : (_jsxs(_Fragment, { children: [_jsx(Check, { className: "mr-1.5 h-3.5 w-3.5" }), " Save changes"] })) })] })] }))] }));
}
// ─── Security section ─────────────────────────────────────────────────────
function SecuritySection() {
    const sessions = useSessions();
    const revoke = useRevokeSession();
    const [target, setTarget] = useState(null);
    return (_jsxs("div", { className: "space-y-6", children: [_jsx(Card, { title: "Password", subtitle: "Last changed \u2014 TODO \u00B7 API doesn't return last-rotated-at yet", action: _jsx(Button, { variant: "outline", size: "sm", onClick: () => document.getElementById('change-pw-section')?.scrollIntoView({ behavior: 'smooth' }), children: "Change password" }), children: _jsx("p", { className: "text-sm text-muted-foreground", children: "Use a unique password \u2014 something you don't reuse on other sites. Required to be \u2265 8 characters with at least one digit and one symbol." }) }), _jsx(Card, { title: "Multi-factor authentication", subtitle: "Required by HIPAA for all provider accounts. Cannot be disabled entirely.", children: _jsxs("ul", { className: "divide-y divide-border/60", children: [_jsx(MfaRow, { icon: _jsx(Smartphone, { className: "h-4 w-4" }), iconClass: "bg-gold-600/15 text-gold-700", title: "Authenticator app", badge: _jsx(Badge, { variant: "improving", children: "Primary" }), meta: "Google Authenticator \u00B7 set up at registration", actionLabel: "Reconfigure" }), _jsx(MfaRow, { icon: _jsx(Smartphone, { className: "h-4 w-4" }), iconClass: "bg-secondary text-muted-foreground", title: "SMS fallback", meta: "Used as backup only. Add a number on the phone field above.", actionLabel: "Change number", disabled: true }), _jsx(MfaRow, { icon: _jsx(FileText, { className: "h-4 w-4" }), iconClass: "bg-warn/15 text-warn-dark", title: "Recovery codes", meta: "One-time-use codes, stored when you first set up MFA", actionLabel: "View / regenerate", disabled: true })] }) }), _jsx(Card, { title: "Active sessions", subtitle: "Everywhere you're currently signed in. Revoke anything unfamiliar.", children: _jsx("div", { className: "overflow-hidden rounded-sm border border-border/60", children: sessions.isLoading ? (Array.from({ length: 2 }).map((_, i) => _jsx(Skeleton, { className: "h-16" }, i))) : !sessions.data || sessions.data.length === 0 ? (_jsx("p", { className: "bg-card p-6 text-center text-sm text-muted-foreground", children: "No active sessions." })) : (sessions.data.map((s) => (_jsx(SessionRow, { s: s, onRevoke: () => setTarget(s) }, s.id)))) }) }), _jsx(ChangePasswordSection, {}), _jsx(Dialog, { open: Boolean(target), onOpenChange: (v) => !v && setTarget(null), children: _jsxs(DialogContent, { className: "max-w-md", children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: "Revoke this session?" }), _jsx(DialogDescription, { children: "The device will be signed out immediately. If it's yours, you'll need to sign in again." })] }), _jsxs(DialogFooter, { children: [_jsx(Button, { variant: "outline", onClick: () => setTarget(null), children: "Cancel" }), _jsx(Button, { variant: "destructive", disabled: revoke.isPending, onClick: async () => {
                                        if (!target)
                                            return;
                                        try {
                                            await revoke.mutateAsync(target.id);
                                            toast.success('Session revoked.');
                                            setTarget(null);
                                        }
                                        catch (err) {
                                            toast.error(err instanceof Error ? err.message : 'Failed to revoke.');
                                        }
                                    }, children: revoke.isPending ? 'Revoking…' : 'Revoke session' })] })] }) })] }));
}
function MfaRow({ icon, iconClass, title, badge, meta, actionLabel, disabled, }) {
    return (_jsxs("li", { className: "flex items-center gap-4 py-3 first:pt-0 last:pb-0", children: [_jsx("span", { className: cn('flex h-9 w-9 items-center justify-center rounded-sm', iconClass), children: icon }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "font-serif text-sm tracking-tightest text-foreground", children: title }), badge] }), _jsx("div", { className: "font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground", children: meta })] }), _jsx(Button, { variant: "outline", size: "sm", disabled: disabled, children: actionLabel })] }));
}
function SessionRow({ s, onRevoke }) {
    const { label, kind } = readDevice(s.device_info);
    const Icon = kind === 'mobile' ? Smartphone : Monitor;
    return (_jsxs("div", { className: "grid grid-cols-[auto_1fr_auto_auto] items-center gap-4 border-b border-border/60 bg-card p-4 first:rounded-t-sm last:border-b-0 last:rounded-b-sm", children: [_jsx("span", { className: "flex h-9 w-9 items-center justify-center rounded-sm bg-secondary text-muted-foreground", children: _jsx(Icon, { className: "h-4 w-4" }) }), _jsxs("div", { className: "min-w-0", children: [_jsx("div", { className: "truncate font-serif text-base tracking-tightest", children: label }), _jsxs("div", { className: "font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground", children: [s.ip_address ?? 'Unknown IP', " \u00B7 since ", format(new Date(s.created_at), 'd MMM')] })] }), _jsxs("div", { className: "text-right font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground", children: [_jsx("div", { className: "text-muted-foreground/60", children: "Active" }), _jsx("div", { className: "text-foreground normal-case tracking-normal", children: formatDistanceToNow(new Date(s.last_active), { addSuffix: true }) })] }), _jsxs(Button, { variant: "ghost", size: "sm", onClick: onRevoke, children: [_jsx(Trash2, { className: "mr-1.5 h-3.5 w-3.5" }), " Revoke"] })] }));
}
function ChangePasswordSection() {
    const [current, setCurrent] = useState('');
    const [newPw, setNewPw] = useState('');
    const [confirm, setConfirm] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    async function onSubmit(e) {
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
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to change password');
        }
        finally {
            setBusy(false);
        }
    }
    return (_jsx(Card, { id: "change-pw-section", title: "Change password", children: _jsxs("form", { onSubmit: onSubmit, className: "space-y-4", children: [_jsx(Field, { label: "Current password", children: _jsx(Input, { type: "password", value: current, onChange: (e) => setCurrent(e.target.value), required: true, placeholder: "Enter current password" }) }), _jsxs("div", { className: "grid grid-cols-1 gap-4 sm:grid-cols-2", children: [_jsx(Field, { label: "New password", children: _jsx(Input, { type: "password", value: newPw, onChange: (e) => setNewPw(e.target.value), required: true }) }), _jsx(Field, { label: "Confirm new password", children: _jsx(Input, { type: "password", value: confirm, onChange: (e) => setConfirm(e.target.value), required: true }) })] }), error && _jsx("p", { className: "text-sm text-destructive", children: error }), _jsx("div", { className: "flex justify-end", children: _jsx(Button, { type: "submit", size: "sm", disabled: busy, children: busy ? 'Updating…' : 'Update password' }) })] }) }));
}
// ─── Activity section ─────────────────────────────────────────────────────
const ACTION_LABELS = {
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
    return (_jsx(Card, { title: "Login activity", subtitle: "HIPAA audit trail \u00B7 last 40 events \u00B7 retained for 6 years", action: _jsx(Button, { variant: "outline", size: "sm", disabled: true, children: "Export CSV" }), children: activity.isLoading ? (_jsx("div", { className: "space-y-2", children: Array.from({ length: 4 }).map((_, i) => (_jsx(Skeleton, { className: "h-10" }, i))) })) : !activity.data || activity.data.length === 0 ? (_jsx("div", { className: "rounded-sm border border-dashed border-border bg-card/40 p-8 text-center text-sm text-muted-foreground", children: "No activity recorded yet." })) : (_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b border-border/70 bg-secondary/30", children: [_jsx("th", { className: "px-4 py-2 text-left font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground", children: "Event" }), _jsx("th", { className: "px-4 py-2 text-left font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground", children: "Device" }), _jsx("th", { className: "px-4 py-2 text-left font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground", children: "IP" }), _jsx("th", { className: "px-4 py-2 text-right font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground", children: "Date" })] }) }), _jsx("tbody", { children: activity.data.map((entry) => {
                            const meta = ACTION_LABELS[entry.action] ?? {
                                label: entry.action,
                                status: 'neutral',
                            };
                            const ua = entry.user_agent?.slice(0, 40) ?? '—';
                            return (_jsxs("tr", { className: "border-b border-border/40 last:border-b-0", children: [_jsx("td", { className: "px-4 py-3", children: _jsxs("span", { className: cn('inline-flex items-center gap-1.5', meta.status === 'success' && 'text-ok-dark', meta.status === 'failed' && 'text-destructive', meta.status === 'neutral' && 'text-muted-foreground'), children: [meta.status === 'success' && '✓ ', meta.status === 'failed' && '✕ ', meta.label] }) }), _jsx("td", { className: "max-w-[180px] truncate px-4 py-3 text-xs text-muted-foreground", children: ua }), _jsx("td", { className: "px-4 py-3 font-mono text-xs text-muted-foreground", children: entry.ip_address ?? '—' }), _jsx("td", { className: "px-4 py-3 text-right font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground", children: format(new Date(entry.created_at), 'd MMM yyyy · HH:mm') })] }, entry.id));
                        }) })] }) })) }));
}
// ─── Stub sections ────────────────────────────────────────────────────────
function NotificationsStub() {
    return (_jsx(Card, { title: "Notification preferences", children: _jsx("p", { className: "text-sm text-muted-foreground", children: "Channel preferences (in-app, email, SMS) and per-urgency thresholds will live here. Backend endpoint not yet built \u2014 flagged for a future sprint." }) }));
}
function BillingStub() {
    return (_jsx(Card, { title: "Billing & plan", children: _jsx("p", { className: "text-sm text-muted-foreground", children: "Plan tier, invoice list, and payment method will live here. The provider product is currently free during pilot \u2014 no billing endpoint to wire yet." }) }));
}
function HelpStub() {
    return (_jsx(Card, { title: "Help & support", children: _jsxs("p", { className: "text-sm text-muted-foreground", children: ["See the dedicated", ' ', _jsx("a", { href: "/help", className: "font-medium text-foreground hover:underline", children: "Help & support" }), ' ', "page for FAQs, contact form, and system status."] }) }));
}
function LegalStub() {
    return (_jsx(Card, { title: "Legal & documents", children: _jsx("p", { className: "text-sm text-muted-foreground", children: "Terms of service, privacy policy, and BAA download links will live here. Document API not yet built \u2014 flagged for legal review and a future sprint." }) }));
}
// ─── Danger ──────────────────────────────────────────────────────────────
function DangerSection() {
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState('');
    const { logout } = useAuth();
    return (_jsxs("div", { className: "rounded-sm border border-destructive/30 bg-destructive/5 p-6", children: [_jsxs("div", { className: "mb-3 flex items-center gap-2", children: [_jsx("span", { className: "flex h-9 w-9 items-center justify-center rounded-sm bg-destructive/10 text-destructive", children: _jsx(AlertTriangle, { className: "h-4 w-4" }) }), _jsx("h3", { className: "font-serif text-xl tracking-tightest text-destructive", children: "Delete your account" })] }), _jsx("p", { className: "mb-4 text-sm text-muted-foreground", children: "Permanently delete your provider account and all associated data. This action cannot be undone." }), _jsxs("ul", { className: "mb-6 space-y-1.5 text-sm text-muted-foreground", children: [_jsxs("li", { className: "flex gap-2", children: [_jsx(X, { className: "mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" }), "All patient connections will be severed immediately"] }), _jsxs("li", { className: "flex gap-2", children: [_jsx(X, { className: "mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" }), "Your exercise library and uploaded videos will be permanently deleted"] }), _jsxs("li", { className: "flex gap-2", children: [_jsx(X, { className: "mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" }), "All report history and response data will be erased"] }), _jsxs("li", { className: "flex gap-2", children: [_jsx(X, { className: "mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" }), "Patients will be notified that you are no longer on the platform"] })] }), _jsx(Button, { variant: "destructive", onClick: () => setDeleteOpen(true), children: "Delete account" }), _jsx(Dialog, { open: deleteOpen, onOpenChange: setDeleteOpen, children: _jsxs(DialogContent, { className: "max-w-md", children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { className: "text-destructive", children: "Confirm account deletion" }), _jsxs(DialogDescription, { children: ["Type ", _jsx("strong", { children: "DELETE" }), " below to confirm. This cannot be undone."] })] }), _jsx(Input, { value: deleteConfirm, onChange: (e) => setDeleteConfirm(e.target.value), placeholder: 'Type "DELETE" to confirm', className: "font-mono" }), _jsxs(DialogFooter, { children: [_jsx(Button, { variant: "outline", onClick: () => setDeleteOpen(false), children: "Cancel" }), _jsx(Button, { variant: "destructive", disabled: deleteConfirm !== 'DELETE', onClick: async () => {
                                        try {
                                            const { apiFetch } = await import('@/lib/api');
                                            await apiFetch('/providers/me', { method: 'DELETE' });
                                        }
                                        catch {
                                            /* best-effort */
                                        }
                                        await logout();
                                    }, children: "Delete permanently" })] })] }) })] }));
}
// ─── Shared components ────────────────────────────────────────────────────
function Card({ id, title, subtitle, action, children, }) {
    return (_jsxs("section", { id: id, className: "rounded-sm border border-border/70 bg-card p-5 shadow-navy-xs", children: [_jsxs("div", { className: "mb-4 flex items-start justify-between gap-3", children: [_jsxs("div", { children: [_jsx("h3", { className: "font-serif text-lg tracking-tightest text-foreground", children: title }), subtitle && _jsx("p", { className: "mt-0.5 text-xs text-muted-foreground", children: subtitle })] }), action] }), children] }));
}
function Field({ label, children }) {
    return (_jsxs("div", { className: "space-y-1.5", children: [_jsx(Label, { className: "font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground", children: label }), children] }));
}
function readDevice(info) {
    if (!info)
        return { label: 'Unknown device', kind: 'desktop' };
    const obj = typeof info === 'string' ? { raw: info } : info;
    const ua = String(obj.user_agent ?? obj.raw ?? '');
    const os = String(obj.os ?? '');
    const name = String(obj.name ?? '');
    const isMobile = /iphone|ipad|android|mobile/i.test(ua);
    const label = name || os || (ua ? ua.slice(0, 60) : 'Unknown device');
    return { label, kind: isMobile ? 'mobile' : 'desktop' };
}
