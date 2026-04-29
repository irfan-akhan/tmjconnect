import { useMemo, useState } from 'react';
import { format, formatDistanceToNowStrict } from 'date-fns';
import { toast } from 'sonner';
import {
  Check,
  Clock,
  Copy,
  Link2,
  Mail,
  Plus,
  QrCode,
  Unlink,
  Users,
  XCircle,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Avatar, AvatarFallback, initials } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, type DataColumn } from '@/components/ui/data-table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { FilterPill } from '@/components/ui/filter-pill';
import { Input } from '@/components/ui/input';
import { KpiCard } from '@/components/ui/kpi-card';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  useDisconnectLink,
  useEmailInvite,
  useGenerateCode,
  useLinkingCodes,
  useLinkingMetrics,
  useLinks,
  type LinkingCode,
  type PatientLink,
} from '@/features/linking/queries';

type Tab = 'active' | 'pending' | 'history';

export function LinkingPage() {
  const codes = useLinkingCodes();
  const links = useLinks();
  const metrics = useLinkingMetrics();
  const generate = useGenerateCode();

  const [tab, setTab] = useState<Tab>('active');
  const [inviteFor, setInviteFor] = useState<LinkingCode | null>(null);
  const [disconnectTarget, setDisconnectTarget] = useState<PatientLink | null>(null);

  const allCodes = codes.data ?? [];
  const pending = useMemo(() => allCodes.filter((c) => c.status === 'pending'), [allCodes]);
  const history = useMemo(() => allCodes.filter((c) => c.status !== 'pending'), [allCodes]);
  const allLinks = links.data ?? [];

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <PageHeader
        eyebrow="Manage · Invite & link"
        title="Invite & link patients."
        description={
          <>
            Securely connect new patients or manage existing connections ·{' '}
            <span className="text-foreground">{allLinks.length} active</span>
          </>
        }
        actions={
          <>
            <Button variant="outline" size="sm" disabled={pending.length === 0} onClick={() => setInviteFor(pending[0] ?? null)}>
              <Mail className="mr-2 h-3.5 w-3.5" />
              Email invite
            </Button>
            <Button
              size="sm"
              disabled={generate.isPending}
              onClick={() =>
                generate.mutate(undefined, {
                  onSuccess: (code) => toast.success(`Invite code ${code.code} generated.`),
                  onError: (err) =>
                    toast.error(err instanceof Error ? err.message : 'Failed.'),
                })
              }
            >
              <Plus className="mr-2 h-3.5 w-3.5" />
              {generate.isPending ? 'Generating…' : 'Generate invite code'}
            </Button>
          </>
        }
      />

      {/* KPI strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        <KpiCard
          label="Active links"
          value={metrics.isLoading ? '—' : metrics.data?.active_count ?? allLinks.length}
          icon={<Users className="h-4 w-4" />}
          hint="Linked patients"
        />
        <KpiCard
          accent="gold"
          label="Pending · awaiting patient"
          value={metrics.isLoading ? '—' : metrics.data?.pending_count ?? pending.length}
          icon={<Mail className="h-4 w-4" />}
          hint={
            metrics.data?.avg_redemption_hours == null
              ? 'Codes issued, not yet accepted'
              : `Avg redemption · ${metrics.data.avg_redemption_hours.toFixed(1)}h`
          }
        />
        <KpiCard
          accent="ok"
          label="Redemption rate"
          value={metrics.isLoading ? '—' : `${metrics.data?.redemption_pct ?? 0}%`}
          hint={`${metrics.data?.accepted_count ?? 0} of ${metrics.data?.total_codes ?? 0} accepted`}
        />
        <KpiCard
          accent="urgent"
          label="Disconnected · 30d"
          value={metrics.isLoading ? '—' : metrics.data?.disconnected_30d ?? 0}
          icon={<XCircle className="h-4 w-4" />}
          hint="Active links severed"
        />
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        <FilterPill active={tab === 'active'} count={allLinks.length} onClick={() => setTab('active')}>
          Active connections
        </FilterPill>
        <FilterPill
          active={tab === 'pending'}
          urgent={pending.length > 0 && tab !== 'pending'}
          count={pending.length}
          onClick={() => setTab('pending')}
        >
          Pending invites
        </FilterPill>
        <FilterPill active={tab === 'history'} count={history.length} onClick={() => setTab('history')}>
          History
        </FilterPill>
      </div>

      {tab === 'active' && (
        <ActiveConnections
          links={allLinks}
          loading={links.isLoading}
          onDisconnect={(l) => setDisconnectTarget(l)}
        />
      )}

      {tab === 'pending' && (
        <PendingCodes
          codes={pending}
          loading={codes.isLoading}
          onInvite={(c) => setInviteFor(c)}
          onGenerate={() =>
            generate.mutate(undefined, {
              onSuccess: (code) => toast.success(`Code ${code.code} generated.`),
              onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed.'),
            })
          }
          generating={generate.isPending}
        />
      )}

      {tab === 'history' && <HistoryList codes={history} loading={codes.isLoading} />}

      <EmailInviteDialog code={inviteFor} onClose={() => setInviteFor(null)} />
      <Dialog open={Boolean(disconnectTarget)} onOpenChange={(v) => !v && setDisconnectTarget(null)}>
        <DisconnectContent target={disconnectTarget} onClose={() => setDisconnectTarget(null)} />
      </Dialog>
    </div>
  );
}

function ActiveConnections({
  links,
  loading,
  onDisconnect,
}: {
  links: PatientLink[];
  loading: boolean;
  onDisconnect: (l: PatientLink) => void;
}) {
  const columns: DataColumn<PatientLink>[] = [
    {
      key: 'patient',
      header: 'Patient',
      cell: (l) => (
        <div className="flex items-center gap-3">
          <Avatar size="sm">
            <AvatarFallback>{initials(l.first_name, l.last_name)}</AvatarFallback>
          </Avatar>
          <div className="font-serif text-base tracking-tightest">
            {l.first_name} {l.last_name}
          </div>
        </div>
      ),
    },
    {
      key: 'linked',
      header: 'Linked since',
      width: '180px',
      cell: (l) => (
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          <div className="text-foreground">
            {format(new Date(l.linked_at), 'd MMM yyyy')}
          </div>
          <div>{formatDistanceToNowStrict(new Date(l.linked_at))} ago</div>
        </div>
      ),
    },
    {
      key: 'consent',
      header: 'Consent scope',
      width: '160px',
      cell: (l) => (
        <Badge variant="navy">
          {l.consent_scope === 'full_clinical'
            ? 'Full clinical'
            : l.consent_scope.replace(/_/g, ' ')}
        </Badge>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: '120px',
      cell: () => <Badge variant="improving">Active</Badge>,
    },
    {
      key: 'actions',
      header: '',
      width: '120px',
      align: 'right',
      cell: (l) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onDisconnect(l);
          }}
        >
          <Unlink className="mr-1.5 h-3.5 w-3.5" />
          Disconnect
        </Button>
      ),
    },
  ];

  if (!loading && links.length === 0) {
    return (
      <EmptyState
        icon={<Users className="h-6 w-6" />}
        title="No linked patients yet."
        description="Generate an invite code and your patient will appear here when they accept."
      />
    );
  }

  return (
    <DataTable
      columns={columns}
      rows={links}
      rowKey={(l) => l.link_id}
      loading={loading}
    />
  );
}

function PendingCodes({
  codes,
  loading,
  onInvite,
  onGenerate,
  generating,
}: {
  codes: LinkingCode[];
  loading: boolean;
  onInvite: (c: LinkingCode) => void;
  onGenerate: () => void;
  generating: boolean;
}) {
  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-56" />
        ))}
      </div>
    );
  }
  if (codes.length === 0) {
    return (
      <EmptyState
        icon={<Link2 className="h-6 w-6" />}
        title="No pending invites."
        description="Generate a 6-character code and share it with your patient — by email or in clinic."
        action={
          <Button onClick={onGenerate} disabled={generating}>
            <Plus className="mr-2 h-4 w-4" />
            {generating ? 'Generating…' : 'Generate invite code'}
          </Button>
        }
      />
    );
  }
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {codes.map((c) => (
        <CodeCard key={c.id} code={c} onInvite={() => onInvite(c)} />
      ))}
    </div>
  );
}

function CodeCard({ code, onInvite }: { code: LinkingCode; onInvite: () => void }) {
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

  return (
    <article className="overflow-hidden rounded-sm border border-border/70 bg-card shadow-navy-xs">
      {/* Code display block — navy gradient with gold borders */}
      <div className="bg-gradient-to-br from-navy-700 to-navy-900 p-6 text-background">
        <div className="mb-4 font-mono text-[10px] uppercase tracking-[0.22em] text-gold-300">
          6-character code · {expired ? 'expired' : `expires in ${formatDistanceToNowStrict(expires)}`}
        </div>
        <div className="flex justify-center gap-1.5">
          {code.code.split('').map((ch, i) => (
            <span
              key={i}
              className="flex h-12 w-9 items-center justify-center rounded-sm border border-gold-400/40 bg-navy-600/30 font-mono text-2xl tracking-wider text-background"
            >
              {ch}
            </span>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-center gap-4 font-mono text-[10px] uppercase tracking-[0.18em] text-background">
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-3 w-3" />
            Expires {format(expires, 'd MMM')}
          </span>
          <span>·</span>
          <span>Single-use</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 border-b border-border/70 p-3">
        <Button variant="outline" size="sm" onClick={onCopy}>
          {copied ? <Check className="mr-1.5 h-3.5 w-3.5" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}
          {copied ? 'Copied' : 'Copy code'}
        </Button>
        <Button variant="outline" size="sm" onClick={() => setShowQr((v) => !v)}>
          <QrCode className="mr-1.5 h-3.5 w-3.5" />
          {showQr ? 'Hide QR' : 'Show QR'}
        </Button>
      </div>

      {showQr && (
        <div className="border-b border-border/70 bg-secondary/30 p-4">
          {/* Local QR generation: no PHI (just the 6-char code) leaves the browser. */}
          <QRCodeSVG
            value={code.code}
            size={160}
            bgColor="transparent"
            fgColor="currentColor"
            level="M"
            className="mx-auto text-foreground"
          />
        </div>
      )}

      <div className="p-3">
        <Button variant="default" size="sm" className="w-full" onClick={onInvite}>
          <Mail className="mr-1.5 h-3.5 w-3.5" />
          Or email it directly
        </Button>
      </div>
    </article>
  );
}

function HistoryList({ codes, loading }: { codes: LinkingCode[]; loading: boolean }) {
  if (loading) return <Skeleton className="h-32" />;
  if (codes.length === 0) {
    return (
      <EmptyState
        title="No history yet."
        description="Codes that have been accepted, expired, or revoked will appear here."
      />
    );
  }
  return (
    <div className="overflow-hidden rounded-sm border border-border/70 bg-card">
      {codes.map((c, i) => (
        <div
          key={c.id}
          className={cn(
            'grid grid-cols-[auto_1fr_auto_auto] items-center gap-4 px-5 py-3',
            i > 0 && 'border-t border-border/40',
          )}
        >
          <span className="font-mono text-base tracking-[0.2em] text-foreground">{c.code}</span>
          <Badge
            variant={
              c.status === 'accepted'
                ? 'improving'
                : c.status === 'expired'
                  ? 'inactive'
                  : c.status === 'revoked'
                    ? 'urgent'
                    : 'fyi'
            }
          >
            {c.status}
          </Badge>
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Issued {format(new Date(c.created_at), 'd MMM yyyy')}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Expires {format(new Date(c.expires_at), 'd MMM yyyy')}
          </span>
        </div>
      ))}
    </div>
  );
}

function EmailInviteDialog({ code, onClose }: { code: LinkingCode | null; onClose: () => void }) {
  const invite = useEmailInvite();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [sent, setSent] = useState(false);

  async function onSend(e: React.FormEvent) {
    e.preventDefault();
    if (!code) return;
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
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send.');
    }
  }

  return (
    <Dialog
      open={Boolean(code)}
      onOpenChange={(v) => {
        if (!v) {
          setEmail('');
          setName('');
          setSent(false);
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Send invitation · {code?.code}
          </div>
          <DialogTitle>
            Invite by <em className="not-italic text-gold-700">email.</em>
          </DialogTitle>
          <DialogDescription>
            We'll deliver the code, a short explainer, and a download link.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSend} className="space-y-4">
          <div className="space-y-2">
            <Label
              htmlFor="patient_email"
              className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground"
            >
              Patient email
            </Label>
            <Input
              id="patient_email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="patient@example.com"
            />
          </div>
          <div className="space-y-2">
            <Label
              htmlFor="patient_name"
              className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground"
            >
              Name · optional
            </Label>
            <Input
              id="patient_name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Doe"
            />
          </div>

          {invite.isError && (
            <p className="text-sm text-destructive">
              {invite.error instanceof Error ? invite.error.message : 'Failed to send.'}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={invite.isPending || sent}>
              {sent ? (
                <>
                  <Check className="mr-1.5 h-4 w-4" />
                  Sent
                </>
              ) : invite.isPending ? (
                'Sending…'
              ) : (
                <>
                  <Mail className="mr-1.5 h-4 w-4" />
                  Send invitation
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DisconnectContent({
  target,
  onClose,
}: {
  target: PatientLink | null;
  onClose: () => void;
}) {
  const disconnect = useDisconnectLink();
  if (!target) return null;
  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>Disconnect this patient?</DialogTitle>
        <DialogDescription>
          <strong className="font-serif text-foreground">
            {target.first_name} {target.last_name}
          </strong>{' '}
          will be unlinked from your practice. Their clinical history remains intact; you simply lose access.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="destructive"
          disabled={disconnect.isPending}
          onClick={async () => {
            try {
              await disconnect.mutateAsync(target.link_id);
              toast.success(`Disconnected ${target.first_name} ${target.last_name}.`);
              onClose();
            } catch (err) {
              toast.error(err instanceof Error ? err.message : 'Failed to disconnect.');
            }
          }}
        >
          {disconnect.isPending ? 'Disconnecting…' : 'Disconnect'}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
