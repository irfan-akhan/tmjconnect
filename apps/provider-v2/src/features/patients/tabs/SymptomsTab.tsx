import { useMemo } from 'react';
import { format } from 'date-fns';
import { Activity, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { usePatientSymptoms, type SymptomLog } from '@/features/patients/detail-queries';
import { EmptyState, SkeletonList } from './shared';

function painChip(value: number) {
  if (value >= 7) return { bg: 'bg-destructive/10', fg: 'text-destructive' };
  if (value >= 4) return { bg: 'bg-accent/15', fg: 'text-accent' };
  return { bg: 'bg-secondary', fg: 'text-foreground' };
}

function SymptomItem({ log }: { log: SymptomLog }) {
  const chip = painChip(log.pain_level);
  return (
    <li className="grid grid-cols-[auto_auto_1fr] items-start gap-6 border-t border-border/70 bg-card p-5 first:border-t-0">
      <div className="w-16 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
        {format(new Date(log.logged_at), 'd MMM')}
        <div className="mt-1 text-muted-foreground/60">{format(new Date(log.logged_at), 'HH:mm')}</div>
      </div>
      <div className={cn('flex h-12 w-12 items-center justify-center rounded-sm font-serif text-xl tracking-tightest', chip.bg, chip.fg)}>
        {log.pain_level}
      </div>
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {log.pain_types.map((t) => (
            <span key={t} className="rounded-sm border border-border bg-background px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {t}
            </span>
          ))}
          {log.body_areas.map((a, i) => (
            <span key={i} className="rounded-sm bg-secondary px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider">
              {a.area}
              {a.side && <span className="text-muted-foreground"> · {a.side}</span>}
            </span>
          ))}
          {log.duration_minutes != null && (
            <span className="inline-flex items-center gap-1 rounded-sm border border-border bg-background px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              <Clock className="h-3 w-3" />
              {log.duration_minutes}m
            </span>
          )}
        </div>
        {log.triggers.length > 0 && (
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Triggers · <span className="text-foreground normal-case tracking-normal">{log.triggers.join(', ')}</span>
          </div>
        )}
        {log.notes && <p className="text-sm leading-relaxed text-foreground">{log.notes}</p>}
      </div>
    </li>
  );
}

export function SymptomsTab({ patientId }: { patientId: string }) {
  const q = usePatientSymptoms(patientId);
  const logs = useMemo(() => q.data?.pages.flatMap((p) => p.data) ?? [], [q.data]);

  if (q.isLoading) return <SkeletonList />;
  if (q.isError) {
    return (
      <p className="py-8 text-sm text-destructive">
        {q.error instanceof Error ? q.error.message : 'Failed to load symptoms.'}
      </p>
    );
  }
  if (logs.length === 0) {
    return <EmptyState icon={Activity} title="No symptom logs yet." body="When the patient logs symptoms, they'll appear here." />;
  }

  const max = Math.max(...logs.map((l) => l.pain_level), 1);

  return (
    <div className="space-y-10">
      <section className="rounded-sm border border-border/70 bg-card p-8">
        <div className="mb-6 flex items-baseline justify-between">
          <h2 className="font-serif text-2xl tracking-tightest">Pain over time</h2>
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            {logs.length} logs
          </span>
        </div>
        <div className="flex h-32 items-end gap-1">
          {[...logs].reverse().map((l) => {
            const h = (l.pain_level / max) * 100;
            const tone =
              l.pain_level >= 7 ? 'bg-destructive' : l.pain_level >= 4 ? 'bg-accent' : 'bg-foreground/40';
            return (
              <div
                key={l.id}
                className={cn('flex-1 rounded-t-sm transition-opacity hover:opacity-70', tone)}
                style={{ height: `${Math.max(h, 4)}%` }}
                title={`${format(new Date(l.logged_at), 'd MMM yyyy')} · Pain ${l.pain_level}`}
              />
            );
          })}
        </div>
      </section>

      <ol className="space-y-px overflow-hidden rounded-sm border border-border/70">
        {logs.map((l) => (
          <SymptomItem key={l.id} log={l} />
        ))}
      </ol>

      {q.hasNextPage && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => q.fetchNextPage()} disabled={q.isFetchingNextPage}>
            {q.isFetchingNextPage ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      )}
    </div>
  );
}

export default SymptomsTab;
