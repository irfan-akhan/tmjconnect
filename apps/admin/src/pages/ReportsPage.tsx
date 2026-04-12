import { useMemo } from 'react';
import { Table, Input, Select, Button, DatePicker } from 'antd';
import { FlagFilled, SearchOutlined, DownloadOutlined } from '@ant-design/icons';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import dayjs from 'dayjs';
import PageHeader from '../components/PageHeader';
import SectionCard from '../components/SectionCard';
import RelativeTime from '../components/RelativeTime';
import EmptyState from '../components/EmptyState';
import { urgencyColors, colors } from '../theme/tokens';
import { useUrlFilters } from '../hooks/useUrlFilters';
import { useToastHistory } from '../context/ToastHistoryContext';
import { usePreferences } from '../context/PreferencesContext';
import { useAdminReports } from '../hooks/queries';
import { downloadCsv, type CsvColumn } from '../utils/csv';

interface Report {
  id: string;
  patient_name: string;
  provider_name: string;
  urgency: 'routine' | 'concerning' | 'urgent';
  pain_level: number;
  status: 'submitted' | 'viewed' | 'reviewed' | 'responded';
  flagged: boolean;
  submitted_at: string;
}

const statusTones: Record<Report['status'], { bg: string; text: string; border: string }> = {
  submitted: { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
  viewed:    { bg: '#ECFEFF', text: '#0E7490', border: '#A5F3FC' },
  reviewed:  { bg: '#ECFDF5', text: '#047857', border: '#A7F3D0' },
  responded: { bg: '#F5F3FF', text: '#6D28D9', border: '#DDD6FE' },
};

export default function ReportsPage() {
  const { push } = useToastHistory();
  const { density } = usePreferences();

  const defaults = useMemo(
    () => ({ search: '', urgency: '', status: '', from: '', to: '', page: '1', limit: '20' }),
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
      limit: Number(filters.limit) || 20,
    };
    return params;
  }, [filters.page, filters.limit]);

  const { data: queryData, isLoading } = useAdminReports(queryParams);

  const rawData = (queryData?.data ?? []) as Report[];
  const meta = queryData?.meta ?? { page: 1, limit: 20, total: 0, hasMore: false };
  const pagination = { current: meta.page, pageSize: meta.limit, total: meta.total };

  // Client-side filtering for fields the backend doesn't support yet.
  const filteredData = useMemo(() => {
    return rawData.filter((r) => {
      if (filters.urgency && r.urgency !== filters.urgency) return false;
      if (filters.status && r.status !== filters.status) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        if (
          !r.patient_name?.toLowerCase().includes(q) &&
          !r.provider_name?.toLowerCase().includes(q)
        )
          return false;
      }
      if (filters.from && dayjs(r.submitted_at).isBefore(dayjs(filters.from))) return false;
      if (filters.to && dayjs(r.submitted_at).isAfter(dayjs(filters.to).add(1, 'day'))) return false;
      return true;
    });
  }, [rawData, filters]);

  const handleTableChange = (pag: TablePaginationConfig) => {
    setFilter('page', String(pag.current ?? 1));
    setFilter('limit', String(pag.pageSize ?? 20));
  };

  const filtersActive = !!(
    filters.search || filters.urgency || filters.status || filters.from || filters.to
  );

  const exportCsv = () => {
    const cols: CsvColumn<Report>[] = [
      { header: 'Submitted', accessor: (r) => dayjs(r.submitted_at).format('YYYY-MM-DD HH:mm:ss') },
      { header: 'Patient', accessor: (r) => r.patient_name ?? '' },
      { header: 'Provider', accessor: (r) => r.provider_name ?? '' },
      { header: 'Urgency', accessor: (r) => r.urgency },
      { header: 'Pain', accessor: (r) => String(r.pain_level) },
      { header: 'Status', accessor: (r) => r.status },
      { header: 'Flagged', accessor: (r) => (r.flagged ? 'Yes' : 'No') },
      { header: 'Report ID', accessor: (r) => r.id },
    ];
    downloadCsv(`reports-${dayjs().format('YYYYMMDD-HHmmss')}`, filteredData, cols);
    push('success', `Exported ${filteredData.length} reports.`);
  };

  const columns: ColumnsType<Report> = [
    {
      title: 'Submitted',
      dataIndex: 'submitted_at',
      key: 'submitted_at',
      width: 160,
      render: (v: string) => <RelativeTime value={v} />,
    },
    {
      title: 'Patient',
      dataIndex: 'patient_name',
      key: 'patient',
      render: (v: string) => (
        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{v ?? '—'}</span>
      ),
    },
    {
      title: 'Provider',
      dataIndex: 'provider_name',
      key: 'provider',
      render: (v: string) => (
        <span className="text-sm text-slate-600 dark:text-slate-300">{v ?? '—'}</span>
      ),
    },
    {
      title: 'Urgency',
      dataIndex: 'urgency',
      key: 'urgency',
      width: 130,
      render: (v: Report['urgency']) => {
        const u = urgencyColors[v];
        return (
          <span
            className="inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider"
            style={{ background: u.bg, color: u.text, borderColor: u.border }}
          >
            {v}
          </span>
        );
      },
    },
    {
      title: 'Pain',
      dataIndex: 'pain_level',
      key: 'pain',
      width: 100,
      render: (v: number) => {
        const tone =
          v >= 7 ? colors.urgent.base : v >= 4 ? colors.warning.base : colors.success.base;
        const trackColor =
          v >= 7 ? colors.urgent.soft : v >= 4 ? colors.warning.soft : colors.success.soft;
        return (
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-12 overflow-hidden rounded-full" style={{ background: trackColor }}>
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${(v / 10) * 100}%`, background: tone }}
              />
            </div>
            <span className="text-xs font-semibold" style={{ color: tone }}>
              {v}/10
            </span>
          </div>
        );
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      render: (v: Report['status']) => {
        const t = statusTones[v];
        return (
          <span
            className="inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider"
            style={{ background: t.bg, color: t.text, borderColor: t.border }}
          >
            {v}
          </span>
        );
      },
    },
    {
      title: 'Flag',
      dataIndex: 'flagged',
      key: 'flagged',
      width: 70,
      align: 'center',
      render: (v: boolean) =>
        v ? (
          <FlagFilled style={{ color: colors.urgent.base, fontSize: 16 }} />
        ) : (
          <span className="text-slate-300">—</span>
        ),
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Operations"
        title="Reports monitor"
        subtitle="Cross-provider view of every patient health report submitted."
        actions={
          <Button icon={<DownloadOutlined />} onClick={exportCsv} disabled={filteredData.length === 0}>
            Export CSV
          </Button>
        }
      />

      <SectionCard
        title="All reports"
        subtitle={`${filteredData.length.toLocaleString()} of ${pagination.total.toLocaleString()} matching${
          filtersActive ? ' (filtered)' : ''
        }`}
        flush
      >
        <form
          className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-4 dark:border-white/[0.06]"
          onSubmit={(e) => {
            e.preventDefault();
            commitFilters();
          }}
        >
          <Input
            prefix={<SearchOutlined className="text-slate-400" />}
            placeholder="Search patient or provider"
            value={filters.search}
            onChange={(e) => setFilter('search', e.target.value)}
            allowClear
            style={{ width: 280 }}
          />
          <Select
            placeholder="Urgency"
            allowClear
            style={{ width: 150 }}
            value={filters.urgency || undefined}
            onChange={(v) => setFilter('urgency', v ?? '')}
            options={[
              { value: 'routine', label: 'Routine' },
              { value: 'concerning', label: 'Concerning' },
              { value: 'urgent', label: 'Urgent' },
            ]}
          />
          <Select
            placeholder="Status"
            allowClear
            style={{ width: 150 }}
            value={filters.status || undefined}
            onChange={(v) => setFilter('status', v ?? '')}
            options={[
              { value: 'submitted', label: 'Submitted' },
              { value: 'viewed', label: 'Viewed' },
              { value: 'reviewed', label: 'Reviewed' },
              { value: 'responded', label: 'Responded' },
            ]}
          />
          <DatePicker.RangePicker
            value={dateRange}
            onChange={(range) => {
              setFilter('from', range?.[0]?.format('YYYY-MM-DD') ?? '');
              setFilter('to', range?.[1]?.format('YYYY-MM-DD') ?? '');
            }}
          />
          {filtersActive && (
            <Button htmlType="button" onClick={resetFilters}>
              Clear
            </Button>
          )}
        </form>

        <Table<Report>
          rowKey="id"
          columns={columns}
          dataSource={filteredData}
          loading={isLoading}
          size={density === 'compact' ? 'small' : 'middle'}
          sticky
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showTotal: (t) => `${t.toLocaleString()} reports`,
            style: { padding: '16px 20px', margin: 0 },
          }}
          onChange={handleTableChange}
          locale={{
            emptyText: (
              <EmptyState
                title={filtersActive ? 'No matching reports' : 'No reports yet'}
                description={
                  filtersActive
                    ? 'Adjust the filters or clear them to see all reports.'
                    : 'Patient reports will appear here as they are submitted.'
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
