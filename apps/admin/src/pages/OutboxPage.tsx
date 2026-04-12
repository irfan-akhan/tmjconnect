import { useState, useMemo } from 'react';
import { Table, Tag, Button, Tooltip, Select, Popconfirm } from 'antd';
import {
  MailOutlined,
  SendOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  ReloadOutlined,
  DeleteOutlined,
  InboxOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
} from 'recharts';
import dayjs from 'dayjs';
import PageHeader from '../components/PageHeader';
import SectionCard from '../components/SectionCard';
import KpiCard from '../components/KpiCard';
import RelativeTime from '../components/RelativeTime';
import CopyableId from '../components/CopyableId';
import EmptyState from '../components/EmptyState';
import {
  useOutboxStats, useOutboxDlq, useOutboxPending,
  useRetryOutbox, useDropOutbox,
} from '../hooks/todoQueries';
import { useUrlFilters } from '../hooks/useUrlFilters';
import { useToastHistory } from '../context/ToastHistoryContext';
import { useThemeMode } from '../context/ThemeContext';
import { colors } from '../theme/tokens';

interface OutboxRow {
  id: string;
  user_id: string;
  channel: 'email' | 'sms' | 'push';
  type: string;
  attempts: number;
  max_attempts: number;
  next_attempt_at: string;
  last_error: string | null;
  created_at: string;
}

interface OutboxStats {
  pending: number;
  dlq: number;
  sent_24h: number;
  failed_24h: number;
  by_channel: Record<string, { pending: number; sent_24h: number; dlq: number }>;
  hourly_volume: Array<{ hour: string; sent: number; failed: number }>;
}

export default function OutboxPage() {
  const { push } = useToastHistory();
  const { mode } = useThemeMode();
  const isDark = mode === 'dark';

  const defaults = useMemo(
    () => ({ tab: 'pending', channel: '', page: '1', limit: '20' }),
    [],
  );
  const { filters, setFilter } = useUrlFilters(defaults);

  const statsQ = useOutboxStats();
  const stats = (statsQ.data ?? null) as OutboxStats | null;

  const params = {
    page: Number(filters.page) || 1,
    limit: Number(filters.limit) || 20,
    channel: filters.channel || undefined,
  };

  const pendingQ = useOutboxPending(params);
  const dlqQ = useOutboxDlq(params);

  const activeQuery = filters.tab === 'dlq' ? dlqQ : pendingQ;
  const data = (activeQuery.data?.data ?? []) as OutboxRow[];
  const meta = activeQuery.data?.meta ?? { page: 1, limit: 20, total: 0 };

  const retryMut = useRetryOutbox();
  const dropMut = useDropOutbox();

  const handleRetry = async (id: string) => {
    try {
      await retryMut.mutateAsync(id);
      push('success', 'Entry queued for retry.');
    } catch {
      push('error', 'Retry failed.');
    }
  };

  const handleDrop = async (id: string) => {
    try {
      await dropMut.mutateAsync(id);
      push('success', 'Entry dropped.');
    } catch {
      push('error', 'Drop failed.');
    }
  };

  const channelColor: Record<string, string> = {
    email: '#3B82F6', sms: '#F59E0B', push: '#8B5CF6',
  };

  const [activeTab, setActiveTab] = useState<'pending' | 'dlq'>(filters.tab === 'dlq' ? 'dlq' : 'pending');

  const columns: ColumnsType<OutboxRow> = [
    {
      title: 'Created',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (v: string) => <RelativeTime value={v} />,
    },
    {
      title: 'Channel',
      dataIndex: 'channel',
      key: 'channel',
      width: 110,
      render: (v: string) => (
        <Tag color={channelColor[v] ?? 'default'} style={{ textTransform: 'uppercase', fontWeight: 600 }}>
          {v}
        </Tag>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      width: 200,
      render: (v: string) => (
        <span className="font-mono text-xs text-slate-700 dark:text-slate-200">{v}</span>
      ),
    },
    {
      title: 'User',
      dataIndex: 'user_id',
      key: 'user_id',
      width: 120,
      render: (v: string) => <CopyableId value={v} />,
    },
    {
      title: 'Attempts',
      key: 'attempts',
      width: 110,
      render: (_: unknown, r: OutboxRow) => (
        <span className="text-xs">
          {r.attempts} / {r.max_attempts}
        </span>
      ),
    },
    {
      title: 'Next retry',
      dataIndex: 'next_attempt_at',
      key: 'next_attempt_at',
      width: 140,
      render: (v: string, r: OutboxRow) =>
        r.attempts >= r.max_attempts ? (
          <span className="text-xs text-rose-500">—</span>
        ) : (
          <RelativeTime value={v} />
        ),
    },
    {
      title: 'Error',
      dataIndex: 'last_error',
      key: 'last_error',
      ellipsis: true,
      render: (v: string | null) =>
        v ? (
          <Tooltip title={v}>
            <span className="font-mono text-xs text-rose-600">{v}</span>
          </Tooltip>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        ),
    },
    {
      title: '',
      key: 'actions',
      width: 110,
      align: 'right',
      render: (_: unknown, r: OutboxRow) => (
        <div className="flex items-center gap-1">
          <Tooltip title="Retry now">
            <Button
              size="small"
              type="text"
              icon={<ReloadOutlined />}
              onClick={() => handleRetry(r.id)}
              loading={retryMut.isPending}
            />
          </Tooltip>
          <Popconfirm
            title="Drop this entry?"
            description="This permanently removes the row. It cannot be recovered."
            onConfirm={() => handleDrop(r.id)}
          >
            <Button
              size="small"
              type="text"
              danger
              icon={<DeleteOutlined />}
              loading={dropMut.isPending}
            />
          </Popconfirm>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Operations"
        title="Notification outbox"
        subtitle="Queue health for email, SMS, and push dispatch. Inspect and retry failed messages."
      />

      {/* ─── KPI grid ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Pending"
          value={statsQ.isLoading ? '—' : stats?.pending ?? 0}
          icon={<InboxOutlined />}
          tone="info"
          hint="Awaiting dispatch"
        />
        <KpiCard
          label="Sent today"
          value={statsQ.isLoading ? '—' : stats?.sent_24h ?? 0}
          icon={<CheckCircleOutlined />}
          tone="success"
          hint="Last 24 hours"
        />
        <KpiCard
          label="Failed today"
          value={statsQ.isLoading ? '—' : stats?.failed_24h ?? 0}
          icon={<WarningOutlined />}
          tone="warning"
          hint="Exhausted retries"
        />
        <KpiCard
          label="Dead-letter queue"
          value={statsQ.isLoading ? '—' : stats?.dlq ?? 0}
          icon={<MailOutlined />}
          tone="danger"
          hint="Requires manual action"
        />
      </div>

      {/* ─── Channel breakdown ───────────────────────────────────────── */}
      {stats && (
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {(['email', 'sms', 'push'] as const).map((ch) => {
            const c = stats.by_channel[ch] ?? { pending: 0, sent_24h: 0, dlq: 0 };
            return (
              <SectionCard key={ch} title={ch.toUpperCase()} subtitle="Channel breakdown">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Pending</div>
                    <div className="mt-0.5 text-xl font-semibold text-slate-900 dark:text-slate-100">{c.pending}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Sent 24h</div>
                    <div className="mt-0.5 text-xl font-semibold text-emerald-600">{c.sent_24h}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">DLQ</div>
                    <div className="mt-0.5 text-xl font-semibold text-rose-600">{c.dlq}</div>
                  </div>
                </div>
              </SectionCard>
            );
          })}
        </div>
      )}

      {/* ─── Hourly volume chart ─────────────────────────────────────── */}
      {stats && stats.hourly_volume.length > 0 && (
        <div className="mt-6">
          <SectionCard title="Hourly volume (last 24h)" subtitle="Sent vs. failed per hour">
            <div style={{ height: 200 }}>
              <ResponsiveContainer>
                <AreaChart data={stats.hourly_volume.map((h) => ({
                  hour: dayjs(h.hour).format('HH:mm'),
                  sent: h.sent,
                  failed: h.failed,
                }))}>
                  <defs>
                    <linearGradient id="sentGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={colors.success.base} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={colors.success.base} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="failedGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={colors.danger.base} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={colors.danger.base} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={isDark ? 'rgba(255,255,255,0.04)' : colors.slate[100]} vertical={false} />
                  <XAxis dataKey="hour" stroke={isDark ? '#475569' : colors.slate[400]} tick={{ fontSize: 11 }} />
                  <YAxis stroke={isDark ? '#475569' : colors.slate[400]} tick={{ fontSize: 11 }} />
                  <RechartsTooltip
                    contentStyle={{
                      background: isDark ? '#1E293B' : '#fff',
                      border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : colors.slate[200]}`,
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Area type="monotone" dataKey="sent" stroke={colors.success.base} fill="url(#sentGrad)" />
                  <Area type="monotone" dataKey="failed" stroke={colors.danger.base} fill="url(#failedGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>
        </div>
      )}

      {/* ─── Tabs: pending vs DLQ ───────────────────────────────────── */}
      <div className="mt-6">
        <SectionCard
          title={activeTab === 'pending' ? 'Pending retries' : 'Dead-letter queue'}
          subtitle={`${meta.total.toLocaleString()} entries`}
          extra={
            <div className="flex items-center gap-2">
              <Select
                size="small"
                placeholder="All channels"
                allowClear
                style={{ width: 140 }}
                value={filters.channel || undefined}
                onChange={(v) => setFilter('channel', v ?? '')}
                options={[
                  { value: 'email', label: 'Email' },
                  { value: 'sms', label: 'SMS' },
                  { value: 'push', label: 'Push' },
                ]}
              />
              <Button.Group>
                <Button
                  size="small"
                  type={activeTab === 'pending' ? 'primary' : 'default'}
                  icon={<SendOutlined />}
                  onClick={() => { setActiveTab('pending'); setFilter('tab', 'pending'); }}
                >
                  Pending ({stats?.pending ?? 0})
                </Button>
                <Button
                  size="small"
                  type={activeTab === 'dlq' ? 'primary' : 'default'}
                  danger={activeTab === 'dlq'}
                  icon={<WarningOutlined />}
                  onClick={() => { setActiveTab('dlq'); setFilter('tab', 'dlq'); }}
                >
                  DLQ ({stats?.dlq ?? 0})
                </Button>
              </Button.Group>
            </div>
          }
          flush
        >
          <Table<OutboxRow>
            rowKey="id"
            columns={columns}
            dataSource={data}
            loading={activeQuery.isLoading}
            sticky
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
            locale={{
              emptyText: (
                <EmptyState
                  title={activeTab === 'dlq' ? 'No failed entries' : 'No pending entries'}
                  description={
                    activeTab === 'dlq'
                      ? 'All messages are being delivered successfully.'
                      : 'The outbox drain job catches everything in real-time.'
                  }
                />
              ),
            }}
          />
        </SectionCard>
      </div>
    </div>
  );
}
