import { Progress, Tag } from 'antd';
import {
  ApiOutlined, DatabaseOutlined, ThunderboltOutlined,
  ClockCircleOutlined, ForkOutlined,
} from '@ant-design/icons';
import PageHeader from '../components/PageHeader';
import SectionCard from '../components/SectionCard';
import KpiCard from '../components/KpiCard';
import { useSystemMetrics } from '../hooks/todoQueries';

interface Metrics {
  api: {
    uptime_seconds: number;
    memory: { rss_mb: number; heap_used_mb: number; heap_total_mb: number };
    cpu_load_1m: number;
    pid: number;
    node_version: string;
  };
  db: {
    pool_total: number;
    pool_idle: number;
    pool_waiting: number;
  };
  circuit_breakers?: Record<string, { state: string; failure_count: number; last_failure_at: string | null }>;
}

function formatUptime(s: number): string {
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const mins = Math.floor((s % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export default function SystemMetricsPage() {
  const { data, isLoading, refetch } = useSystemMetrics();
  const m = (data as Metrics) ?? null;

  const heapPercent = m ? Math.round((m.api.memory.heap_used_mb / m.api.memory.heap_total_mb) * 100) : 0;
  const poolInUse = m ? m.db.pool_total - m.db.pool_idle : 0;

  return (
    <div>
      <PageHeader
        eyebrow="Operations"
        title="System metrics"
        subtitle="Real-time API and database observability."
        actions={
          <button
            onClick={() => refetch()}
            className="text-xs font-medium text-brand-600 hover:underline"
          >
            Refresh
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Uptime"
          value={isLoading ? '—' : formatUptime(m?.api.uptime_seconds ?? 0)}
          icon={<ClockCircleOutlined />}
          tone="success"
        />
        <KpiCard
          label="CPU load (1m)"
          value={isLoading ? '—' : (m?.api.cpu_load_1m ?? 0).toFixed(2)}
          icon={<ThunderboltOutlined />}
          tone={(m?.api.cpu_load_1m ?? 0) > 2 ? 'danger' : (m?.api.cpu_load_1m ?? 0) > 1 ? 'warning' : 'success'}
        />
        <KpiCard
          label="Memory"
          value={isLoading ? '—' : `${m?.api.memory.rss_mb ?? 0} MB`}
          icon={<ApiOutlined />}
          tone="info"
          hint={`Heap ${m?.api.memory.heap_used_mb}/${m?.api.memory.heap_total_mb} MB`}
        />
        <KpiCard
          label="DB pool (in use)"
          value={isLoading ? '—' : poolInUse}
          icon={<DatabaseOutlined />}
          tone={m && m.db.pool_waiting > 0 ? 'danger' : 'success'}
          hint={m ? `${m.db.pool_waiting} waiting` : ''}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionCard title="API process" subtitle="Runtime details">
          {m && (
            <div className="flex flex-col gap-3">
              <MetricRow label="PID" value={m.api.pid} />
              <MetricRow label="Node version" value={m.api.node_version} />
              <MetricRow label="Uptime" value={formatUptime(m.api.uptime_seconds)} />
              <div>
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Heap usage</div>
                <Progress
                  percent={heapPercent}
                  size="small"
                  strokeColor={heapPercent > 85 ? '#EF4444' : heapPercent > 70 ? '#F59E0B' : '#10B981'}
                />
                <div className="mt-1 text-xs text-slate-500">
                  {m.api.memory.heap_used_mb} MB / {m.api.memory.heap_total_mb} MB (RSS {m.api.memory.rss_mb} MB)
                </div>
              </div>
            </div>
          )}
        </SectionCard>

        <SectionCard title="Database pool" subtitle="Connection pool state">
          {m && (
            <div className="flex flex-col gap-3">
              <MetricRow label="Total" value={m.db.pool_total} />
              <MetricRow label="Idle" value={m.db.pool_idle} />
              <MetricRow label="In use" value={poolInUse} />
              <MetricRow
                label="Waiting"
                value={
                  <span className={m.db.pool_waiting > 0 ? 'font-semibold text-rose-600' : ''}>
                    {m.db.pool_waiting}
                  </span>
                }
              />
            </div>
          )}
        </SectionCard>
      </div>

      {m?.circuit_breakers && (
        <div className="mt-6">
          <SectionCard title="Circuit breakers" subtitle="External service health">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {Object.entries(m.circuit_breakers).map(([name, cb]) => (
                <div
                  key={name}
                  className="rounded-md border border-slate-100 p-3 dark:border-white/[0.06]"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold uppercase">{name}</div>
                    <Tag color={cb.state === 'closed' ? 'green' : cb.state === 'half_open' ? 'gold' : 'red'}>
                      <ForkOutlined /> {cb.state}
                    </Tag>
                  </div>
                  <div className="mt-2 text-xs text-slate-500">Failures: {cb.failure_count}</div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      )}
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-100">{value}</span>
    </div>
  );
}
