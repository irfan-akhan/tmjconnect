import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { differenceInDays, format, formatDistanceToNow } from 'date-fns';
import {
  ArrowRight,
  Download,
  Inbox,
  Search,
  TriangleAlert,
  UserPlus,
  Users,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage, initials } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, type DataColumn } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { FilterPill } from '@/components/ui/filter-pill';
import { Input } from '@/components/ui/input';
import { KpiCard } from '@/components/ui/kpi-card';
import { PageHeader } from '@/components/ui/page-header';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkline } from '@/components/ui/sparkline';
import { useDebounced } from '@/hooks/useDebounced';
import { usePatients } from '@/features/patients/queries';
import type { PatientRow } from '@/features/patients/types';
import { cn } from '@/lib/utils';

const LIMIT = 10;

type Bucket = 'all' | 'attention' | 'recent' | 'inactive';
type SortKey = 'urgency' | 'recent' | 'pain' | 'name';

const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: 'urgency', label: 'Urgency (high to low)' },
  { value: 'recent', label: 'Most recent activity' },
  { value: 'pain', label: 'Highest 7-day pain' },
  { value: 'name', label: 'Name (A → Z)' },
];

function painTone(value: number | null): {
  variant: 'urgent' | 'moderate' | 'improving' | 'stable' | 'inactive';
  label: string;
  color: string;
} {
  if (value == null) return { variant: 'inactive', label: 'Inactive', color: 'text-muted-foreground' };
  if (value >= 7) return { variant: 'urgent', label: 'Urgent', color: 'text-err-dark' };
  if (value >= 4) return { variant: 'moderate', label: 'Moderate', color: 'text-warn-dark' };
  if (value > 0) return { variant: 'stable', label: 'Stable', color: 'text-ok-dark' };
  return { variant: 'improving', label: 'Improving', color: 'text-ok-dark' };
}

function isInactive(p: PatientRow) {
  if (!p.last_symptom_at) return true;
  return differenceInDays(new Date(), new Date(p.last_symptom_at)) > 7;
}

function isRecent(p: PatientRow) {
  if (!p.last_symptom_at) return false;
  return differenceInDays(new Date(), new Date(p.last_symptom_at)) <= 3;
}

export function PatientsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [bucket, setBucket] = useState<Bucket>('all');
  const [sort, setSort] = useState<SortKey>('urgency');
  const debouncedSearch = useDebounced(search, 300);

  const query = usePatients({ page, limit: LIMIT, search: debouncedSearch });
  const allRows: PatientRow[] = query.data?.data ?? [];
  const total = query.data?.meta?.total ?? 0;

  const counts = useMemo(
    () => ({
      all: allRows.length,
      attention: allRows.filter((p) => (p.avg_pain_7d ?? 0) >= 7).length,
      recent: allRows.filter(isRecent).length,
      inactive: allRows.filter(isInactive).length,
    }),
    [allRows],
  );

  const filteredRows = useMemo(() => {
    let next = allRows;
    if (bucket === 'attention') next = next.filter((p) => (p.avg_pain_7d ?? 0) >= 7);
    if (bucket === 'recent') next = next.filter(isRecent);
    if (bucket === 'inactive') next = next.filter(isInactive);
    const sorted = [...next];
    if (sort === 'urgency') sorted.sort((a, b) => (b.avg_pain_7d ?? -1) - (a.avg_pain_7d ?? -1));
    if (sort === 'pain') sorted.sort((a, b) => (b.avg_pain_7d ?? -1) - (a.avg_pain_7d ?? -1));
    if (sort === 'name')
      sorted.sort((a, b) => `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`));
    if (sort === 'recent')
      sorted.sort(
        (a, b) =>
          (b.last_symptom_at ? new Date(b.last_symptom_at).getTime() : 0) -
          (a.last_symptom_at ? new Date(a.last_symptom_at).getTime() : 0),
      );
    return sorted;
  }, [allRows, bucket, sort]);

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
              Linked {format(new Date(p.linked_at), 'd MMM yyyy')}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'last_login',
      header: 'Last activity',
      width: '160px',
      cell: (p) => (
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          {p.last_symptom_at ? (
            <>
              <div className="text-foreground">
                {formatDistanceToNow(new Date(p.last_symptom_at), { addSuffix: true })}
              </div>
              <div>Symptom log</div>
            </>
          ) : (
            'No logs yet'
          )}
        </div>
      ),
    },
    {
      key: 'pain',
      header: '7-day pain',
      align: 'right',
      width: '110px',
      cell: (p) => {
        const tone = painTone(p.avg_pain_7d);
        return (
          <div className="flex items-baseline justify-end gap-1">
            <span className={cn('font-serif text-2xl tracking-tightest', tone.color)}>
              {p.avg_pain_7d != null ? p.avg_pain_7d.toFixed(1) : '—'}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              /10
            </span>
          </div>
        );
      },
    },
    {
      key: 'trend',
      header: '14-day trend',
      width: '160px',
      // TODO(api): patient list endpoint doesn't expose daily pain time-series yet —
      // sparkline renders the empty state. Add when /providers/patients returns history.
      cell: () => <Sparkline data={[]} height={32} />,
    },
    {
      key: 'status',
      header: 'Status',
      width: '120px',
      cell: (p) => {
        const tone = painTone(p.avg_pain_7d);
        return <Badge variant={tone.variant}>{tone.label}</Badge>;
      },
    },
    {
      key: 'go',
      header: '',
      width: '40px',
      align: 'right',
      cell: () => <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground" />,
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <PageHeader
        eyebrow={`${total.toString().padStart(3, '0')} total in your roster`}
        title="Your patients."
        description="Triage by urgency, scan recent activity, and jump into any chart in one click."
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

      {/* KPI strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Total patients"
          value={total || '—'}
          icon={<Users className="h-4 w-4" />}
          hint="Linked & active"
        />
        <KpiCard
          accent="urgent"
          label="Urgent · pain ≥ 7"
          value={counts.attention}
          icon={<TriangleAlert className="h-4 w-4" />}
          hint="Triage these first"
        />
        <KpiCard
          accent="ok"
          label="Recent activity · 3d"
          value={counts.recent}
          hint="Logged in past 72 hours"
        />
        <KpiCard
          accent="gold"
          label="No activity · 7d"
          value={counts.inactive}
          icon={<Inbox className="h-4 w-4" />}
          hint="Consider a check-in"
        />
      </div>

      {/* Search + sort */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 stroke-[1.5] text-muted-foreground" />
          <Input
            placeholder="Search by name…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-3">
          {query.isFetching && !query.isLoading && (
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Updating…
            </span>
          )}
          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
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
      </div>

      {/* Filter pills */}
      <div className="flex flex-wrap items-center gap-2">
        <FilterPill active={bucket === 'all'} count={counts.all} onClick={() => setBucket('all')}>
          All patients
        </FilterPill>
        <FilterPill
          urgent
          active={bucket === 'attention'}
          count={counts.attention}
          onClick={() => setBucket('attention')}
        >
          Needs attention
        </FilterPill>
        <FilterPill active={bucket === 'recent'} count={counts.recent} onClick={() => setBucket('recent')}>
          Recent activity
        </FilterPill>
        <FilterPill active={bucket === 'inactive'} count={counts.inactive} onClick={() => setBucket('inactive')}>
          No activity · 7d
        </FilterPill>
      </div>

      {query.isError ? (
        <EmptyState
          title="Couldn't load patients."
          description={query.error instanceof Error ? query.error.message : 'Unknown error'}
        />
      ) : filteredRows.length === 0 && !query.isLoading ? (
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title={debouncedSearch ? 'No matches.' : "Let's add your first patient."}
          description={
            debouncedSearch
              ? 'Try a different spelling or clear the search.'
              : "Generate an invite code and your patient will connect from their mobile app."
          }
          action={
            !debouncedSearch && (
              <Button onClick={() => navigate('/linking')}>Invite your first patient</Button>
            )
          }
        />
      ) : (
        <DataTable
          columns={columns}
          rows={filteredRows}
          rowKey={(p) => p.patient_id}
          loading={query.isLoading}
          page={page}
          pageSize={LIMIT}
          total={total}
          onPageChange={setPage}
          onRowClick={(p) => navigate(`/patients/${p.patient_id}`)}
          rowClassName={(p) => ((p.avg_pain_7d ?? 0) >= 7 ? 'bg-err/5 hover:bg-err/10' : undefined)}
        />
      )}
    </div>
  );
}
