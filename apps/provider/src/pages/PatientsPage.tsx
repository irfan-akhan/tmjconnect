import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow, format } from 'date-fns';
import { ArrowUpRight, ChevronLeft, ChevronRight, Search, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { usePatients } from '@/features/patients/queries';
import type { PatientRow } from '@/features/patients/types';
import { useDebounced } from '@/hooks/useDebounced';

const LIMIT = 20;

function initials(first: string, last: string) {
  return `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase() || '—';
}

function painTone(value: number | null) {
  if (value == null) return 'text-muted-foreground';
  if (value >= 7) return 'text-destructive';
  if (value >= 4) return 'text-accent';
  return 'text-foreground';
}

function PatientRowItem({ p, onClick }: { p: PatientRow; onClick: () => void }) {
  const lastSeen = p.last_symptom_at
    ? formatDistanceToNow(new Date(p.last_symptom_at), { addSuffix: true })
    : '—';
  return (
    <button
      onClick={onClick}
      className="group grid w-full grid-cols-[auto_1fr_auto_auto_auto_auto] items-center gap-6 border-t border-border/70 bg-card px-6 py-5 text-left transition-colors first:border-t-0 hover:bg-secondary/40"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-secondary font-mono text-xs tracking-wider text-muted-foreground">
        {initials(p.first_name, p.last_name)}
      </div>

      <div className="min-w-0">
        <div className="truncate font-serif text-lg tracking-tightest">
          {p.first_name} {p.last_name}
        </div>
        <div className="truncate font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          Linked {format(new Date(p.linked_at), 'd MMM yyyy')}
        </div>
      </div>

      <div className="w-24 text-right">
        <div className={cn('font-serif text-2xl tracking-tightest', painTone(p.avg_pain_7d))}>
          {p.avg_pain_7d?.toFixed(1) ?? '—'}
        </div>
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          Pain · 7d
        </div>
      </div>

      <div className="w-24 text-right">
        <div className="font-serif text-2xl tracking-tightest">{p.exercises_completed_7d}</div>
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          Exercises · 7d
        </div>
      </div>

      <div className="w-40 text-right font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        Last log<br />
        <span className="text-foreground normal-case tracking-normal">{lastSeen}</span>
      </div>

      <ArrowUpRight className="h-4 w-4 stroke-[1.5] text-muted-foreground transition-colors group-hover:text-foreground" />
    </button>
  );
}

function SkeletonRow() {
  return (
    <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] items-center gap-6 border-t border-border/70 px-6 py-5 first:border-t-0">
      <div className="h-10 w-10 animate-pulse rounded-sm bg-secondary" />
      <div className="space-y-2">
        <div className="h-4 w-40 animate-pulse rounded-sm bg-secondary" />
        <div className="h-3 w-24 animate-pulse rounded-sm bg-secondary" />
      </div>
      <div className="h-8 w-20 animate-pulse rounded-sm bg-secondary" />
      <div className="h-8 w-20 animate-pulse rounded-sm bg-secondary" />
      <div className="h-4 w-32 animate-pulse rounded-sm bg-secondary" />
      <div className="h-4 w-4" />
    </div>
  );
}

export function PatientsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounced(search, 300);

  const { data, isLoading, isError, error, isFetching } = usePatients({
    page,
    limit: LIMIT,
    search: debouncedSearch,
  });

  const rows = data?.data ?? [];
  const meta = data?.meta;
  const totalPages = meta?.totalPages ?? 1;

  function onSearch(v: string) {
    setSearch(v);
    setPage(1);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-10">
      <header className="flex items-end justify-between gap-8 border-b border-border/70 pb-8">
        <div>
          <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            Folio № 02 — Patients
            {meta && (
              <span className="ml-3 text-muted-foreground/60">
                {meta.total.toString().padStart(3, '0')} total
              </span>
            )}
          </div>
          <h1 className="font-serif text-5xl tracking-tightest">
            The people in <em className="text-accent">your care.</em>
          </h1>
        </div>
        <Button>Generate linking code</Button>
      </header>

      <div className="flex items-center justify-between gap-4">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 stroke-[1.5] text-muted-foreground" />
          <Input
            placeholder="Search by name…"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {isFetching && !isLoading && (
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Updating…
          </span>
        )}
      </div>

      <section className="overflow-hidden rounded-sm border border-border/70">
        {isLoading ? (
          <>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </>
        ) : isError ? (
          <div className="bg-card p-16 text-center">
            <h2 className="font-serif text-2xl tracking-tightest text-destructive">
              Couldn't load patients.
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {error instanceof Error ? error.message : 'Unknown error'}
            </p>
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-sm border border-dashed border-border bg-card/60 p-16 text-center">
            <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-sm bg-primary/10">
              <Users className="h-6 w-6 stroke-[1.5] text-primary" />
            </div>
            <h2 className="font-serif text-3xl tracking-tightest">
              {debouncedSearch ? 'No matches.' : 'No patients yet.'}
            </h2>
            <p className="mx-auto mt-3 max-w-sm text-sm text-muted-foreground">
              {debouncedSearch
                ? 'Try a different spelling or clear the search.'
                : 'Invite your first patient by generating an invite code. They\'ll download the app and connect with you.'}
            </p>
            {!debouncedSearch && (
              <Button className="mt-6" onClick={() => navigate('/linking')}>
                Invite your first patient
              </Button>
            )}
          </div>
        ) : (
          rows.map((p) => (
            <PatientRowItem
              key={p.patient_id}
              p={p}
              onClick={() => navigate(`/patients/${p.patient_id}`)}
            />
          ))
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
            <Button
              variant="outline"
              size="icon"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </footer>
      )}
    </div>
  );
}
