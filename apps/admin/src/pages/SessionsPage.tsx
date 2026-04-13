import { useMemo } from 'react';
import { Table, Button, Select, Tooltip, Popconfirm } from 'antd';
import {
  TeamOutlined, UserOutlined, LockOutlined, DisconnectOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import PageHeader from '../components/PageHeader';
import SectionCard from '../components/SectionCard';
import KpiCard from '../components/KpiCard';
import RelativeTime from '../components/RelativeTime';
import CopyableId from '../components/CopyableId';
import EmptyState from '../components/EmptyState';
import { useActiveSessions, useTerminateSession } from '../hooks/todoQueries';
import { useUrlFilters } from '../hooks/useUrlFilters';
import { useToastHistory } from '../context/ToastHistoryContext';
import { roleColors } from '../theme/tokens';

interface SessionRow {
  id: string;
  user_id: string;
  user_email: string;
  user_role: 'patient' | 'provider' | 'admin';
  ip_address: string | null;
  device_info: string | null;
  last_active: string;
  created_at: string;
}

interface Summary {
  total_active: number;
  by_role: { patient: number; provider: number; admin: number };
}

export default function SessionsPage() {
  const { push } = useToastHistory();

  const defaults = useMemo(
    () => ({ role: '', page: '1', limit: '50' }),
    [],
  );
  const { filters, setFilter } = useUrlFilters(defaults);

  const params = {
    page: Number(filters.page) || 1,
    limit: Number(filters.limit) || 50,
    role: filters.role || undefined,
  };

  const { data: response, isLoading } = useActiveSessions(params);
  const data = (response?.data ?? []) as SessionRow[];
  const meta = response?.meta ?? { page: 1, limit: 50, total: 0 };
  const summary: Summary = response?.summary ?? { total_active: 0, by_role: { patient: 0, provider: 0, admin: 0 } };

  const terminateMut = useTerminateSession();
  const handleTerminate = async (id: string) => {
    try {
      await terminateMut.mutateAsync(id);
      push('success', 'Session terminated.');
    } catch {
      push('error', 'Failed to terminate session.');
    }
  };

  const columns: ColumnsType<SessionRow> = [
    {
      title: 'User',
      dataIndex: 'user_email',
      key: 'user',
      render: (v: string, r: SessionRow) => (
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{v}</div>
          <CopyableId value={r.user_id} />
        </div>
      ),
    },
    {
      title: 'Role',
      dataIndex: 'user_role',
      key: 'role',
      width: 120,
      render: (role: SessionRow['user_role']) => {
        const c = roleColors[role];
        return (
          <span
            className="inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider"
            style={{ background: c.bg, color: c.text, borderColor: c.border }}
          >
            {role}
          </span>
        );
      },
    },
    {
      title: 'Device',
      dataIndex: 'device_info',
      key: 'device',
      ellipsis: true,
      render: (v: string | null) =>
        v ? <span className="text-xs text-slate-500 dark:text-slate-400">{v}</span> : <span className="text-xs text-slate-400">—</span>,
    },
    {
      title: 'IP',
      dataIndex: 'ip_address',
      key: 'ip',
      width: 140,
      render: (v: string | null) =>
        v ? <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{v}</span> : <span className="text-xs text-slate-400">—</span>,
    },
    {
      title: 'Last active',
      dataIndex: 'last_active',
      key: 'last_active',
      width: 140,
      render: (v: string) => <RelativeTime value={v} />,
    },
    {
      title: 'Started',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 140,
      render: (v: string) => <RelativeTime value={v} />,
    },
    {
      title: '',
      key: 'actions',
      width: 80,
      align: 'right',
      render: (_: unknown, r: SessionRow) => (
        <Popconfirm
          title="Force logout?"
          description="The user will be signed out on their next request."
          onConfirm={() => handleTerminate(r.id)}
        >
          <Tooltip title="Force logout">
            <Button size="small" type="text" danger icon={<DisconnectOutlined />} />
          </Tooltip>
        </Popconfirm>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Security"
        title="Active sessions"
        subtitle="Live view of logged-in users. Force-logout suspicious sessions."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          label="Active (15 min window)"
          value={summary.total_active}
          icon={<TeamOutlined />}
          tone="brand"
          hint="Users active in last 15 minutes"
        />
        <KpiCard
          label="Providers online"
          value={summary.by_role.provider}
          icon={<UserOutlined />}
          tone="success"
        />
        <KpiCard
          label="Admins online"
          value={summary.by_role.admin}
          icon={<LockOutlined />}
          tone="danger"
        />
      </div>

      <div className="mt-6">
        <SectionCard
          title="All active sessions"
          subtitle={`${meta.total.toLocaleString()} open sessions`}
          extra={
            <Select
              size="small"
              allowClear
              placeholder="All roles"
              style={{ width: 140 }}
              value={filters.role || undefined}
              onChange={(v) => setFilter('role', v ?? '')}
              options={[
                { value: 'patient', label: 'Patient' },
                { value: 'provider', label: 'Provider' },
                { value: 'admin', label: 'Admin' },
              ]}
            />
          }
          flush
        >
          <Table<SessionRow>
            rowKey="id"
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
            locale={{ emptyText: <EmptyState title="No active sessions" description="Nobody's online right now." /> }}
          />
        </SectionCard>
      </div>
    </div>
  );
}
