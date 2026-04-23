import { format, formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router-dom';
import { AlertTriangle, FileText, Flag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { usePatientReports, type ReportRow } from '@/features/patients/detail-queries';
import { EmptyState, SkeletonList } from './shared';

export function ReportsTab({ patientId }: { patientId: string }) {
  const q = usePatientReports(patientId);

  if (q.isLoading) return <SkeletonList />;
  if (q.isError) {
    return (
      <p className="py-8 text-sm text-destructive">
        {q.error instanceof Error ? q.error.message : 'Failed to load reports.'}
      </p>
    );
  }
  const rows = q.data?.data ?? [];
  if (rows.length === 0) {
    return <EmptyState icon={FileText} title="No reports filed." body="Reports submitted by this patient will stream into their chart here." />;
  }

  return (
    <ol className="overflow-hidden rounded-sm border border-border/70">
      {rows.map((r) => (
        <ReportItem key={r.id} r={r} />
      ))}
    </ol>
  );
}

function ReportItem({ r }: { r: ReportRow }) {
  const urgencyTone =
    r.urgency === 'urgent'
      ? 'text-destructive border-destructive/30'
      : r.urgency === 'concerning'
      ? 'text-accent border-accent/30'
      : 'text-muted-foreground border-border';

  const statusLabel: Record<ReportRow['status'], string> = {
    submitted: 'Awaiting review',
    viewed: 'Opened',
    reviewed: 'Reviewed',
    responded: 'Responded',
  };

  return (
    <li className="grid grid-cols-[auto_auto_1fr_auto] items-start gap-5 border-t border-border/70 bg-card p-5 first:border-t-0">
      <div className="w-16 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
        {format(new Date(r.submitted_at), 'd MMM')}
        <div className="mt-1 text-muted-foreground/60">
          {formatDistanceToNow(new Date(r.submitted_at), { addSuffix: true })}
        </div>
      </div>
      <div className={cn('flex h-6 items-center rounded-sm border px-2 font-mono text-[10px] uppercase tracking-[0.18em]', urgencyTone)}>
        {r.urgency === 'urgent' && <AlertTriangle className="mr-1 h-3 w-3" />}
        {r.urgency}
      </div>
      <div className="min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            {statusLabel[r.status]}
          </span>
          {r.flagged && <Flag className="h-3 w-3 fill-accent stroke-accent" />}
          {r.pain_level != null && (
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              · Pain {r.pain_level}
            </span>
          )}
        </div>
        {r.description_preview && (
          <p className="line-clamp-2 text-sm leading-relaxed text-foreground">{r.description_preview}</p>
        )}
      </div>
      <Button asChild variant="outline" size="sm">
        <Link to={`/reports/${r.id}`}>Open</Link>
      </Button>
    </li>
  );
}

export default ReportsTab;
