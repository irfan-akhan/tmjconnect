import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  Table,
  Input,
  Select,
  Tag,
  Button,
  Space,
  DatePicker,
  Avatar,
  Tooltip,
  Dropdown,
} from 'antd';
import {
  SearchOutlined,
  EyeOutlined,
  StopOutlined,
  CheckCircleOutlined,
  UserAddOutlined,
  DownloadOutlined,
  SyncOutlined,
  DownOutlined,
} from '@ant-design/icons';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import dayjs from 'dayjs';
import api from '../config/api';
import PageHeader from '../components/PageHeader';
import SectionCard from '../components/SectionCard';
import RelativeTime from '../components/RelativeTime';
import CopyableId from '../components/CopyableId';
import EmptyState from '../components/EmptyState';
import ConfirmActionModal from '../components/ConfirmActionModal';
import { roleColors } from '../theme/tokens';
import { useAdminUsers, queryKeys } from '../hooks/queries';
import { useUrlFilters } from '../hooks/useUrlFilters';
import { downloadCsv, type CsvColumn } from '../utils/csv';
import { useToastHistory } from '../context/ToastHistoryContext';
import { usePreferences } from '../context/PreferencesContext';

interface User {
  id: string;
  email: string;
  role: 'patient' | 'provider' | 'admin';
  is_active: boolean;
  email_verified: boolean;
  mfa_enabled: boolean;
  created_at: string;
  first_name?: string | null;
  last_name?: string | null;
}

function RoleTag({ role }: { role: User['role'] }) {
  const c = roleColors[role];
  return (
    <span
      className="inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider"
      style={{ background: c.bg, color: c.text, borderColor: c.border }}
    >
      {role}
    </span>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-slate-300'}`} />
      <span className={`text-xs font-medium ${active ? 'text-emerald-700' : 'text-slate-500'}`}>
        {active ? 'Active' : 'Inactive'}
      </span>
    </span>
  );
}

interface ConfirmState {
  user: User;
  nextActive: boolean;
}

export default function UsersPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { push } = useToastHistory();
  const { density, readOnly } = usePreferences();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [liveRefresh, setLiveRefresh] = useState(false);

  // ─── URL-synced filters ───────────────────────────────────────────────
  const defaults = useMemo(
    () => ({ search: '', role: '', status: '', from: '', to: '', page: '1', limit: '20' }),
    [],
  );
  const { filters, setFilter, reset: resetFilters, commit: commitFilters } = useUrlFilters(defaults);

  const dateRange: [dayjs.Dayjs | null, dayjs.Dayjs | null] | null =
    filters.from || filters.to
      ? [filters.from ? dayjs(filters.from) : null, filters.to ? dayjs(filters.to) : null]
      : null;

  // ─── Build query params from URL filters ──────────────────────────────
  const queryParams = useMemo(() => {
    const params: Record<string, string | number | boolean> = {
      page: Number(filters.page) || 1,
      limit: Number(filters.limit) || 20,
    };
    if (filters.search) params.search = filters.search;
    if (filters.role) params.role = filters.role;
    if (filters.status) params.is_active = filters.status === 'active';
    if (filters.from) params.from = filters.from;
    if (filters.to) params.to = filters.to;
    return params;
  }, [filters.search, filters.role, filters.status, filters.from, filters.to, filters.page, filters.limit]);

  // ─── React Query ──────────────────────────────────────────────────────
  const { data: queryData, isLoading, isError } = useAdminUsers(queryParams, {
    refetchInterval: liveRefresh ? 30_000 : false,
  });

  if (isError) {
    // Surface error once via toast — React Query will retry in the background.
    // We don't block rendering; stale data (if any) is still shown via keepPreviousData.
  }

  const data = queryData?.data ?? [];
  const meta = queryData?.meta ?? { page: 1, limit: 20, total: 0, hasMore: false };

  const pagination = {
    current: meta.page,
    pageSize: meta.limit,
    total: meta.total,
  };

  /** Build the CSV row set — used by both "Export CSV" and "Export selected". */
  const buildCsvColumns = (): CsvColumn<User>[] => [
    { header: 'Name', accessor: (u) => `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() || u.email.split('@')[0] },
    { header: 'Email', accessor: (u) => u.email },
    { header: 'Role', accessor: (u) => u.role },
    { header: 'Status', accessor: (u) => (u.is_active ? 'Active' : 'Inactive') },
    { header: 'Email verified', accessor: (u) => (u.email_verified ? 'Yes' : 'No') },
    { header: 'MFA enabled', accessor: (u) => (u.mfa_enabled ? 'Yes' : 'No') },
    { header: 'Created at', accessor: (u) => dayjs(u.created_at).format('YYYY-MM-DD HH:mm:ss') },
    { header: 'User ID', accessor: (u) => u.id },
  ];

  const exportCsv = () => {
    downloadCsv(`users-${dayjs().format('YYYYMMDD-HHmmss')}`, data, buildCsvColumns());
    push('success', `Exported ${data.length} users.`);
  };

  const exportSelected = () => {
    const rows = data.filter((u) => selectedRowKeys.includes(u.id));
    if (rows.length === 0) {
      push('warning', 'No users selected.');
      return;
    }
    downloadCsv(`users-selected-${dayjs().format('YYYYMMDD-HHmmss')}`, rows, buildCsvColumns());
    push('success', `Exported ${rows.length} selected users.`);
  };

  const handleTableChange = (pag: TablePaginationConfig) => {
    setFilter('page', String(pag.current ?? 1));
    setFilter('limit', String(pag.pageSize ?? 20));
  };

  const initials = (u: User) => {
    if (u.first_name || u.last_name) {
      return `${u.first_name?.[0] ?? ''}${u.last_name?.[0] ?? ''}`.toUpperCase() || u.email[0].toUpperCase();
    }
    return u.email.slice(0, 2).toUpperCase();
  };

  /**
   * Apply the deactivation/activation after the diff modal confirms.
   *
   * Optimistic — we flip the row in the query cache immediately so the UI
   * feels snappy on flaky connections, then roll back if the PATCH rejects.
   */
  const applyToggle = async () => {
    if (!confirm) return;
    const target = confirm.user;
    const next = confirm.nextActive;

    // Snapshot the current cache for rollback.
    const qk = queryKeys.users(queryParams);
    const previous = queryClient.getQueryData(qk);

    // Optimistically update the cache.
    queryClient.setQueryData(qk, (old: typeof queryData) => {
      if (!old) return old;
      return {
        ...old,
        data: old.data.map((u: User) =>
          u.id === target.id ? { ...u, is_active: next } : u,
        ),
      };
    });
    setConfirm(null);

    try {
      await api.patch(`/admin/users/${target.id}`, { is_active: next });
      push('success', `User ${next ? 'activated' : 'deactivated'}.`);
    } catch {
      // Roll back the optimistic flip.
      queryClient.setQueryData(qk, previous);
      push('error', 'Failed to update user.');
    }
  };

  const filtersActive = !!(
    filters.search || filters.role || filters.status || filters.from || filters.to
  );

  const columns: ColumnsType<User> = [
    {
      title: 'User',
      dataIndex: 'email',
      key: 'email',
      render: (_: unknown, r: User) => (
        <div className="flex items-center gap-3">
          <Avatar
            size={36}
            style={{
              background: r.role === 'admin' ? '#FEE2E2' : r.role === 'provider' ? '#CCFBF1' : '#DBEAFE',
              color: r.role === 'admin' ? '#B91C1C' : r.role === 'provider' ? '#0F766E' : '#1D4ED8',
              fontWeight: 600,
              fontSize: 12,
            }}
          >
            {initials(r)}
          </Avatar>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
              {r.first_name || r.last_name ? `${r.first_name ?? ''} ${r.last_name ?? ''}`.trim() : r.email.split('@')[0]}
            </div>
            <div className="truncate text-xs text-slate-500 dark:text-slate-400">{r.email}</div>
          </div>
        </div>
      ),
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      width: 110,
      render: (role: User['role']) => <RoleTag role={role} />,
    },
    {
      title: 'Status',
      key: 'status',
      width: 110,
      render: (_: unknown, record: User) => <StatusBadge active={record.is_active} />,
    },
    {
      title: 'MFA',
      dataIndex: 'mfa_enabled',
      key: 'mfa',
      width: 80,
      render: (v: boolean) =>
        v ? (
          <Tag style={{ background: '#F0FDFA', color: '#0F766E', border: '1px solid #99F6E4', fontWeight: 600 }}>
            Enabled
          </Tag>
        ) : (
          <Tag style={{ background: '#F1F5F9', color: '#64748B', border: '1px solid #E2E8F0' }}>
            Off
          </Tag>
        ),
    },
    {
      title: 'Joined',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      render: (v: string) => <RelativeTime value={v} />,
    },
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 110,
      render: (v: string) => <CopyableId value={v} />,
    },
    {
      title: '',
      key: 'actions',
      width: 110,
      align: 'right',
      render: (_: unknown, record: User) => (
        <Space>
          <Tooltip title="View details">
            <Button
              size="small"
              type="text"
              icon={<EyeOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/users/${record.id}`);
              }}
            />
          </Tooltip>
          <Tooltip title={readOnly ? 'Read-only mode' : record.is_active ? 'Deactivate' : 'Activate'}>
            <Button
              size="small"
              type="text"
              danger={record.is_active}
              disabled={readOnly}
              icon={record.is_active ? <StopOutlined /> : <CheckCircleOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                setConfirm({ user: record, nextActive: !record.is_active });
              }}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Management"
        title="Users"
        subtitle="Manage patients, providers, and admin accounts."
        actions={
          <>
            <Tooltip title={liveRefresh ? 'Auto-refresh ON · 30s' : 'Enable auto-refresh'}>
              <Button
                icon={
                  <SyncOutlined
                    spin={liveRefresh}
                    style={{ color: liveRefresh ? '#0D9488' : undefined }}
                  />
                }
                onClick={() => setLiveRefresh((v) => !v)}
              >
                Live
              </Button>
            </Tooltip>
            <Dropdown
              menu={{
                items: [
                  { key: 'all', label: `Export view (${data.length})`, onClick: exportCsv },
                  {
                    key: 'sel',
                    label: `Export selected (${selectedRowKeys.length})`,
                    disabled: selectedRowKeys.length === 0,
                    onClick: exportSelected,
                  },
                ],
              }}
            >
              <Button icon={<DownloadOutlined />} disabled={data.length === 0}>
                Export <DownOutlined />
              </Button>
            </Dropdown>
            <Button type="primary" icon={<UserAddOutlined />} disabled>
              Invite admin
            </Button>
          </>
        }
      />

      <SectionCard
        title="All accounts"
        subtitle={`${pagination.total.toLocaleString()} total${
          selectedRowKeys.length > 0 ? ` · ${selectedRowKeys.length} selected` : ''
        }`}
        flush
      >
        {/* Filter bar — wrapping in <form> means Enter from any field submits. */}
        <form
          className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-4 dark:border-white/[0.06]"
          onSubmit={(e) => {
            e.preventDefault();
            commitFilters();
            setFilter('page', '1');
          }}
        >
          <Input
            prefix={<SearchOutlined className="text-slate-400" />}
            placeholder="Search by name or email"
            value={filters.search}
            onChange={(e) => setFilter('search', e.target.value)}
            allowClear
            className="w-full sm:!w-[280px]"
          />
          <Select
            placeholder="Role"
            allowClear
            className="w-full sm:!w-[140px]"
            value={filters.role || undefined}
            onChange={(v) => setFilter('role', v ?? '')}
            options={[
              { value: 'patient', label: 'Patient' },
              { value: 'provider', label: 'Provider' },
              { value: 'admin', label: 'Admin' },
            ]}
          />
          <Select
            placeholder="Status"
            allowClear
            className="w-full sm:!w-[140px]"
            value={filters.status || undefined}
            onChange={(v) => setFilter('status', v ?? '')}
            options={[
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
            ]}
          />
          <DatePicker.RangePicker
            value={dateRange}
            className="w-full sm:!w-auto"
            onChange={(range) => {
              setFilter('from', range?.[0]?.format('YYYY-MM-DD') ?? '');
              setFilter('to', range?.[1]?.format('YYYY-MM-DD') ?? '');
            }}
          />
          <Button type="primary" htmlType="submit">
            Apply
          </Button>
          {filtersActive && (
            <Button
              htmlType="button"
              onClick={() => {
                resetFilters();
              }}
            >
              Clear
            </Button>
          )}
        </form>

        <Table<User>
          rowKey="id"
          columns={columns}
          dataSource={data}
          loading={isLoading}
          size={density === 'compact' ? 'small' : 'middle'}
          sticky
          scroll={{ x: 'max-content' }}
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
            preserveSelectedRowKeys: true,
          }}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showTotal: (t) => `${t.toLocaleString()} users`,
            style: { padding: '16px 20px', margin: 0 },
          }}
          onChange={handleTableChange}
          rowClassName={() => 'cursor-pointer'}
          onRow={(record) => ({ onClick: () => navigate(`/users/${record.id}`) })}
          locale={{
            emptyText: (
              <EmptyState
                title={filtersActive ? 'No matching users' : 'No users yet'}
                description={
                  filtersActive
                    ? 'Try widening the date range or clearing a filter.'
                    : 'Once accounts are created they will appear here.'
                }
                action={
                  filtersActive
                    ? {
                        label: 'Clear filters',
                        onClick: () => {
                          resetFilters();
                        },
                      }
                    : undefined
                }
              />
            ),
          }}
        />
      </SectionCard>

      {/* Diff + confirm modal for activate/deactivate */}
      <ConfirmActionModal
        open={!!confirm}
        title={confirm?.nextActive ? 'Activate this user?' : 'Deactivate this user?'}
        description={
          confirm?.nextActive
            ? 'The user will be able to log in again immediately.'
            : 'The user will no longer be able to log in. Their data is preserved.'
        }
        diff={
          confirm
            ? [
                {
                  label: 'Email',
                  before: confirm.user.email,
                  after: confirm.user.email,
                },
                {
                  label: 'Status',
                  before: confirm.user.is_active ? 'Active' : 'Inactive',
                  after: confirm.nextActive ? 'Active' : 'Inactive',
                },
              ]
            : undefined
        }
        confirmText={confirm && !confirm.nextActive ? 'DEACTIVATE' : undefined}
        okText={confirm?.nextActive ? 'Activate' : 'Deactivate'}
        okDanger={!confirm?.nextActive}
        onOk={applyToggle}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
