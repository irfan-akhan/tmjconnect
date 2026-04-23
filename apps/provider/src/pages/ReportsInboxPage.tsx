import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, formatDistanceToNow } from 'date-fns';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Flag,
  Inbox,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useInbox, type InboxRow, type ReportStatus, type ReportUrgency } from '@/features/reports/queries';

const LIMIT = 20;

const STATUS_FILTERS: Array<{ value: ReportStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'submitted', label: 'New' },
  { value: 'viewed', label: 'Opened' },
  { value: 'reviewed', label: 'Reviewed' },
  { value: 'responded', label: 'Responded' },
];

const URGENCY_FILTERS: Array<{ value: ReportUrgency | 'all'; label: string }> = [
  { value: 'all', label: 'Any urgency' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'concerning', label: 'Concerning' },
  { value: 'routine', label: 'Routine' },
];

function initials(first: string, last: string) {
  return `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase() || '—';
}

function urgencyTone(u: ReportUrgency) {
  if (u === 'urgent') return 'text-destructive border-destructive/30 bg-destructive/5';
  if (u === 'concerning') return 'text-accent border-accent/30 bg-accent/5';
  return 'text-muted-foreground border-border bg-background';
}

function statusLabel(s: ReportStatus) {
  return {
    submitted: 'Awaiting review',
    viewed: 'Opened',
    reviewed: 'Reviewed',
    responded: 'Responded',
  }[s];
}

export function ReportsInboxPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<ReportStatus | 'all'>('all');
  const [urgency, setUrgency] = useState<ReportUrgency | 'all'>('all');
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, error, isFetching } = useInbox({
    page,
    limit: LIMIT,
    status: status === 'all' ? undefined : status,
    urgency: urgency === 'all' ? undefined : urgency,
  });

  const rows = data?.data ?? [];
  const meta = data?.meta;
  const totalPages = meta?.totalPages ?? 1;

  return (
    <div className="mx-auto max-w-6xl space-y-10">
      <header className="flex items-end justify-between gap-8 border-b border-border/70 pb-8">
        <div>
          <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            Folio № 04 — Inbox
            {meta && (
              <span className="ml-3 text-muted-foreground/60">
                {meta.total.toString().padStart(3, '0')} filed
              </span>
            )}
          </div>
          <h1 className="font-serif text-5xl tracking-tightest">
            Reports from <em className="text-accent">your patients.</em>
          </h1>
        </div>
      </header>

      {/* Filters */}
      <div className="space-y-3">
        <FilterRow label="Status">
          {STATUS_FILTERS.map((f) => (
            <FilterChip
              key={f.value}
              active={status === f.value}
              onClick={() => {
                setStatus(f.value);
                setPage(1);
              }}
            >
              {f.label}
            </FilterChip>
          ))}
        </FilterRow>
        <FilterRow label="Urgency">
          {URGENCY_FILTERS.map((f) => (
            <FilterChip
              key={f.value}
              active={urgency === f.value}
              onClick={() => {
                setUrgency(f.value);
                setPage(1);
              }}
            >
              {f.label}
            </FilterChip>
          ))}
        </FilterRow>
      </div>

      {isFetching && !isLoading && (
        <span className="block text-right font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          Updating…
        </span>
      )}

      <section className="overflow-hidden rounded-sm border border-border/70">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse border-t border-border/70 bg-secondary first:border-t-0" />
          ))
        ) : isError ? (
          <div className="bg-card p-16 text-center">
            <h2 className="font-serif text-2xl tracking-tightest text-destructive">
              Couldn't load inbox.
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {error instanceof Error ? error.message : 'Unknown error'}
            </p>
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-sm border border-dashed border-border bg-card/60 p-16 text-center">
            {status === 'all' && urgency === 'all' ? (
              <>
                <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10">
                  <svg className="h-6 w-6 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <h2 className="font-serif text-3xl tracking-tightest">All caught up.</h2>
                <p className="mx-auto mt-3 max-w-sm text-sm text-muted-foreground">
                  No new reports from your patients. You'll be notified instantly when a patient submits an urgent report.
                </p>
              </>
            ) : (
              <>
                <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-sm bg-secondary">
                  <Inbox className="h-6 w-6 stroke-[1.5]" />
                </div>
                <h2 className="font-serif text-3xl tracking-tightest">No matches.</h2>
                <p className="mx-auto mt-3 max-w-sm text-sm text-muted-foreground">
                  No reports match these filters. Try adjusting your selection.
                </p>
              </>
            )}
          </div>
        ) : (
          rows.map((r) => <InboxRowItem key={r.id} r={r} onClick={() => navigate(`/reports/${r.id}`)} />)
        )}
      </section>

      {meta && meta.total > 0 && (
        <footer className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          <span>
            Page {String(meta.page).padStart(2, '0')} / {String(totalPages).padStart(2, '0')}
            <span className="ml-3 text-muted-foreground/60">
              {(meta.page - 1) * meta.limit + 1}–
              {Math.min(meta.page * meta.limit, meta.total)} of {meta.total}
            </span>
          </span>
          <div className="flex gap-1">
            <Button variant="outline" size="icon" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </footer>
      )}
    </div>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4">
      <div className="w-20 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
        {label}
      </div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-sm border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] transition-colors',
        active
          ? 'border-foreground bg-foreground text-background'
          : 'border-border bg-card text-muted-foreground hover:border-foreground/40 hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}

function InboxRowItem({ r, onClick }: { r: InboxRow; onClick: () => void }) {
  const unread = r.status === 'submitted';
  return (
    <button
      onClick={onClick}
      className={cn(
        'group grid w-full grid-cols-[auto_auto_auto_1fr_auto_auto] items-start gap-5 border-t border-border/70 bg-card p-5 text-left transition-colors first:border-t-0 hover:bg-secondary/40',
        unread && 'bg-background',
      )}
    >
      {/* unread dot */}
      <div className="mt-1 h-2 w-2 flex-shrink-0 rounded-full">
        {unread && <div className="h-full w-full rounded-full bg-accent" />}
      </div>

      {/* date */}
      <div className="w-16 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
        {format(new Date(r.submitted_at), 'd MMM')}
        <div className="mt-1 text-muted-foreground/60">
          {formatDistanceToNow(new Date(r.submitted_at), { addSuffix: true })}
        </div>
      </div>

      {/* patient */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-sm bg-secondary font-mono text-xs tracking-wider text-muted-foreground">
          {initials(r.patient_first_name, r.patient_last_name)}
        </div>
        <div>
          <div className={cn('font-serif text-base tracking-tightest', unread && 'font-medium')}>
            {r.patient_first_name} {r.patient_last_name}
          </div>
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            {statusLabel(r.status)}
          </div>
        </div>
      </div>

      {/* preview */}
      <div className="min-w-0 pr-4">
        {r.description_preview && (
          <p className={cn('line-clamp-2 text-sm leading-relaxed', unread ? 'text-foreground' : 'text-muted-foreground')}>
            {r.description_preview}
          </p>
        )}
      </div>

      {/* badges */}
      <div className="flex flex-col items-end gap-1.5">
        <span className={cn('inline-flex h-6 items-center rounded-sm border px-2 font-mono text-[10px] uppercase tracking-[0.18em]', urgencyTone(r.urgency))}>
          {r.urgency === 'urgent' && <AlertTriangle className="mr-1 h-3 w-3" />}
          {r.urgency}
        </span>
        {r.pain_level != null && (
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Pain · {r.pain_level}
          </span>
        )}
      </div>

      {/* flag */}
      <div className="flex h-6 w-6 items-center justify-center">
        {r.flagged && <Flag className="h-3.5 w-3.5 fill-accent stroke-accent" />}
      </div>
    </button>
  );
}
