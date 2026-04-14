import { useState } from 'react';
import { format, formatDistanceToNowStrict } from 'date-fns';
import { toast } from 'sonner';
import {
  Check,
  Copy,
  Link2,
  Mail,
  Plus,
  Unlink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
  useDisconnectLink,
  useEmailInvite,
  useGenerateCode,
  useLinkingCodes,
  useLinks,
  type LinkingCode,
  type LinkingCodeStatus,
  type PatientLink,
} from '@/features/linking/queries';

function statusTone(s: LinkingCodeStatus) {
  if (s === 'pending') return 'text-accent border-accent/30 bg-accent/5';
  if (s === 'accepted') return 'text-foreground border-border bg-secondary';
  if (s === 'expired') return 'text-muted-foreground border-border bg-background';
  return 'text-destructive border-destructive/30 bg-destructive/5';
}

export function LinkingPage() {
  const codes = useLinkingCodes();
  const links = useLinks();
  const generate = useGenerateCode();

  const [inviteFor, setInviteFor] = useState<LinkingCode | null>(null);
  const [disconnectTarget, setDisconnectTarget] = useState<PatientLink | null>(null);

  const pending = (codes.data ?? []).filter((c) => c.status === 'pending');
  const history = (codes.data ?? []).filter((c) => c.status !== 'pending');

  return (
    <div className="mx-auto max-w-6xl space-y-12">
      <header className="flex items-end justify-between gap-8 border-b border-border/70 pb-8">
        <div>
          <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            Folio № 05 — Linking
          </div>
          <h1 className="font-serif text-5xl tracking-tightest">
            Invite patients into <em className="text-accent">your practice.</em>
          </h1>
          <p className="mt-3 max-w-xl text-sm text-muted-foreground">
            Generate a six-character code. Share it with your patient — by email
            or in person — and they'll appear in your patient list the moment
            they accept.
          </p>
        </div>
        <Button
          onClick={() =>
            generate.mutate(undefined, {
              onSuccess: (code) => toast.success(`Linking code ${code.code} generated.`),
              onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed.'),
            })
          }
          disabled={generate.isPending}
        >
          <Plus className="h-4 w-4" />
          {generate.isPending ? 'Generating…' : 'New linking code'}
        </Button>
      </header>

      {/* Pending codes — the hero */}
      <section className="space-y-4">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          Awaiting acceptance
          <span className="ml-3 text-muted-foreground/60">
            {pending.length.toString().padStart(2, '0')}
          </span>
        </h2>

        {codes.isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-56 animate-pulse rounded-sm bg-secondary" />
            ))}
          </div>
        ) : pending.length === 0 ? (
          <div className="rounded-sm border border-dashed border-border bg-card/60 p-12 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-sm bg-secondary">
              <Link2 className="h-5 w-5 stroke-[1.5]" />
            </div>
            <h3 className="font-serif text-2xl tracking-tightest">No pending invites.</h3>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
              Generate a code to invite your next patient.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {pending.map((c) => (
              <CodeCard key={c.id} code={c} onInvite={() => setInviteFor(c)} />
            ))}
          </div>
        )}
      </section>

      {/* Active patient links */}
      <section className="space-y-4">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          Active links
          <span className="ml-3 text-muted-foreground/60">
            {(links.data?.length ?? 0).toString().padStart(2, '0')}
          </span>
        </h2>

        {links.isLoading ? (
          <div className="h-32 animate-pulse rounded-sm bg-secondary" />
        ) : !links.data || links.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active links yet.</p>
        ) : (
          <div className="overflow-hidden rounded-sm border border-border/70">
            {links.data.map((l) => (
              <div
                key={l.link_id}
                className="grid grid-cols-[1fr_auto_auto] items-center gap-4 border-t border-border/70 bg-card px-5 py-4 first:border-t-0"
              >
                <div>
                  <div className="font-serif text-lg tracking-tightest">
                    {l.first_name} {l.last_name}
                  </div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                    Linked {format(new Date(l.linked_at), 'd MMM yyyy')}
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setDisconnectTarget(l)}>
                  <Unlink className="h-4 w-4" />
                  Disconnect
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* History */}
      {history.length > 0 && (
        <section className="space-y-4">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            History
            <span className="ml-3 text-muted-foreground/60">
              {history.length.toString().padStart(2, '0')}
            </span>
          </h2>
          <div className="overflow-hidden rounded-sm border border-border/70">
            {history.map((c) => (
              <div
                key={c.id}
                className="grid grid-cols-[auto_1fr_auto] items-center gap-4 border-t border-border/70 bg-card px-5 py-3 first:border-t-0"
              >
                <span className="font-mono text-sm tracking-[0.2em] text-muted-foreground">
                  {c.code}
                </span>
                <span className={cn(
                  'inline-flex w-fit items-center rounded-sm border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em]',
                  statusTone(c.status),
                )}>
                  {c.status}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                  {format(new Date(c.created_at), 'd MMM yyyy')}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <EmailInviteDialog code={inviteFor} onClose={() => setInviteFor(null)} />

      <Dialog open={Boolean(disconnectTarget)} onOpenChange={(v) => !v && setDisconnectTarget(null)}>
        <DisconnectContent target={disconnectTarget} onClose={() => setDisconnectTarget(null)} />
      </Dialog>
    </div>
  );
}

function CodeCard({ code, onInvite }: { code: LinkingCode; onInvite: () => void }) {
  const [copied, setCopied] = useState(false);
  const expires = new Date(code.expires_at);
  const expired = expires.getTime() < Date.now();

  async function onCopy() {
    await navigator.clipboard.writeText(code.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <article className="flex flex-col rounded-sm border border-border/70 bg-card p-6">
      <div className="mb-4 flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
        <span>Code</span>
        <span>
          {expired
            ? 'Expired'
            : `Expires in ${formatDistanceToNowStrict(expires)}`}
        </span>
      </div>

      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="font-mono text-4xl tracking-[0.35em] text-foreground">
          {code.code}
        </div>
        <Button variant="ghost" size="icon" onClick={onCopy} aria-label="Copy code">
          {copied ? <Check className="h-4 w-4 text-accent" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>

      <div className="mt-auto flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onInvite}>
          <Mail className="h-4 w-4" />
          Send by email
        </Button>
      </div>
    </article>
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
          <DialogTitle>Invite by <em className="text-accent">email.</em></DialogTitle>
          <DialogDescription>
            We'll deliver the code, a short explainer, and a download link.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSend} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="patient_email" className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
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
            <Label htmlFor="patient_name" className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
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
                  <Check className="h-4 w-4" />
                  Sent
                </>
              ) : invite.isPending ? (
                'Sending…'
              ) : (
                <>
                  <Mail className="h-4 w-4" />
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

function DisconnectContent({ target, onClose }: { target: PatientLink | null; onClose: () => void }) {
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
