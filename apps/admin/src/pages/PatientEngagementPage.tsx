import { useMemo } from 'react';
import { Table, Tag, Progress } from 'antd';
import { FireOutlined, ClockCircleOutlined, MoonOutlined, MinusCircleOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import PageHeader from '../components/PageHeader';
import SectionCard from '../components/SectionCard';
import KpiCard from '../components/KpiCard';
import RelativeTime from '../components/RelativeTime';
import EmptyState from '../components/EmptyState';
import { usePatientEngagement } from '../hooks/todoQueries';
import { useUrlFilters } from '../hooks/useUrlFilters';

interface Row {
  patient_id: string;
  name: string;
  email: string;
  created_at: string;
  last_symptom_log_at: string | null;
  last_login_at: string | null;
  symptom_streak_days: number;
  exercise_completion_rate_30d: number;
  tier: 'highly_active' | 'occasional' | 'dormant' | 'never_active';
}

const tierStyle: Record<Row['tier'], { label: string; color: string }> = {
  highly_active: { label: 'Highly active', color: 'green' },
  occasional:    { label: 'Occasional',    color: 'gold' },
  dormant:       { label: 'Dormant',       color: 'orange' },
  never_active:  { label: 'Never active',  color: 'red' },
};

export default function PatientEngagementPage() {
  const defaults = useMemo(
    () => ({ tier: '', page: '1', limit: '20' }),
    [],
  );
  const { filters, setFilter } = useUrlFilters(defaults);

  const { data: response, isLoading } = usePatientEngagement({
    page: Number(filters.page) || 1,
    limit: Number(filters.limit) || 20,
    tier: filters.tier || undefined,
  });

  const data = (response?.data ?? []) as Row[];
  const meta = response?.meta ?? { page: 1, limit: 20, total: 0 };
  const summary = response?.summary ?? { highly_active: 0, occasional: 0, dormant: 0, never_active: 0 };

  const columns: ColumnsType<Row> = [
    {
      title: 'Patient',
      key: 'patient',
      render: (_: unknown, r: Row) => (
        <div>
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{r.name.trim() || r.email.split('@')[0]}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">{r.email}</div>
        </div>
      ),
    },
    {
      title: 'Tier',
      dataIndex: 'tier',
      key: 'tier',
      width: 140,
      render: (v: Row['tier']) => {
        const s = tierStyle[v];
        return <Tag color={s.color}>{s.label}</Tag>;
      },
    },
    {
      title: 'Last symptom',
      dataIndex: 'last_symptom_log_at',
      key: 'last_symptom',
      width: 140,
      render: (v: string | null) =>
        v ? <RelativeTime value={v} /> : <span className="text-xs text-slate-400">Never</span>,
    },
    {
      title: 'Last login',
      dataIndex: 'last_login_at',
      key: 'last_login',
      width: 140,
      render: (v: string | null) =>
        v ? <RelativeTime value={v} /> : <span className="text-xs text-slate-400">Never</span>,
    },
    {
      title: 'Symptom streak',
      dataIndex: 'symptom_streak_days',
      key: 'streak',
      width: 130,
      render: (v: number) => (
        <span className="inline-flex items-center gap-1 text-xs tabular-nums">
          <FireOutlined style={{ color: v > 0 ? '#F59E0B' : '#CBD5E1' }} /> {v} day{v === 1 ? '' : 's'}
        </span>
      ),
    },
    {
      title: 'Exercise completion 30d',
      dataIndex: 'exercise_completion_rate_30d',
      key: 'exercise',
      width: 170,
      render: (v: number) => (
        <Progress
          percent={Math.round(v * 100)}
          size="small"
          strokeColor={v >= 0.7 ? '#10B981' : v >= 0.3 ? '#F59E0B' : '#EF4444'}
        />
      ),
    },
    {
      title: 'Joined',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 130,
      render: (v: string) => <RelativeTime value={v} />,
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Operations"
        title="Patient engagement"
        subtitle="Who's active, who's drifting, and who never got started."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div onClick={() => setFilter('tier', 'highly_active')} className="cursor-pointer">
          <KpiCard label="Highly active" value={summary.highly_active} icon={<FireOutlined />} tone="success" hint="7-day activity" />
        </div>
        <div onClick={() => setFilter('tier', 'occasional')} className="cursor-pointer">
          <KpiCard label="Occasional" value={summary.occasional} icon={<ClockCircleOutlined />} tone="warning" hint="30-day activity" />
        </div>
        <div onClick={() => setFilter('tier', 'dormant')} className="cursor-pointer">
          <KpiCard label="Dormant" value={summary.dormant} icon={<MoonOutlined />} tone="danger" hint="> 30 days inactive" />
        </div>
        <div onClick={() => setFilter('tier', 'never_active')} className="cursor-pointer">
          <KpiCard label="Never active" value={summary.never_active} icon={<MinusCircleOutlined />} tone="danger" hint="Never logged a symptom" />
        </div>
      </div>

      <div className="mt-6">
        <SectionCard
          title={filters.tier ? `${tierStyle[filters.tier as Row['tier']]?.label ?? ''} patients` : 'All patients'}
          subtitle={`${meta.total.toLocaleString()} ${filters.tier ? 'matching' : 'total'}`}
          extra={filters.tier ? <button onClick={() => setFilter('tier', '')} className="text-xs text-brand-600 hover:underline">Clear filter</button> : null}
          flush
        >
          <Table<Row>
            rowKey="patient_id"
            columns={columns}
            dataSource={data}
            loading={isLoading}
            sticky
            scroll={{ x: 'max-content' }}
            pagination={{
              current: meta.page,
              pageSize: meta.limit,
              total: meta.total,
              showSizeChanger: true,
              onChange: (page, limit) => {
                setFilter('page', String(page));
                setFilter('limit', String(limit));
              },
              style: { padding: '16px 20px', margin: 0 },
            }}
            locale={{ emptyText: <EmptyState title="No matching patients" /> }}
          />
        </SectionCard>
      </div>
    </div>
  );
}
