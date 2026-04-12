import { useMemo } from 'react';
import { Table, Progress, Tag, Tooltip } from 'antd';
import {
  TeamOutlined, ClockCircleOutlined, WarningOutlined, LockOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import PageHeader from '../components/PageHeader';
import SectionCard from '../components/SectionCard';
import KpiCard from '../components/KpiCard';
import RelativeTime from '../components/RelativeTime';
import EmptyState from '../components/EmptyState';
import { useProviderPerformance } from '../hooks/todoQueries';
import { useUrlFilters } from '../hooks/useUrlFilters';

interface Row {
  provider_id: string;
  name: string;
  email: string;
  patient_count: number;
  active_patients_7d: number;
  reports_received_30d: number;
  reports_responded_30d: number;
  response_rate: number | null;
  avg_response_hours: number | null;
  last_login_at: string | null;
  mfa_enabled: boolean;
}

export default function ProviderPerformancePage() {
  const defaults = useMemo(
    () => ({ sort: 'avg_response_hours', order: 'desc', page: '1', limit: '20' }),
    [],
  );
  const { filters, setFilter } = useUrlFilters(defaults);

  const { data: response, isLoading } = useProviderPerformance({
    page: Number(filters.page) || 1,
    limit: Number(filters.limit) || 20,
    sort: filters.sort || 'avg_response_hours',
    order: filters.order || 'desc',
  });

  const data = (response?.data ?? []) as Row[];
  const meta = response?.meta ?? { page: 1, limit: 20, total: 0 };

  const totalProviders = meta.total;
  const avgResponse = data.length
    ? data.filter((d) => d.avg_response_hours).reduce((s, d) => s + (d.avg_response_hours ?? 0), 0) / Math.max(1, data.filter((d) => d.avg_response_hours).length)
    : null;
  const needsAttention = data.filter((d) => !d.last_login_at || new Date(d.last_login_at) < new Date(Date.now() - 7 * 86400 * 1000)).length;

  const columns: ColumnsType<Row> = [
    {
      title: 'Provider',
      key: 'provider',
      render: (_: unknown, r: Row) => (
        <div>
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{r.name.trim() || r.email.split('@')[0]}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">{r.email}</div>
        </div>
      ),
    },
    {
      title: 'Patients',
      dataIndex: 'patient_count',
      key: 'patients',
      width: 110,
      sorter: true,
      render: (v: number, r: Row) => (
        <div>
          <div className="text-sm font-semibold tabular-nums">{v}</div>
          <div className="text-[11px] text-slate-500">{r.active_patients_7d} active 7d</div>
        </div>
      ),
    },
    {
      title: 'Reports (30d)',
      key: 'reports',
      width: 140,
      render: (_: unknown, r: Row) => (
        <div>
          <div className="text-sm font-semibold tabular-nums">
            {r.reports_responded_30d} <span className="text-slate-400 font-normal">/ {r.reports_received_30d}</span>
          </div>
          <div className="text-[11px] text-slate-500">responded / received</div>
        </div>
      ),
    },
    {
      title: 'Response rate',
      key: 'response_rate',
      width: 160,
      render: (_: unknown, r: Row) =>
        r.response_rate == null ? (
          <span className="text-xs text-slate-400">—</span>
        ) : (
          <Progress
            percent={Math.round(r.response_rate * 100)}
            size="small"
            strokeColor={r.response_rate >= 0.9 ? '#10B981' : r.response_rate >= 0.7 ? '#F59E0B' : '#EF4444'}
          />
        ),
    },
    {
      title: 'Avg response',
      dataIndex: 'avg_response_hours',
      key: 'avg_response_hours',
      width: 120,
      sorter: true,
      render: (v: number | null) =>
        v == null ? <span className="text-xs text-slate-400">—</span> : (
          <Tag color={v <= 6 ? 'green' : v <= 24 ? 'gold' : 'red'}>{v}h</Tag>
        ),
    },
    {
      title: 'Last login',
      dataIndex: 'last_login_at',
      key: 'last_login_at',
      width: 140,
      render: (v: string | null) =>
        v ? <RelativeTime value={v} /> : <span className="text-xs text-slate-400">Never</span>,
    },
    {
      title: 'MFA',
      dataIndex: 'mfa_enabled',
      key: 'mfa_enabled',
      width: 80,
      render: (v: boolean) =>
        v ? (
          <Tooltip title="MFA enabled"><LockOutlined style={{ color: '#10B981' }} /></Tooltip>
        ) : (
          <Tooltip title="MFA disabled"><WarningOutlined style={{ color: '#F59E0B' }} /></Tooltip>
        ),
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Operations"
        title="Provider performance"
        subtitle="Response times, patient loads, and engagement across all active providers."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard label="Total providers" value={totalProviders} icon={<TeamOutlined />} tone="brand" />
        <KpiCard
          label="Avg response time"
          value={avgResponse ? `${avgResponse.toFixed(1)}h` : '—'}
          icon={<ClockCircleOutlined />}
          tone={avgResponse == null || avgResponse <= 12 ? 'success' : avgResponse <= 24 ? 'warning' : 'danger'}
        />
        <KpiCard
          label="Needs attention"
          value={needsAttention}
          icon={<WarningOutlined />}
          tone={needsAttention > 0 ? 'danger' : 'success'}
          hint="Inactive > 7 days"
        />
      </div>

      <div className="mt-6">
        <SectionCard title="All providers" subtitle={`${meta.total.toLocaleString()} active provider accounts`} flush>
          <Table<Row>
            rowKey="provider_id"
            columns={columns}
            dataSource={data}
            loading={isLoading}
            sticky
            onChange={(_, __, sorter) => {
              const s = Array.isArray(sorter) ? sorter[0] : sorter;
              if (s.field) {
                setFilter('sort', String(s.field));
                setFilter('order', s.order === 'ascend' ? 'asc' : 'desc');
              }
            }}
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
            locale={{ emptyText: <EmptyState title="No providers" description="No active provider accounts." /> }}
          />
        </SectionCard>
      </div>
    </div>
  );
}
