import { useMemo } from 'react';
import {
  Table,
  Select,
  Input,
  Button,
  DatePicker,
} from 'antd';
import { SearchOutlined, CheckCircleFilled, CloseCircleFilled, DownloadOutlined } from '@ant-design/icons';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import dayjs from 'dayjs';
import PageHeader from '../components/PageHeader';
import SectionCard from '../components/SectionCard';
import RelativeTime from '../components/RelativeTime';
import CopyableId from '../components/CopyableId';
import EmptyState from '../components/EmptyState';
import { useUrlFilters } from '../hooks/useUrlFilters';
import { useToastHistory } from '../context/ToastHistoryContext';
import { usePreferences } from '../context/PreferencesContext';
import { useAdminLoginEvents } from '../hooks/queries';
import { downloadCsv, type CsvColumn } from '../utils/csv';

interface LoginEvent {
  id: string;
  user_id: string | null;
  email: string;
  success: boolean;
  ip_address: string;
  device_info: string;
  failure_reason: string | null;
  created_at: string;
}

export default function LoginEventsPage() {
  const { push } = useToastHistory();
  const { density } = usePreferences();

  const defaults = useMemo(
    () => ({ user_id: '', success: '', from: '', to: '', page: '1', limit: '50' }),
    [],
  );
  const { filters, setFilter, reset: resetFilters, commit: commitFilters } = useUrlFilters(defaults);

  const dateRange: [dayjs.Dayjs | null, dayjs.Dayjs | null] | null =
    filters.from || filters.to
      ? [filters.from ? dayjs(filters.from) : null, filters.to ? dayjs(filters.to) : null]
      : null;

  const queryParams = useMemo(() => {
    const params: Record<string, string | number> = {
      page: Number(filters.page) || 1,
      limit: Number(filters.limit) || 50,
    };
    if (filters.user_id) params.user_id = filters.user_id;
    if (filters.success) params.success = filters.success;
    if (filters.from) params.from = filters.from;
    if (filters.to) params.to = filters.to;
    return params;
  }, [filters]);

  const { data: queryData, isLoading } = useAdminLoginEvents(queryParams);

  const data = (queryData?.data ?? []) as LoginEvent[];
  const meta = queryData?.meta ?? { page: 1, limit: 50, total: 0, hasMore: false };
  const pagination = { current: meta.page, pageSize: meta.limit, total: meta.total };

  const handleTableChange = (pag: TablePaginationConfig) => {
    setFilter('page', String(pag.current ?? 1));
    setFilter('limit', String(pag.pageSize ?? 50));
  };

  const filtersActive = !!(filters.user_id || filters.success || filters.from || filters.to);

  const exportCsv = () => {
    const cols: CsvColumn<LoginEvent>[] = [
      { header: 'When', accessor: (e) => dayjs(e.created_at).format('YYYY-MM-DD HH:mm:ss') },
      { header: 'Email', accessor: (e) => e.email },
      { header: 'Status', accessor: (e) => (e.success ? 'Success' : 'Failed') },
      { header: 'Reason', accessor: (e) => e.failure_reason ?? '' },
      { header: 'IP', accessor: (e) => e.ip_address ?? '' },
      { header: 'Device', accessor: (e) => e.device_info ?? '' },
      { header: 'User ID', accessor: (e) => e.user_id ?? '' },
    ];
    downloadCsv(`login-events-${dayjs().format('YYYYMMDD-HHmmss')}`, data, cols);
    push('success', `Exported ${data.length} login events.`);
  };

  const columns: ColumnsType<LoginEvent> = [
    {
      title: 'When',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (v: string) => <RelativeTime value={v} />,
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      ellipsis: true,
      render: (v: string) => (
        <span className="text-sm font-medium text-slate-800 dark:text-slate-100">{v}</span>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'success',
      key: 'success',
      width: 130,
      render: (v: boolean) =>
        v ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
            <CheckCircleFilled style={{ color: '#10B981' }} />
            Success
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700">
            <CloseCircleFilled style={{ color: '#EF4444' }} />
            Failed
          </span>
        ),
    },
    {
      title: 'Reason',
      dataIndex: 'failure_reason',
      key: 'failure_reason',
      width: 180,
      render: (v: string | null) =>
        v ? (
          <span className="font-mono text-xs text-slate-600 dark:text-slate-300">{v}</span>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        ),
    },
    {
      title: 'IP',
      dataIndex: 'ip_address',
      key: 'ip',
      width: 140,
      render: (v: string) => (
        <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{v ?? '—'}</span>
      ),
    },
    {
      title: 'Device',
      dataIndex: 'device_info',
      key: 'device',
      ellipsis: true,
      render: (v: string) => (
        <span className="text-xs text-slate-500 dark:text-slate-400">{v ?? '—'}</span>
      ),
    },
    {
      title: 'User',
      dataIndex: 'user_id',
      key: 'user_id',
      width: 110,
      render: (v: string | null) => <CopyableId value={v} />,
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Security"
        title="Login events"
        subtitle="Successful and failed authentication attempts across the platform."
        actions={
          <Button icon={<DownloadOutlined />} onClick={exportCsv} disabled={data.length === 0}>
            Export CSV
          </Button>
        }
      />

      <SectionCard
        title="Authentication history"
        subtitle={`${pagination.total.toLocaleString()} matching events`}
        flush
      >
        <form
          className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-4 dark:border-white/[0.06]"
          onSubmit={(e) => {
            e.preventDefault();
            setFilter('page', '1');
            commitFilters();
          }}
        >
          <Input
            prefix={<SearchOutlined className="text-slate-400" />}
            placeholder="User ID"
            value={filters.user_id}
            onChange={(e) => setFilter('user_id', e.target.value)}
            allowClear
            style={{ width: 220 }}
          />
          <Select
            placeholder="Status"
            allowClear
            style={{ width: 150 }}
            value={filters.success || undefined}
            onChange={(v) => setFilter('success', v ?? '')}
            options={[
              { value: 'true', label: 'Success' },
              { value: 'false', label: 'Failed' },
            ]}
          />
          <DatePicker.RangePicker
            value={dateRange}
            onChange={(range) => {
              setFilter('from', range?.[0]?.format('YYYY-MM-DD') ?? '');
              setFilter('to', range?.[1]?.format('YYYY-MM-DD') ?? '');
            }}
          />
          <Button type="primary" htmlType="submit">
            Apply
          </Button>
          {filtersActive && (
            <Button htmlType="button" onClick={resetFilters}>
              Clear
            </Button>
          )}
        </form>

        <Table<LoginEvent>
          rowKey="id"
          columns={columns}
          dataSource={data}
          loading={isLoading}
          size={density === 'compact' ? 'small' : 'middle'}
          sticky
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showTotal: (t) => `${t.toLocaleString()} events`,
            style: { padding: '16px 20px', margin: 0 },
          }}
          onChange={handleTableChange}
          locale={{
            emptyText: (
              <EmptyState
                title={filtersActive ? 'No matching events' : 'No login attempts yet'}
                description={
                  filtersActive
                    ? 'Try clearing a filter or widening the date range.'
                    : 'Login attempts will appear here as users authenticate.'
                }
                action={filtersActive ? { label: 'Clear filters', onClick: resetFilters } : undefined}
              />
            ),
          }}
        />
      </SectionCard>
    </div>
  );
}
