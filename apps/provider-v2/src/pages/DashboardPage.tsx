import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { differenceInDays, formatDistanceToNow } from 'date-fns';
import {
  ArrowRight,
  Download,
  Inbox,
  TriangleAlert,
  UserPlus,
  Users,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage, initials } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, type DataColumn } from '@/components/ui/data-table';
import { FilterPill } from '@/components/ui/filter-pill';
import { KpiCard } from '@/components/ui/kpi-card';
import { PageHeader } from '@/components/ui/page-header';
import { Sparkline } from '@/components/ui/sparkline';
import { useAuth } from '@/features/auth/AuthProvider';
import { useDashboardSummary } from '@/features/dashboard/queries';
import type { PatientRow } from '@/features/patients/types';

type Bucket = 'all' | 'attention' | 'recent' | 'inactive' | 'pending';

// Maps a backend KpiDelta into the props KpiCard expects (delta string + trend
// direction). When the prior baseline is null, the card just shows the hint.
// invertGood flips the colour for metrics where "down is good" (e.g. urgent).
function deltaProps(
  d: { value: number | null; pct: number | null } | undefined,
  hint: string,
  invertGood = false,
): { delta?: React.ReactNode; trend?: 'up' | 'down' | 'flat'; hint: React.ReactNode } {
  if (!d || d.value == null) return { hint };
  if (d.value === 0) return { delta: 'No change', trend: 'flat', hint };
  const isUp = d.value > 0;
  const positive = invertGood ? !isUp : isUp;
  const trend: 'up' | 'down' = isUp ? 'up' : 'down';
  const sign = isUp ? '+' : '';
  const pctStr = d.pct == null ? `${sign}${d.value}` : `${sign}${d.value} (${d.pct > 0 ? '+' : ''}${d.pct}%)`;
  return { delta: pctStr, trend: positive ? trend : trend, hint };
}

function painSeverity(value: number | null): {
  variant: 'urgent' | 'moderate' | 'improving' | 'stable' | 'inactive';
  label: string;
} {
  if (value == null) return { variant: 'inactive', label: 'No data' };
  if (value >= 7) return { variant: 'urgent', label: 'Urgent' };
  if (value >= 4) return { variant: 'moderate', label: 'Moderate' };
  if (value > 0) return { variant: 'stable', label: 'Stable' };
  return { variant: 'improving', label: 'Improving' };
}

function bucketFor(p: PatientRow): Bucket[] {
  const buckets: Bucket[] = ['all'];
  const isUrgent = (p.avg_pain_7d ?? 0) >= 7;
  const lastDays = p.last_symptom_at ? differenceInDays(new Date(), new Date(p.last_symptom_at)) : null;
  if (isUrgent) buckets.push('attention');
  if (lastDays != null && lastDays <= 3) buckets.push('recent');
  if (lastDays == null || lastDays > 7) buckets.push('inactive');
  return buckets;
}

export function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data, isLoading } = useDashboardSummary();
  const [filter, setFilter] = useState<Bucket>('all');

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 5) return 'Working late';
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  })();
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const urgentCount = useMemo(
    () => data.recentPatients.filter((p) => (p.avg_pain_7d ?? 0) >= 7).length,
    [data.recentPatients],
  );
  const inactiveCount = useMemo(
    () =>
      data.recentPatients.filter(
        (p) => !p.last_symptom_at || differenceInDays(new Date(), new Date(p.last_symptom_at)) > 7,
      ).length,
    [data.recentPatients],
  );
  const recentCount = useMemo(
    () =>
      data.recentPatients.filter(
        (p) => p.last_symptom_at && differenceInDays(new Date(), new Date(p.last_symptom_at)) <= 3,
      ).length,
    [data.recentPatients],
  );

  const filteredRows = useMemo(
    () => data.recentPatients.filter((p) => bucketFor(p).includes(filter)),
    [data.recentPatients, filter],
  );

  const columns: DataColumn<PatientRow>[] = [
    {
      key: 'patient',
      header: 'Patient',
      cell: (p) => (
        <div className="flex items-center gap-3">
          <Avatar size="sm">
            {p.avatar_url && <AvatarImage src={p.avatar_url} alt="" />}
            <AvatarFallback>{initials(p.first_name, p.last_name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="truncate font-serif text-base tracking-tightest">
              {p.first_name} {p.last_name}
            </div>
            <div className="truncate font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              {p.last_symptom_at
                ? `Last log ${formatDistanceToNow(new Date(p.last_symptom_at), { addSuffix: true })}`
                : 'No logs yet'}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'pain',
      header: '7-day pain',
      align: 'right',
      width: '110px',
      cell: (p) => (
        <span className="font-serif text-lg tracking-tightest text-foreground">
          {p.avg_pain_7d != null ? p.avg_pain_7d.toFixed(1) : '—'}
        </span>
      ),
    },
    {
      key: 'trend',
      header: '14-day trend',
      width: '160px',
      cell: (p) => (
        <Sparkline
          data={(p.daily_pain_14d ?? []).map((d) => d.pain_level)}
          height={28}
        />
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: '120px',
      cell: (p) => {
        const sev = painSeverity(p.avg_pain_7d);
        return <Badge variant={sev.variant}>{sev.label}</Badge>;
      },
    },
    {
      key: 'action',
      header: '',
      width: '40px',
      align: 'right',
      cell: () => <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground" />,
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <PageHeader
        eyebrow={today}
        title={
          <>
            {greeting},{' '}
            <em className="not-italic text-gold-700">
              Dr. {user?.firstName ?? 'Provider'}.
            </em>
          </>
        }
        description={
          urgentCount > 0
            ? `${urgentCount} patient${urgentCount === 1 ? '' : 's'} flagged urgent — start with the inbox.`
            : 'No urgent flags right now. A calm day ahead.'
        }
        actions={
          <>
            <Button variant="outline" size="sm">
              <Download className="mr-2 h-3.5 w-3.5" />
              Export
            </Button>
            <Button size="sm" onClick={() => navigate('/linking')}>
              <UserPlus className="mr-2 h-3.5 w-3.5" />
              Invite patient
            </Button>
          </>
        }
      />

      {/* KPI row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        <KpiCard
          label="Total patients"
          value={isLoading ? '—' : data.activePatients}
          icon={<Users className="h-4 w-4" />}
          {...deltaProps(data.deltas?.activePatients, 'new this week')}
        />
        <KpiCard
          accent="gold"
          label="Reports awaiting"
          value={isLoading ? '—' : data.unreadReports}
          icon={<Inbox className="h-4 w-4" />}
          {...deltaProps(data.deltas?.unreadReports, 'vs prior 7d')}
        />
        <KpiCard
          accent="urgent"
          label="Urgent (pain ≥7)"
          value={isLoading ? '—' : data.urgentReports}
          icon={<TriangleAlert className="h-4 w-4" />}
          {...deltaProps(data.deltas?.urgentReports, 'vs prior 7d', /* invertGood */ true)}
        />
        <KpiCard
          accent="ok"
          label="Pending invites"
          value={isLoading ? '—' : data.pendingCodes}
          {...deltaProps(data.deltas?.pendingCodes, 'codes issued · 7d')}
        />
      </div>

      {/* Filter pills + table */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <FilterPill active={filter === 'all'} count={data.recentPatients.length} onClick={() => setFilter('all')}>
            All
          </FilterPill>
          <FilterPill
            urgent
            active={filter === 'attention'}
            count={urgentCount}
            onClick={() => setFilter('attention')}
          >
            Needs attention
          </FilterPill>
          <FilterPill active={filter === 'recent'} count={recentCount} onClick={() => setFilter('recent')}>
            Recent activity
          </FilterPill>
          <FilterPill active={filter === 'inactive'} count={inactiveCount} onClick={() => setFilter('inactive')}>
            No activity · 7d
          </FilterPill>
        </div>

        <DataTable
          columns={columns}
          rows={filteredRows}
          rowKey={(p) => p.patient_id}
          loading={isLoading}
          onRowClick={(p) => navigate(`/patients/${p.patient_id}`)}
          rowClassName={(p) =>
            (p.avg_pain_7d ?? 0) >= 7 ? 'bg-err/10 hover:bg-err/15' : undefined
          }
          emptyState={
            <div className="text-center font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              No patients match this filter.
            </div>
          }
        />
      </div>
    </div>
  );
}
