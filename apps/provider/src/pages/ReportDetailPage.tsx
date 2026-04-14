import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { format, formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { AlertTriangle, ArrowLeft, Check, Flag, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  useFlagReport,
  useMarkReviewed,
  useReport,
  useRespondToReport,
  type Report,
  type ReportResponse,
} from '@/features/reports/queries';

function urgencyTone(u: Report['urgency']) {
  if (u === 'urgent') return 'text-destructive border-destructive/30 bg-destructive/5';
  if (u === 'concerning') return 'text-accent border-accent/30 bg-accent/5';
  return 'text-muted-foreground border-border bg-background';
}

export function ReportDetailPage() {
  const { reportId = '' } = useParams();
  const q = useReport(reportId);

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <Link
        to="/reports"
        className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to inbox
      </Link>

      {q.isLoading ? (
        <div className="h-64 animate-pulse rounded-sm bg-secondary" />
      ) : q.isError ? (
        <p className="text-sm text-destructive">
          {q.error instanceof Error ? q.error.message : 'Failed to load report.'}
        </p>
      ) : q.data ? (
        <ReportView
          reportId={reportId}
          report={q.data.report}
          responses={q.data.responses}
        />
      ) : null}
    </div>
  );
}

function ReportView({
  reportId,
  report,
  responses,
}: {
  reportId: string;
  report: Report;
  responses: ReportResponse[];
}) {
  const flag = useFlagReport(reportId);
  const review = useMarkReviewed(reportId);
  const respond = useRespondToReport(reportId);

  const [message, setMessage] = useState('');
  const [internalNotes, setInternalNotes] = useState('');

  async function onSend(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    try {
      await respond.mutateAsync({
        message: message.trim(),
        internal_notes: internalNotes.trim() || undefined,
      });
      toast.success('Response sent to patient.');
      setMessage('');
      setInternalNotes('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send.');
    }
  }

  const period =
    report.period_start && report.period_end
      ? `${format(new Date(report.period_start), 'd MMM')} – ${format(new Date(report.period_end), 'd MMM yyyy')}`
      : null;

  return (
    <>
      <header className="border-b border-border/70 pb-8">
        <div className="mb-3 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
          <span>Folio № 04 — Report</span>
          <span>·</span>
          <span
            className={cn(
              'inline-flex h-5 items-center rounded-sm border px-2 tracking-[0.18em]',
              urgencyTone(report.urgency),
            )}
          >
            {report.urgency === 'urgent' && <AlertTriangle className="mr-1 h-3 w-3" />}
            {report.urgency}
          </span>
          {report.flagged && (
            <span className="inline-flex items-center gap-1 text-accent">
              <Flag className="h-3 w-3 fill-current" />
              Flagged
            </span>
          )}
        </div>

        <div className="flex items-end justify-between gap-8">
          <div>
            <h1 className="font-serif text-4xl tracking-tightest">
              Filed <em className="text-accent">{formatDistanceToNow(new Date(report.submitted_at), { addSuffix: true })}</em>
            </h1>
            <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              <div>
                <dt className="inline text-muted-foreground/60">Submitted · </dt>
                <dd className="inline text-foreground normal-case">
                  {format(new Date(report.submitted_at), 'd MMM yyyy · HH:mm')}
                </dd>
              </div>
              {period && (
                <div>
                  <dt className="inline text-muted-foreground/60">Period · </dt>
                  <dd className="inline text-foreground normal-case">{period}</dd>
                </div>
              )}
              {report.pain_level != null && (
                <div>
                  <dt className="inline text-muted-foreground/60">Pain · </dt>
                  <dd className="inline text-foreground">{report.pain_level}/10</dd>
                </div>
              )}
              <div>
                <dt className="inline text-muted-foreground/60">Status · </dt>
                <dd className="inline text-foreground normal-case">{report.status}</dd>
              </div>
            </dl>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() =>
                flag.mutate(undefined, {
                  onSuccess: (res) => toast.success(res?.data?.flagged ? 'Report flagged.' : 'Flag removed.'),
                  onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to toggle flag.'),
                })
              }
              disabled={flag.isPending}
            >
              <Flag className={cn('h-4 w-4', report.flagged && 'fill-accent stroke-accent')} />
              {report.flagged ? 'Unflag' : 'Flag'}
            </Button>
            {report.status !== 'reviewed' && report.status !== 'responded' && (
              <Button
                variant="outline"
                onClick={() =>
                  review.mutate(undefined, {
                    onSuccess: () => toast.success('Marked reviewed.'),
                    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed.'),
                  })
                }
                disabled={review.isPending}
              >
                <Check className="h-4 w-4" />
                Mark reviewed
              </Button>
            )}
          </div>
        </div>
      </header>

      <section className="grid gap-8 lg:grid-cols-[2fr_1fr]">
        {/* Description */}
        <article className="space-y-6">
          <div>
            <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Description
            </div>
            <p className="whitespace-pre-wrap font-serif text-lg leading-[1.65] tracking-tight">
              {report.description}
            </p>
          </div>

          {report.patient_notes && (
            <div className="rounded-sm border-l-2 border-accent bg-accent/5 p-4">
              <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                Patient notes
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{report.patient_notes}</p>
            </div>
          )}

          {report.photo_url && (
            <div>
              <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                Attached photo
              </div>
              <img
                src={report.photo_url}
                alt="Report attachment"
                className="rounded-sm border border-border/70"
              />
            </div>
          )}
        </article>

        {/* Summary stats */}
        <aside>
          {Object.keys(report.summary_data ?? {}).length > 0 && (
            <div className="rounded-sm border border-border/70 bg-card p-6">
              <div className="mb-4 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                Snapshot
              </div>
              <dl className="space-y-3 font-mono text-[11px]">
                {Object.entries(report.summary_data as Record<string, unknown>).map(([k, v]) => (
                  <div key={k} className="flex items-baseline justify-between gap-3 border-b border-border/70 pb-2 last:border-0">
                    <dt className="uppercase tracking-[0.18em] text-muted-foreground">
                      {k.replace(/_/g, ' ')}
                    </dt>
                    <dd className="text-right font-serif text-base tracking-tightest text-foreground">
                      {String(v ?? '—')}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </aside>
      </section>

      {/* Thread */}
      <section className="space-y-4">
        <h2 className="font-serif text-2xl tracking-tightest">
          Conversation
          <span className="ml-3 font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">
            {responses.length.toString().padStart(2, '0')} response{responses.length === 1 ? '' : 's'}
          </span>
        </h2>

        {responses.length === 0 ? (
          <p className="rounded-sm border border-dashed border-border bg-card/60 p-8 text-center text-sm text-muted-foreground">
            No response yet. Your reply will be delivered to the patient.
          </p>
        ) : (
          <ol className="space-y-3">
            {responses.map((r) => (
              <ResponseItem key={r.id} r={r} />
            ))}
          </ol>
        )}
      </section>

      {/* Respond form */}
      <form onSubmit={onSend} className="space-y-4 rounded-sm border border-border/70 bg-card p-6">
        <div>
          <label className="mb-2 block font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Reply to patient
          </label>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Write a clear, calm response…"
            rows={5}
            required
          />
        </div>
        <div>
          <label className="mb-2 block font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Internal notes · private
          </label>
          <Textarea
            value={internalNotes}
            onChange={(e) => setInternalNotes(e.target.value)}
            placeholder="Private clinical notes, not shown to the patient…"
            rows={3}
            className="border-accent/30 bg-accent/5"
          />
        </div>

        {respond.isError && (
          <p className="text-sm text-destructive">
            {respond.error instanceof Error ? respond.error.message : 'Failed to send.'}
          </p>
        )}

        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            {message.length}/5000
          </span>
          <Button type="submit" disabled={respond.isPending || !message.trim()}>
            <Send className="h-4 w-4" />
            {respond.isPending ? 'Sending…' : 'Send response'}
          </Button>
        </div>
      </form>
    </>
  );
}

function ResponseItem({ r }: { r: ReportResponse }) {
  return (
    <li className="rounded-sm border border-border/70 bg-card p-5">
      <div className="mb-3 flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
        <span>You responded</span>
        <span>{format(new Date(r.responded_at), 'd MMM yyyy · HH:mm')}</span>
      </div>
      <p className="whitespace-pre-wrap text-sm leading-relaxed">{r.message}</p>
      {r.internal_notes && (
        <div className="mt-4 rounded-sm border-l-2 border-accent bg-accent/5 p-3">
          <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Internal notes · private
          </div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{r.internal_notes}</p>
        </div>
      )}
    </li>
  );
}
