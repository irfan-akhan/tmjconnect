import { jsxs as _jsxs, Fragment as _Fragment, jsx as _jsx } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { format, formatDistanceToNowStrict } from 'date-fns';
import { toast } from 'sonner';
import { Check, Clock, Copy, Link2, Mail, Plus, QrCode, Unlink, Users, XCircle, } from 'lucide-react';
import { Avatar, AvatarFallback, initials } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { FilterPill } from '@/components/ui/filter-pill';
import { Input } from '@/components/ui/input';
import { KpiCard } from '@/components/ui/kpi-card';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useDisconnectLink, useEmailInvite, useGenerateCode, useLinkingCodes, useLinks, } from '@/features/linking/queries';
export function LinkingPage() {
    const codes = useLinkingCodes();
    const links = useLinks();
    const generate = useGenerateCode();
    const [tab, setTab] = useState('active');
    const [inviteFor, setInviteFor] = useState(null);
    const [disconnectTarget, setDisconnectTarget] = useState(null);
    const allCodes = codes.data ?? [];
    const pending = useMemo(() => allCodes.filter((c) => c.status === 'pending'), [allCodes]);
    const history = useMemo(() => allCodes.filter((c) => c.status !== 'pending'), [allCodes]);
    const allLinks = links.data ?? [];
    const acceptedCount = allCodes.filter((c) => c.status === 'accepted').length;
    const totalIssued = allCodes.length || 1;
    const redemptionPct = Math.round((acceptedCount / totalIssued) * 100);
    return (_jsxs("div", { className: "mx-auto max-w-7xl space-y-8", children: [_jsx(PageHeader, { eyebrow: "Manage \u00B7 Invite & link", title: "Invite & link patients.", description: _jsxs(_Fragment, { children: ["Securely connect new patients or manage existing connections \u00B7", ' ', _jsxs("span", { className: "text-foreground", children: [allLinks.length, " active"] })] }), actions: _jsxs(_Fragment, { children: [_jsxs(Button, { variant: "outline", size: "sm", disabled: pending.length === 0, onClick: () => setInviteFor(pending[0] ?? null), children: [_jsx(Mail, { className: "mr-2 h-3.5 w-3.5" }), "Email invite"] }), _jsxs(Button, { size: "sm", disabled: generate.isPending, onClick: () => generate.mutate(undefined, {
                                onSuccess: (code) => toast.success(`Invite code ${code.code} generated.`),
                                onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed.'),
                            }), children: [_jsx(Plus, { className: "mr-2 h-3.5 w-3.5" }), generate.isPending ? 'Generating…' : 'Generate invite code'] })] }) }), _jsxs("div", { className: "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4", children: [_jsx(KpiCard, { label: "Active links", value: links.isLoading ? '—' : allLinks.length, icon: _jsx(Users, { className: "h-4 w-4" }), hint: "Linked patients" }), _jsx(KpiCard, { accent: "gold", label: "Pending \u00B7 awaiting patient", value: codes.isLoading ? '—' : pending.length, icon: _jsx(Mail, { className: "h-4 w-4" }), 
                        // TODO(api): no avg-redemption metric yet.
                        hint: "Codes generated, not accepted" }), _jsx(KpiCard, { accent: "ok", label: "Redemption rate", value: codes.isLoading ? '—' : `${redemptionPct}%`, hint: `${acceptedCount} of ${allCodes.length || 0} accepted` }), _jsx(KpiCard, { accent: "urgent", label: "Disconnected \u00B7 30d", 
                        // TODO(api): no historical disconnection count; treating as 0 for now.
                        value: 0, icon: _jsx(XCircle, { className: "h-4 w-4" }), hint: "Most by patient request" })] }), _jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx(FilterPill, { active: tab === 'active', count: allLinks.length, onClick: () => setTab('active'), children: "Active connections" }), _jsx(FilterPill, { active: tab === 'pending', urgent: pending.length > 0 && tab !== 'pending', count: pending.length, onClick: () => setTab('pending'), children: "Pending invites" }), _jsx(FilterPill, { active: tab === 'history', count: history.length, onClick: () => setTab('history'), children: "History" })] }), tab === 'active' && (_jsx(ActiveConnections, { links: allLinks, loading: links.isLoading, onDisconnect: (l) => setDisconnectTarget(l) })), tab === 'pending' && (_jsx(PendingCodes, { codes: pending, loading: codes.isLoading, onInvite: (c) => setInviteFor(c), onGenerate: () => generate.mutate(undefined, {
                    onSuccess: (code) => toast.success(`Code ${code.code} generated.`),
                    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed.'),
                }), generating: generate.isPending })), tab === 'history' && _jsx(HistoryList, { codes: history, loading: codes.isLoading }), _jsx(EmailInviteDialog, { code: inviteFor, onClose: () => setInviteFor(null) }), _jsx(Dialog, { open: Boolean(disconnectTarget), onOpenChange: (v) => !v && setDisconnectTarget(null), children: _jsx(DisconnectContent, { target: disconnectTarget, onClose: () => setDisconnectTarget(null) }) })] }));
}
function ActiveConnections({ links, loading, onDisconnect, }) {
    const columns = [
        {
            key: 'patient',
            header: 'Patient',
            cell: (l) => (_jsxs("div", { className: "flex items-center gap-3", children: [_jsx(Avatar, { size: "sm", children: _jsx(AvatarFallback, { children: initials(l.first_name, l.last_name) }) }), _jsxs("div", { className: "font-serif text-base tracking-tightest", children: [l.first_name, " ", l.last_name] })] })),
        },
        {
            key: 'linked',
            header: 'Linked since',
            width: '180px',
            cell: (l) => (_jsxs("div", { className: "font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground", children: [_jsx("div", { className: "text-foreground", children: format(new Date(l.linked_at), 'd MMM yyyy') }), _jsxs("div", { children: [formatDistanceToNowStrict(new Date(l.linked_at)), " ago"] })] })),
        },
        {
            key: 'consent',
            header: 'Consent scope',
            width: '160px',
            // TODO(api): consent scope not exposed yet — treat as full clinical.
            cell: () => _jsx(Badge, { variant: "navy", children: "Full clinical" }),
        },
        {
            key: 'status',
            header: 'Status',
            width: '120px',
            cell: () => _jsx(Badge, { variant: "improving", children: "Active" }),
        },
        {
            key: 'actions',
            header: '',
            width: '120px',
            align: 'right',
            cell: (l) => (_jsxs(Button, { variant: "ghost", size: "sm", onClick: (e) => {
                    e.stopPropagation();
                    onDisconnect(l);
                }, children: [_jsx(Unlink, { className: "mr-1.5 h-3.5 w-3.5" }), "Disconnect"] })),
        },
    ];
    if (!loading && links.length === 0) {
        return (_jsx(EmptyState, { icon: _jsx(Users, { className: "h-6 w-6" }), title: "No linked patients yet.", description: "Generate an invite code and your patient will appear here when they accept." }));
    }
    return (_jsx(DataTable, { columns: columns, rows: links, rowKey: (l) => l.link_id, loading: loading }));
}
function PendingCodes({ codes, loading, onInvite, onGenerate, generating, }) {
    if (loading) {
        return (_jsx("div", { className: "grid gap-4 md:grid-cols-2 xl:grid-cols-3", children: Array.from({ length: 3 }).map((_, i) => (_jsx(Skeleton, { className: "h-56" }, i))) }));
    }
    if (codes.length === 0) {
        return (_jsx(EmptyState, { icon: _jsx(Link2, { className: "h-6 w-6" }), title: "No pending invites.", description: "Generate a 6-character code and share it with your patient \u2014 by email or in clinic.", action: _jsxs(Button, { onClick: onGenerate, disabled: generating, children: [_jsx(Plus, { className: "mr-2 h-4 w-4" }), generating ? 'Generating…' : 'Generate invite code'] }) }));
    }
    return (_jsx("div", { className: "grid gap-4 md:grid-cols-2 xl:grid-cols-3", children: codes.map((c) => (_jsx(CodeCard, { code: c, onInvite: () => onInvite(c) }, c.id))) }));
}
function CodeCard({ code, onInvite }) {
    const [copied, setCopied] = useState(false);
    const [showQr, setShowQr] = useState(false);
    const expires = new Date(code.expires_at);
    const expired = expires.getTime() < Date.now();
    async function onCopy() {
        await navigator.clipboard.writeText(code.code);
        setCopied(true);
        toast.success(`Code ${code.code} copied to clipboard.`);
        setTimeout(() => setCopied(false), 1500);
    }
    return (_jsxs("article", { className: "overflow-hidden rounded-sm border border-border/70 bg-card shadow-navy-xs", children: [_jsxs("div", { className: "bg-gradient-to-br from-navy-700 to-navy-900 p-6 text-background", children: [_jsxs("div", { className: "mb-4 font-mono text-[10px] uppercase tracking-[0.22em] text-gold-400/80", children: ["6-character code \u00B7 ", expired ? 'expired' : `expires in ${formatDistanceToNowStrict(expires)}`] }), _jsx("div", { className: "flex justify-center gap-1.5", children: code.code.split('').map((ch, i) => (_jsx("span", { className: "flex h-12 w-9 items-center justify-center rounded-sm border border-gold-400/40 bg-navy-600/30 font-mono text-2xl tracking-wider text-background", children: ch }, i))) }), _jsxs("div", { className: "mt-4 flex items-center justify-center gap-4 font-mono text-[10px] uppercase tracking-[0.18em] text-background/70", children: [_jsxs("span", { className: "inline-flex items-center gap-1.5", children: [_jsx(Clock, { className: "h-3 w-3" }), "Expires ", format(expires, 'd MMM')] }), _jsx("span", { children: "\u00B7" }), _jsx("span", { children: "Single-use" })] })] }), _jsxs("div", { className: "grid grid-cols-2 gap-2 border-b border-border/70 p-3", children: [_jsxs(Button, { variant: "outline", size: "sm", onClick: onCopy, children: [copied ? _jsx(Check, { className: "mr-1.5 h-3.5 w-3.5" }) : _jsx(Copy, { className: "mr-1.5 h-3.5 w-3.5" }), copied ? 'Copied' : 'Copy code'] }), _jsxs(Button, { variant: "outline", size: "sm", onClick: () => setShowQr((v) => !v), children: [_jsx(QrCode, { className: "mr-1.5 h-3.5 w-3.5" }), showQr ? 'Hide QR' : 'Show QR'] })] }), showQr && (_jsx("div", { className: "border-b border-border/70 bg-secondary/30 p-4", children: _jsx("img", { src: `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(code.code)}`, alt: `QR for ${code.code}`, className: "mx-auto h-40 w-40" }) })), _jsx("div", { className: "p-3", children: _jsxs(Button, { variant: "default", size: "sm", className: "w-full", onClick: onInvite, children: [_jsx(Mail, { className: "mr-1.5 h-3.5 w-3.5" }), "Or email it directly"] }) })] }));
}
function HistoryList({ codes, loading }) {
    if (loading)
        return _jsx(Skeleton, { className: "h-32" });
    if (codes.length === 0) {
        return (_jsx(EmptyState, { title: "No history yet.", description: "Codes that have been accepted, expired, or revoked will appear here." }));
    }
    return (_jsx("div", { className: "overflow-hidden rounded-sm border border-border/70 bg-card", children: codes.map((c, i) => (_jsxs("div", { className: cn('grid grid-cols-[auto_1fr_auto_auto] items-center gap-4 px-5 py-3', i > 0 && 'border-t border-border/40'), children: [_jsx("span", { className: "font-mono text-base tracking-[0.2em] text-foreground", children: c.code }), _jsx(Badge, { variant: c.status === 'accepted'
                        ? 'improving'
                        : c.status === 'expired'
                            ? 'inactive'
                            : c.status === 'revoked'
                                ? 'urgent'
                                : 'fyi', children: c.status }), _jsxs("span", { className: "font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground", children: ["Issued ", format(new Date(c.created_at), 'd MMM yyyy')] }), _jsxs("span", { className: "font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground", children: ["Expires ", format(new Date(c.expires_at), 'd MMM yyyy')] })] }, c.id))) }));
}
function EmailInviteDialog({ code, onClose }) {
    const invite = useEmailInvite();
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [sent, setSent] = useState(false);
    async function onSend(e) {
        e.preventDefault();
        if (!code)
            return;
        try {
            await invite.mutateAsync({ code: code.code, patient_email: email, patient_name: name });
            toast.success(`Invitation sent to ${email}.`);
            setSent(true);
            setTimeout(() => {
                setSent(false);
                setEmail('');
                setName('');
                onClose();
            }, 1200);
        }
        catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to send.');
        }
    }
    return (_jsx(Dialog, { open: Boolean(code), onOpenChange: (v) => {
            if (!v) {
                setEmail('');
                setName('');
                setSent(false);
                onClose();
            }
        }, children: _jsxs(DialogContent, { className: "max-w-md", children: [_jsxs(DialogHeader, { children: [_jsxs("div", { className: "font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground", children: ["Send invitation \u00B7 ", code?.code] }), _jsxs(DialogTitle, { children: ["Invite by ", _jsx("em", { className: "not-italic text-gold-700", children: "email." })] }), _jsx(DialogDescription, { children: "We'll deliver the code, a short explainer, and a download link." })] }), _jsxs("form", { onSubmit: onSend, className: "space-y-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "patient_email", className: "font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground", children: "Patient email" }), _jsx(Input, { id: "patient_email", type: "email", required: true, value: email, onChange: (e) => setEmail(e.target.value), placeholder: "patient@example.com" })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "patient_name", className: "font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground", children: "Name \u00B7 optional" }), _jsx(Input, { id: "patient_name", value: name, onChange: (e) => setName(e.target.value), placeholder: "Jane Doe" })] }), invite.isError && (_jsx("p", { className: "text-sm text-destructive", children: invite.error instanceof Error ? invite.error.message : 'Failed to send.' })), _jsxs(DialogFooter, { children: [_jsx(Button, { type: "button", variant: "outline", onClick: onClose, children: "Cancel" }), _jsx(Button, { type: "submit", disabled: invite.isPending || sent, children: sent ? (_jsxs(_Fragment, { children: [_jsx(Check, { className: "mr-1.5 h-4 w-4" }), "Sent"] })) : invite.isPending ? ('Sending…') : (_jsxs(_Fragment, { children: [_jsx(Mail, { className: "mr-1.5 h-4 w-4" }), "Send invitation"] })) })] })] })] }) }));
}
function DisconnectContent({ target, onClose, }) {
    const disconnect = useDisconnectLink();
    if (!target)
        return null;
    return (_jsxs(DialogContent, { className: "max-w-md", children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: "Disconnect this patient?" }), _jsxs(DialogDescription, { children: [_jsxs("strong", { className: "font-serif text-foreground", children: [target.first_name, " ", target.last_name] }), ' ', "will be unlinked from your practice. Their clinical history remains intact; you simply lose access."] })] }), _jsxs(DialogFooter, { children: [_jsx(Button, { variant: "outline", onClick: onClose, children: "Cancel" }), _jsx(Button, { variant: "destructive", disabled: disconnect.isPending, onClick: async () => {
                            try {
                                await disconnect.mutateAsync(target.link_id);
                                toast.success(`Disconnected ${target.first_name} ${target.last_name}.`);
                                onClose();
                            }
                            catch (err) {
                                toast.error(err instanceof Error ? err.message : 'Failed to disconnect.');
                            }
                        }, children: disconnect.isPending ? 'Disconnecting…' : 'Disconnect' })] })] }));
}
