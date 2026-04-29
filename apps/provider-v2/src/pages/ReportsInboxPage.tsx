import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { format, formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import {
  ArrowRight,
  CalendarPlus,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Filter,
  Flag,
  Inbox,
  Mail,
  TriangleAlert,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage, initials } from '@/components/ui/avatar';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/ui/page-header';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Sparkline } from '@/components/ui/sparkline';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  useFlagReport,
  useInbox,
  useMarkAllInboxViewed,
  useMarkReviewed,
  useReport,
  useRespondToReport,
  type InboxFilters,
  type InboxRow,
  type ReportResponse,
  type ReportStatus,
  type ReportUrgency,
} from '@/features/reports/queries';
import {
  useLastClinicVisit,
  usePatientAnalytics,
  useRecordClinicVisit,
} from '@/features/patients/detail-queries';

const PAGE_SIZE = 25;

type Bucket = 'all' | 'urgent' | 'awaiting' | 'responded' | 'flagged';
type Sort = 'urgency' | 'recent';

const SORT_OPTIONS: Array<{ value: Sort; label: string }> = [
  { value: 'urgency', label: 'Urgency (high to low)' },
  { value: 'recent', label: 'Most recent' },
];

function statusBadgeVariant(s: ReportStatus): BadgeProps['variant'] {
  if (s === 'submitted') return 'unanswered';
  if (s === 'viewed') return 'new';
  if (s === 'responded') return 'responded';
  return 'fyi';
}

function statusLabel(s: ReportStatus) {
  return ({
    submitted: 'Unanswered',
    viewed: 'Opened',
    reviewed: 'Reviewed',
    responded: 'Responded',
  } satisfies Record<ReportStatus, string>)[s];
}

function urgencyLeft(u: ReportUrgency) {
  if (u === 'urgent') return 'border-l-err';
  if (u === 'concerning') return 'border-l-warn';
  return 'border-l-ok';
}

function urgencyBadgeVariant(u: ReportUrgency): BadgeProps['variant'] {
  if (u === 'urgent') return 'urgent';
  if (u === 'concerning') return 'moderate';
  return 'improving';
}

function painTone(value: number | null) {
  if (value == null) return 'text-muted-foreground';
  if (value >= 7) return 'text-err-dark';
  if (value >= 4) return 'text-warn-dark';
  return 'text-ok-dark';
}

type ServerFilters = Pick<InboxFilters, 'patient_id' | 'from' | 'to' | 'urgency' | 'status'>;

export function ReportsInboxPage() {
  const navigate = useNavigate();
  const { reportId: paramId } = useParams();
  const [bucket, setBucket] = useState<Bucket>('all');
  const [sort, setSort] = useState<Sort>('urgency');
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [serverFilters, setServerFilters] = useState<ServerFilters>({});
  const markAll = useMarkAllInboxViewed();

  const inbox = useInbox({ page, limit: PAGE_SIZE, ...serverFilters });
  const allRows: InboxRow[] = inbox.data?.data ?? [];
  const total = inbox.data?.meta?.total ?? 0;
  const totalPages = inbox.data?.meta?.totalPages ?? 1;

  const counts = useMemo(
    () => ({
      all: allRows.length,
      urgent: allRows.filter((r) => r.urgency === 'urgent').length,
      awaiting: allRows.filter((r) => r.status === 'submitted' || r.status === 'viewed').length,
      responded: allRows.filter((r) => r.status === 'responded').length,
      flagged: allRows.filter((r) => r.flagged).length,
    }),
    [allRows],
  );

  const filteredRows = useMemo(() => {
    let next = allRows;
    if (bucket === 'urgent') next = next.filter((r) => r.urgency === 'urgent');
    if (bucket === 'awaiting')
      next = next.filter((r) => r.status === 'submitted' || r.status === 'viewed');
    if (bucket === 'responded') next = next.filter((r) => r.status === 'responded');
    if (bucket === 'flagged') next = next.filter((r) => r.flagged);
    const sorted = [...next];
    if (sort === 'urgency') {
      const rank = { urgent: 0, concerning: 1, routine: 2 } as const;
      sorted.sort((a, b) => rank[a.urgency] - rank[b.urgency]);
    } else {
      sorted.sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime());
    }
    return sorted;
  }, [allRows, bucket, sort]);

  // Auto-select the first filtered row when none is in the URL.
  useEffect(() => {
    if (paramId) return;
    if (filteredRows.length === 0) return;
    navigate(`/reports/${filteredRows[0].id}`, { replace: true });
  }, [paramId, filteredRows, navigate]);

  const selectedId = paramId ?? filteredRows[0]?.id;

  return (
    <div className="mx-auto max-w-[1400px] space-y-8">
      <PageHeader
        eyebrow="Reports inbox"
        title="Reports from your patients."
        description={
          <>
            <span className="text-foreground">{counts.awaiting}</span> awaiting response ·{' '}
            <span className="text-err-dark">{counts.urgent} urgent</span>
            {hasActiveServerFilters(serverFilters) && (
              <>
                {' '}
                · <span className="text-foreground">filtered</span>
              </>
            )}
          </>
        }
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              disabled={markAll.isPending || counts.awaiting === 0}
              onClick={() =>
                markAll.mutate(undefined, {
                  onSuccess: (res) => {
                    const n = res?.data?.updated ?? 0;
                    toast.success(
                      n === 0
                        ? 'Inbox already up to date.'
                        : `Marked ${n} report${n === 1 ? '' : 's'} as read.`,
                    );
                  },
                  onError: (err) =>
                    toast.error(err instanceof Error ? err.message : 'Failed to mark read.'),
                })
              }
            >
              <CheckCheck className="mr-2 h-3.5 w-3.5" />
              {markAll.isPending ? 'Marking…' : 'Mark all read'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setFiltersOpen(true)}>
              <Filter className="mr-2 h-3.5 w-3.5" />
              Filters
              {hasActiveServerFilters(serverFilters) && (
                <span className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-gold-600 font-mono text-[9px] text-navy-900">
                  {countActiveServerFilters(serverFilters)}
                </span>
              )}
            </Button>
          </>
        }
      />

      <FiltersDialog
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        value={serverFilters}
        onApply={(next) => {
          setServerFilters(next);
          setPage(1); // server-side filter change → reset paging
          setFiltersOpen(false);
        }}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <FilterPill active={bucket === 'all'} count={counts.all} onClick={() => setBucket('all')}>
            All
          </FilterPill>
          <FilterPill
            urgent
            active={bucket === 'urgent'}
            count={counts.urgent}
            onClick={() => setBucket('urgent')}
          >
            Urgent
          </FilterPill>
          <FilterPill
            active={bucket === 'awaiting'}
            count={counts.awaiting}
            onClick={() => setBucket('awaiting')}
          >
            Awaiting response
          </FilterPill>
          <FilterPill
            active={bucket === 'responded'}
            count={counts.responded}
            onClick={() => setBucket('responded')}
          >
            Responded
          </FilterPill>
          <FilterPill
            active={bucket === 'flagged'}
            count={counts.flagged}
            onClick={() => setBucket('flagged')}
          >
            Flagged
          </FilterPill>
        </div>
        <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-0 overflow-hidden rounded-sm border border-border/70 bg-card lg:grid-cols-[400px_1fr]">
        {/* ─── List pane ────────────────────────────────────────────────── */}
        <aside className="border-b border-border/70 lg:border-b-0 lg:border-r">
          <div className="max-h-[calc(100vh-22rem)] overflow-y-auto">
            {inbox.isLoading ? (
              <ListSkeletons />
            ) : filteredRows.length === 0 ? (
              <div className="p-10">
                <EmptyState
                  icon={<Inbox className="h-6 w-6" />}
                  title="All caught up."
                  description={
                    bucket === 'all'
                      ? "No new reports. We'll notify you instantly when one arrives."
                      : 'No reports match this filter.'
                  }
                />
              </div>
            ) : (
              <ul>
                {filteredRows.map((r) => (
                  <li key={r.id}>
                    <ListItem
                      row={r}
                      selected={r.id === selectedId}
                      onSelect={() => navigate(`/reports/${r.id}`)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Pagination footer */}
          {total > PAGE_SIZE && (
            <div className="flex items-center justify-between border-t border-border/70 bg-secondary/30 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              <span>
                Page {page} / {totalPages} · {total} filed
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-sm border border-border bg-card hover:bg-secondary disabled:pointer-events-none disabled:opacity-40"
                  aria-label="Previous"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-sm border border-border bg-card hover:bg-secondary disabled:pointer-events-none disabled:opacity-40"
                  aria-label="Next"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </aside>

        {/* ─── Detail pane ──────────────────────────────────────────────── */}
        <section className="min-h-[600px]">
          {selectedId ? (
            <ReportDetail reportId={selectedId} />
          ) : (
            <div className="flex h-full items-center justify-center p-10">
              <EmptyState
                icon={<Mail className="h-6 w-6" />}
                title="Select a report"
                description="Pick a report from the inbox to read it and respond."
              />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function ListSkeletons() {
  return (
    <ul>
      {Array.from({ length: 5 }).map((_, i) => (
        <li key={i} className="border-b border-border/40 p-4">
          <div className="flex gap-3">
            <Skeleton className="h-9 w-9 shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function ListItem({
  row,
  selected,
  onSelect,
}: {
  row: InboxRow;
  selected: boolean;
  onSelect: () => void;
}) {
  const unread = row.status === 'submitted';
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'block w-full border-b border-border/40 border-l-2 px-4 py-3 text-left transition-colors hover:bg-secondary/40',
        urgencyLeft(row.urgency),
        selected && 'bg-secondary/60',
        row.urgency === 'urgent' && !selected && 'bg-err/[0.03]',
      )}
    >
      <div className="flex items-start gap-3">
        <Avatar size="sm" className="mt-0.5">
          <AvatarFallback>{initials(row.patient_first_name, row.patient_last_name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 truncate">
              <span
                className={cn(
                  'truncate font-serif text-sm tracking-tightest',
                  unread && 'font-medium',
                )}
              >
                {row.patient_first_name} {row.patient_last_name}
              </span>
              {row.flagged && <Flag className="h-3 w-3 fill-gold-600 stroke-gold-600" />}
            </div>
            <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              {formatDistanceToNow(new Date(row.submitted_at), { addSuffix: true })}
            </span>
          </div>

          <div className="mt-1 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em]">
            <Badge variant={urgencyBadgeVariant(row.urgency)}>
              {row.urgency === 'urgent' && <TriangleAlert className="h-2.5 w-2.5" />}
              {row.urgency} · pain {row.pain_level ?? '—'}/10
            </Badge>
          </div>

          {row.description_preview && (
            <p
              className={cn(
                'mt-1.5 line-clamp-2 text-xs leading-relaxed',
                unread ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              {row.description_preview}
            </p>
          )}

          <div className="mt-2 flex items-center justify-between">
            <Badge variant={statusBadgeVariant(row.status)}>{statusLabel(row.status)}</Badge>
          </div>
        </div>
      </div>
    </button>
  );
}

function ReportDetail({ reportId }: { reportId: string }) {
  const q = useReport(reportId);
  const flag = useFlagReport(reportId);
  const review = useMarkReviewed(reportId);
  const respond = useRespondToReport(reportId);

  const [message, setMessage] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [recordVisitOpen, setRecordVisitOpen] = useState(false);

  // Reset draft when switching reports.
  useEffect(() => {
    setMessage('');
    setInternalNotes('');
  }, [reportId]);

  if (q.isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-12 w-2/3" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (q.isError || !q.data) {
    return (
      <div className="p-10">
        <EmptyState
          title="Couldn't load this report."
          description={q.error instanceof Error ? q.error.message : 'Try selecting another.'}
        />
      </div>
    );
  }

  const { report, responses } = q.data;

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

  return (
    <article className="flex h-full flex-col overflow-y-auto">
      {/* Header */}
      <header className="border-b border-border/70 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-1 items-start gap-4">
            <Avatar size="md">
              {report.patient_avatar_url && <AvatarImage src={report.patient_avatar_url} alt="" />}
              <AvatarFallback className="bg-navy-600 text-background">
                {initials(report.patient_first_name, report.patient_last_name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <h2 className="font-serif text-2xl tracking-tightest">
                {report.patient_first_name} {report.patient_last_name}
              </h2>
              <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Report · {format(new Date(report.submitted_at), 'd MMM yyyy')}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setRecordVisitOpen(true)}>
              <CalendarPlus className="mr-1.5 h-3.5 w-3.5" />
              Log visit
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                flag.mutate(undefined, {
                  onSuccess: (res) =>
                    toast.success(res?.data?.flagged ? 'Report flagged.' : 'Flag removed.'),
                  onError: (err) =>
                    toast.error(err instanceof Error ? err.message : 'Failed to toggle flag.'),
                })
              }
              disabled={flag.isPending}
            >
              <Flag className={cn('mr-1.5 h-3.5 w-3.5', report.flagged && 'fill-gold-600 stroke-gold-600')} />
              {report.flagged ? 'Unflag' : 'Flag'}
            </Button>
            {report.status !== 'reviewed' && report.status !== 'responded' && (
              <Button
                size="sm"
                onClick={() =>
                  review.mutate(undefined, {
                    onSuccess: () => toast.success('Marked reviewed.'),
                    onError: (err) =>
                      toast.error(err instanceof Error ? err.message : 'Failed.'),
                  })
                }
                disabled={review.isPending}
              >
                <Check className="mr-1.5 h-3.5 w-3.5" />
                Mark reviewed
              </Button>
            )}
          </div>
        </div>

        {/* Meta tags */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Badge variant={urgencyBadgeVariant(report.urgency)} size="md">
            {report.urgency === 'urgent' && <TriangleAlert className="h-3 w-3" />}
            {report.urgency}
          </Badge>
          <Badge variant="muted">
            Submitted · {format(new Date(report.submitted_at), 'd MMM · HH:mm')}
          </Badge>
          <Badge variant="muted">Status · {statusLabel(report.status)}</Badge>
          {report.flagged && (
            <Badge variant="gold">
              <Flag className="h-2.5 w-2.5" />
              Flagged
            </Badge>
          )}
        </div>
      </header>

      {/* Pain score card */}
      {report.pain_level != null && (
        <section className="border-b border-border/70 bg-gradient-to-br from-err/5 to-gold-100/40 px-6 py-5">
          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className={cn('font-serif text-6xl leading-none tracking-tightest', painTone(report.pain_level))}>
                {report.pain_level}
              </div>
              <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                / 10 pain
              </div>
            </div>
            <div className="flex-1">
              <div className="font-serif text-lg tracking-tightest text-foreground">
                {report.pain_level >= 7
                  ? 'Pain spike — crossed urgent threshold'
                  : report.pain_level >= 4
                    ? 'Moderate pain reported'
                    : 'Routine check-in'}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {report.pain_level >= 7
                  ? 'Patient reported severe pain. Consider rapid response, especially if symptoms are escalating.'
                  : 'Patient submitted a structured update. Review and reply to keep the chart current.'}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Patient message */}
      <section className="border-b border-border/70 px-6 py-5">
        <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          Patient's message
        </div>
        <blockquote className="border-l-2 border-gold-600 bg-secondary/30 p-4 font-serif text-base italic leading-relaxed tracking-tight text-foreground">
          {report.description}
        </blockquote>
        {report.patient_notes && (
          <div className="mt-3 rounded-sm border border-border/60 bg-card p-3">
            <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Additional notes
            </div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{report.patient_notes}</p>
          </div>
        )}
      </section>

      {/* Attachments */}
      {report.photo_url && (
        <section className="border-b border-border/70 px-6 py-5">
          <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Attached photo · 1 of 1
          </div>
          <div className="overflow-hidden rounded-sm border border-border/70">
            <img
              src={report.photo_url}
              alt="Report attachment"
              className="max-h-80 w-full object-cover"
            />
          </div>
        </section>
      )}

      {/* Clinical context (real backend) */}
      <ContextSection patientId={report.patient_id} />

      {/* Conversation history */}
      {responses.length > 0 && (
        <section className="border-b border-border/70 px-6 py-5">
          <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Conversation · {responses.length.toString().padStart(2, '0')} response
            {responses.length === 1 ? '' : 's'}
          </div>
          <ol className="space-y-3">
            {responses.map((r) => (
              <ResponseItem key={r.id} r={r} />
            ))}
          </ol>
        </section>
      )}

      {/* Composer */}
      <form onSubmit={onSend} className="m-6 mt-auto rounded-sm border-2 border-gold-600/40 bg-card">
        <div className="flex items-center justify-between border-b border-gold-600/30 bg-gold-100/30 px-4 py-2">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-gold-700">
            <Mail className="h-3.5 w-3.5" />
            Respond
          </div>
        </div>
        <div className="space-y-3 p-4">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Write a clear, calm response…"
            rows={4}
            required
            className="resize-none border-0 bg-transparent p-0 focus-visible:ring-0"
          />
          <div className="border-t border-border/60 pt-3">
            <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Internal notes · private
            </label>
            <Textarea
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              placeholder="Clinical notes the patient won't see…"
              rows={2}
              className="resize-none bg-secondary/30"
            />
          </div>
          {respond.isError && (
            <p className="text-xs text-destructive">
              {respond.error instanceof Error ? respond.error.message : 'Failed to send.'}
            </p>
          )}
        </div>
        <div className="flex items-center justify-between border-t border-border/60 bg-secondary/30 px-4 py-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            {message.length}/5000
          </span>
          <Button type="submit" size="sm" disabled={respond.isPending || !message.trim()}>
            {respond.isPending ? 'Sending…' : 'Send response'}
            <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
          </Button>
        </div>
      </form>

      <RecordVisitDialog
        open={recordVisitOpen}
        patientId={report.patient_id}
        patientName={`${report.patient_first_name} ${report.patient_last_name}`}
        onClose={() => setRecordVisitOpen(false)}
      />
    </article>
  );
}

function ResponseItem({ r }: { r: ReportResponse }) {
  return (
    <li className="rounded-sm border border-border/70 bg-card p-4">
      <div className="mb-2 flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
        <span className="text-foreground">You responded</span>
        <span>{format(new Date(r.responded_at), 'd MMM yyyy · HH:mm')}</span>
      </div>
      <p className="whitespace-pre-wrap text-sm leading-relaxed">{r.message}</p>
      {r.internal_notes && (
        <div className="mt-3 rounded-sm border-l-2 border-gold-600 bg-gold-100/30 p-3">
          <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Internal notes · private
          </div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{r.internal_notes}</p>
        </div>
      )}
    </li>
  );
}

// ─── Server-side filter helpers ──────────────────────────────────────────────

function hasActiveServerFilters(f: ServerFilters): boolean {
  return Boolean(f.urgency || f.status || f.patient_id || f.from || f.to);
}

function countActiveServerFilters(f: ServerFilters): number {
  return (
    (f.urgency ? 1 : 0) +
    (f.status ? 1 : 0) +
    (f.patient_id ? 1 : 0) +
    (f.from ? 1 : 0) +
    (f.to ? 1 : 0)
  );
}

// ─── Filters dialog (server-side filters: urgency, status, date range, patient) ──

function FiltersDialog({
  open,
  onClose,
  value,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  value: ServerFilters;
  onApply: (next: ServerFilters) => void;
}) {
  // Local draft so changes don't leak to URL/network until "Apply" is clicked.
  const [draft, setDraft] = useState<ServerFilters>(value);

  // Sync draft when dialog re-opens with a different applied value.
  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-serif text-xl tracking-tightest">Filter inbox</DialogTitle>
          <DialogDescription>
            Narrow the inbox to a date range, urgency level, status, or a specific patient.
            Bucket pills above this still apply on top of the filtered set.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="filt-from" className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                From
              </Label>
              <Input
                id="filt-from"
                type="date"
                value={draft.from?.slice(0, 10) ?? ''}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    from: e.target.value ? new Date(`${e.target.value}T00:00:00Z`).toISOString() : undefined,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="filt-to" className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                To
              </Label>
              <Input
                id="filt-to"
                type="date"
                value={draft.to?.slice(0, 10) ?? ''}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    to: e.target.value ? new Date(`${e.target.value}T23:59:59Z`).toISOString() : undefined,
                  }))
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Urgency
            </Label>
            <Select
              value={draft.urgency ?? '__any'}
              onValueChange={(v) =>
                setDraft((d) => ({ ...d, urgency: v === '__any' ? undefined : (v as ReportUrgency) }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__any">Any urgency</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="concerning">Concerning</SelectItem>
                <SelectItem value="routine">Routine</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Status
            </Label>
            <Select
              value={draft.status ?? '__any'}
              onValueChange={(v) =>
                setDraft((d) => ({ ...d, status: v === '__any' ? undefined : (v as ReportStatus) }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__any">Any status</SelectItem>
                <SelectItem value="submitted">Unanswered</SelectItem>
                <SelectItem value="viewed">Opened</SelectItem>
                <SelectItem value="reviewed">Reviewed</SelectItem>
                <SelectItem value="responded">Responded</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="filt-patient" className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Patient ID
            </Label>
            <Input
              id="filt-patient"
              placeholder="Paste a patient UUID to scope to one patient"
              value={draft.patient_id ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, patient_id: e.target.value || undefined }))}
            />
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Tip — open the patient from the list to copy their ID; a search picker will land later.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setDraft({})}>
            Clear all
          </Button>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onApply(draft)}>Apply</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Clinical context cards (real backend) ───────────────────────────────────

function ContextSection({ patientId }: { patientId: string }) {
  const analytics = usePatientAnalytics(patientId, 14);
  const lastVisit = useLastClinicVisit(patientId);

  const trend = analytics.data?.pain_trend ?? [];
  const trendValues = trend.map((p) => p.pain_level);
  const trendDirection = trendDirectionOf(trendValues);
  const compliance = analytics.data?.exercise_compliance;
  const visitedAt = lastVisit.data?.visited_at;

  return (
    <section className="grid grid-cols-3 gap-px border-b border-border/70 bg-border/70">
      <ContextCard
        label="14-day pain trend"
        value={
          analytics.isLoading ? (
            <Skeleton className="h-7 w-24" />
          ) : trendValues.length === 0 ? (
            <span className="font-serif text-2xl tracking-tightest text-muted-foreground">—</span>
          ) : (
            <Sparkline data={trendValues} height={28} />
          )
        }
        hint={
          analytics.isLoading
            ? 'Loading…'
            : trendValues.length === 0
              ? 'No symptom logs in window'
              : trendDirection
        }
      />
      <ContextCard
        label="Adherence · 7d"
        value={
          analytics.isLoading ? (
            <Skeleton className="h-7 w-16" />
          ) : compliance == null || compliance.assigned === 0 ? (
            <span className="font-serif text-2xl tracking-tightest text-muted-foreground">—</span>
          ) : (
            <span
              className={cn(
                'font-serif text-2xl tracking-tightest',
                compliance.rate >= 80
                  ? 'text-ok-dark'
                  : compliance.rate >= 50
                    ? 'text-warn-dark'
                    : 'text-err-dark',
              )}
            >
              {Math.round(compliance.rate)}%
            </span>
          )
        }
        hint={
          analytics.isLoading
            ? 'Loading…'
            : compliance == null || compliance.assigned === 0
              ? 'No active assignments'
              : `${compliance.completed}/${compliance.assigned} expected`
        }
      />
      <ContextCard
        label="Last clinic visit"
        value={
          lastVisit.isLoading ? (
            <Skeleton className="h-7 w-24" />
          ) : !visitedAt ? (
            <span className="font-serif text-2xl tracking-tightest text-muted-foreground">—</span>
          ) : (
            <span className="font-serif text-2xl tracking-tightest text-foreground">
              {formatDistanceToNow(new Date(visitedAt), { addSuffix: false })}
            </span>
          )
        }
        hint={
          lastVisit.isLoading
            ? 'Loading…'
            : !visitedAt
              ? 'Use "Log visit" above to record one'
              : `${format(new Date(visitedAt), 'd MMM yyyy')} ago`
        }
      />
    </section>
  );
}

function ContextCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint: string;
}) {
  return (
    <div className="bg-card p-4">
      <div className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
        {label}
      </div>
      <div>{value}</div>
      <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {hint}
      </div>
    </div>
  );
}

/**
 * Cheap trend descriptor — compares the average of the first half of the
 * window vs the second half. Avoids over-reading noise from a single high day.
 */
function trendDirectionOf(values: number[]): string {
  if (values.length < 4) return 'Insufficient data';
  const mid = Math.floor(values.length / 2);
  const head = values.slice(0, mid);
  const tail = values.slice(mid);
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const delta = avg(tail) - avg(head);
  if (delta > 0.5) return 'Climbing';
  if (delta < -0.5) return 'Improving';
  return 'Stable';
}

// ─── Record clinic visit dialog ──────────────────────────────────────────────

function RecordVisitDialog({
  open,
  patientId,
  patientName,
  onClose,
}: {
  open: boolean;
  patientId: string;
  patientName: string;
  onClose: () => void;
}) {
  const record = useRecordClinicVisit(patientId);
  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState<string>(() => new Date().toTimeString().slice(0, 5));
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (open) {
      const now = new Date();
      setDate(now.toISOString().slice(0, 10));
      setTime(now.toTimeString().slice(0, 5));
      setNotes('');
    }
  }, [open]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await record.mutateAsync({
        visited_at: new Date(`${date}T${time}:00`).toISOString(),
        notes: notes.trim() || null,
      });
      toast.success('Clinic visit recorded.');
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to record visit.');
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-serif text-xl tracking-tightest">
            Log clinic visit
          </DialogTitle>
          <DialogDescription>
            Record an in-clinic encounter with {patientName}. Visible to providers only — never to
            the patient.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="visit-date" className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                Date
              </Label>
              <Input
                id="visit-date"
                type="date"
                value={date}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="visit-time" className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                Time
              </Label>
              <Input
                id="visit-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="visit-notes" className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Notes (optional)
            </Label>
            <Textarea
              id="visit-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="What was discussed, exam findings, follow-up plan…"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={record.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={record.isPending}>
              {record.isPending ? 'Saving…' : 'Record visit'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

