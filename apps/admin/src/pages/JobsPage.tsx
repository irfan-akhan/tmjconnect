import { useState } from 'react';
import { Table, Button, Drawer, Tooltip, Progress } from 'antd';
import {
  CheckCircleFilled, CloseCircleFilled, PauseCircleFilled,
  SyncOutlined, PlayCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import PageHeader from '../components/PageHeader';
import SectionCard from '../components/SectionCard';
import RelativeTime from '../components/RelativeTime';
import EmptyState from '../components/EmptyState';
import { useJobSummaries, useJobHistory, useTriggerJob } from '../hooks/todoQueries';
import { useToastHistory } from '../context/ToastHistoryContext';

interface JobSummary {
  job_name: string;
  schedule: string;
  last_run: {
    status: 'running' | 'success' | 'failed' | 'skipped';
    started_at: string;
    duration_ms: number | null;
    rows_affected: number | null;
    error_message: string | null;
  } | null;
  last_success_at: string | null;
  success_rate_24h: number;
  avg_duration_ms_7d: number;
}

interface JobRun {
  id: string;
  job_name: string;
  status: 'running' | 'success' | 'failed' | 'skipped';
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  rows_affected: number | null;
  error_message: string | null;
}

const statusStyle: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  running:  { color: '#3B82F6', icon: <SyncOutlined spin />, label: 'Running' },
  success:  { color: '#10B981', icon: <CheckCircleFilled />, label: 'Success' },
  failed:   { color: '#EF4444', icon: <CloseCircleFilled />, label: 'Failed' },
  skipped:  { color: '#64748B', icon: <PauseCircleFilled />, label: 'Skipped' },
};

export default function JobsPage() {
  const { push } = useToastHistory();
  const { data: jobs, isLoading } = useJobSummaries();
  const [drawerJob, setDrawerJob] = useState<string | null>(null);
  const [historyPage, setHistoryPage] = useState(1);

  const historyQ = useJobHistory(drawerJob ?? '', { page: historyPage, limit: 50 });
  const historyData = (historyQ.data?.data ?? []) as JobRun[];
  const historyMeta = historyQ.data?.meta ?? { page: 1, limit: 50, total: 0 };

  const triggerMut = useTriggerJob();
  const handleTrigger = async (name: string) => {
    try {
      await triggerMut.mutateAsync(name);
      push('success', `${name} enqueued.`);
    } catch {
      push('error', 'Failed to trigger job.');
    }
  };

  const columns: ColumnsType<JobSummary> = [
    {
      title: 'Job',
      dataIndex: 'job_name',
      key: 'job_name',
      render: (v: string) => (
        <span className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-100">{v}</span>
      ),
    },
    {
      title: 'Schedule',
      dataIndex: 'schedule',
      key: 'schedule',
      width: 140,
      render: (v: string) => (
        <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{v}</span>
      ),
    },
    {
      title: 'Last run',
      key: 'last_run',
      width: 180,
      render: (_: unknown, r: JobSummary) => {
        if (!r.last_run) return <span className="text-xs text-slate-400">Never</span>;
        const s = statusStyle[r.last_run.status];
        return (
          <div>
            <span style={{ color: s.color }} className="inline-flex items-center gap-1.5 text-xs font-semibold">
              {s.icon} {s.label}
            </span>
            <div className="mt-0.5">
              <RelativeTime value={r.last_run.started_at} />
            </div>
          </div>
        );
      },
    },
    {
      title: 'Duration',
      key: 'duration',
      width: 120,
      render: (_: unknown, r: JobSummary) =>
        r.last_run?.duration_ms != null ? (
          <span className="text-xs tabular-nums text-slate-600 dark:text-slate-300">
            {r.last_run.duration_ms}ms
          </span>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        ),
    },
    {
      title: 'Rows',
      key: 'rows',
      width: 90,
      render: (_: unknown, r: JobSummary) =>
        r.last_run?.rows_affected != null ? (
          <span className="text-xs tabular-nums">{r.last_run.rows_affected}</span>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        ),
    },
    {
      title: 'Success 24h',
      key: 'success_rate',
      width: 140,
      render: (_: unknown, r: JobSummary) => (
        <Progress
          percent={Math.round((r.success_rate_24h || 0) * 100)}
          size="small"
          strokeColor={r.success_rate_24h >= 0.9 ? '#10B981' : r.success_rate_24h >= 0.7 ? '#F59E0B' : '#EF4444'}
        />
      ),
    },
    {
      title: 'Avg 7d',
      key: 'avg_7d',
      width: 100,
      render: (_: unknown, r: JobSummary) => (
        <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
          {r.avg_duration_ms_7d}ms
        </span>
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 100,
      align: 'right',
      render: (_: unknown, r: JobSummary) => (
        <div className="flex items-center gap-1">
          <Tooltip title="Run now">
            <Button
              size="small"
              type="text"
              icon={<PlayCircleOutlined />}
              onClick={() => handleTrigger(r.job_name)}
              loading={triggerMut.isPending}
            />
          </Tooltip>
          <Button size="small" type="link" onClick={() => { setDrawerJob(r.job_name); setHistoryPage(1); }}>
            History
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Operations"
        title="Job runner health"
        subtitle="Scheduled background jobs with run history and manual triggers."
      />

      <SectionCard title="All jobs" subtitle="6 scheduled background jobs" flush>
        <Table<JobSummary>
          rowKey="job_name"
          columns={columns}
          dataSource={jobs ?? []}
          loading={isLoading}
          pagination={false}
          locale={{ emptyText: <EmptyState title="No job runs yet" description="Jobs will appear after their first execution." /> }}
        />
      </SectionCard>

      <Drawer
        open={!!drawerJob}
        onClose={() => setDrawerJob(null)}
        title={
          <div>
            <div className="font-mono text-sm font-semibold">{drawerJob}</div>
            <div className="text-xs text-slate-500">Execution history</div>
          </div>
        }
        width={620}
      >
        <Table<JobRun>
          rowKey="id"
          size="small"
          dataSource={historyData}
          loading={historyQ.isLoading}
          pagination={{
            current: historyMeta.page,
            pageSize: historyMeta.limit,
            total: historyMeta.total,
            onChange: setHistoryPage,
          }}
          columns={[
            {
              title: 'Status',
              dataIndex: 'status',
              width: 110,
              render: (v: string) => {
                const s = statusStyle[v];
                return (
                  <span style={{ color: s.color }} className="inline-flex items-center gap-1 text-xs font-semibold">
                    {s.icon} {s.label}
                  </span>
                );
              },
            },
            {
              title: 'Started',
              dataIndex: 'started_at',
              render: (v: string) => <RelativeTime value={v} />,
            },
            {
              title: 'Dur.',
              dataIndex: 'duration_ms',
              width: 80,
              render: (v: number | null) => v != null ? `${v}ms` : '—',
            },
            {
              title: 'Rows',
              dataIndex: 'rows_affected',
              width: 70,
              render: (v: number | null) => v ?? '—',
            },
          ]}
          expandable={{
            expandedRowRender: (r) =>
              r.error_message ? (
                <pre className="whitespace-pre-wrap rounded bg-rose-50 p-2 font-mono text-[11px] text-rose-700 dark:bg-rose-900/20 dark:text-rose-300">
                  {r.error_message}
                </pre>
              ) : (
                <span className="text-xs text-slate-400">No error</span>
              ),
            rowExpandable: (r) => !!r.error_message,
          }}
        />
      </Drawer>
    </div>
  );
}
