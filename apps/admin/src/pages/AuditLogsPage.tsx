import { useState, useMemo } from 'react';
import {
  Table,
  Select,
  Input,
  Button,
  DatePicker,
  Tooltip,
  Modal,
  Tag,
} from 'antd';
import {
  DownloadOutlined,
  SearchOutlined,
  SyncOutlined,
  StarOutlined,
  StarFilled,
  DeleteOutlined,
  EditOutlined,
  CheckOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import dayjs from 'dayjs';
import api from '../config/api';
import PageHeader from '../components/PageHeader';
import SectionCard from '../components/SectionCard';
import RelativeTime from '../components/RelativeTime';
import CopyableId from '../components/CopyableId';
import EmptyState from '../components/EmptyState';
import { useUrlFilters } from '../hooks/useUrlFilters';
import { downloadCsv, type CsvColumn } from '../utils/csv';
import { useToastHistory } from '../context/ToastHistoryContext';
import { usePreferences } from '../context/PreferencesContext';
import { useAdminAuditLogs } from '../hooks/queries';
import {
  listPresets,
  savePreset,
  deletePreset,
  renamePreset,
  type FilterPreset,
} from '../utils/filterPresets';
import AuditDetailDrawer, { type AuditLogRow } from '../components/AuditDetailDrawer';
import ColumnToggle from '../components/ColumnToggle';
import { useColumnVisibility } from '../hooks/useColumnVisibility';

interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  ip_address: string;
  created_at: string;
}

interface SavedFilters {
  user_id?: string;
  action?: string;
  resource_type?: string;
  from?: string;
  to?: string;
}

const SCOPE = 'audit-logs';

function actionTone(action: string): { bg: string; text: string; border: string } {
  if (action.startsWith('auth.')) return { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' };
  if (action.startsWith('admin')) return { bg: '#FEF2F2', text: '#B91C1C', border: '#FECACA' };
  if (action.startsWith('provider')) return { bg: '#F0FDFA', text: '#0F766E', border: '#99F6E4' };
  if (action.startsWith('report')) return { bg: '#FFFBEB', text: '#B45309', border: '#FDE68A' };
  return { bg: '#F1F5F9', text: '#475569', border: '#E2E8F0' };
}

const BUILTIN_PRESETS: { name: string; filters: SavedFilters }[] = [
  {
    name: 'Failed logins (24h)',
    filters: { action: 'auth.login_failed', from: dayjs().subtract(1, 'day').format('YYYY-MM-DD') },
  },
  {
    name: 'Admin actions today',
    filters: { action: 'admin', from: dayjs().format('YYYY-MM-DD') },
  },
  {
    name: 'PHI access today',
    filters: { action: 'provider_viewed', from: dayjs().format('YYYY-MM-DD') },
  },
];

export default function AuditLogsPage() {
  const { push } = useToastHistory();
  const { density } = usePreferences();
  const [exporting, setExporting] = useState(false);
  const [liveRefresh, setLiveRefresh] = useState(false);
  const [presets, setPresets] = useState<FilterPreset<SavedFilters>[]>(() =>
    listPresets<SavedFilters>(SCOPE),
  );
  const [savePromptOpen, setSavePromptOpen] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [drawerEntry, setDrawerEntry] = useState<AuditLogRow | null>(null);

  const ALL_COL_KEYS = ['created_at', 'action', 'resource', 'user_id', 'ip'];
  const colVis = useColumnVisibility('audit-logs', ALL_COL_KEYS);

  const defaults = useMemo(
    () => ({ user_id: '', action: '', resource_type: '', from: '', to: '', page: '1', limit: '50' }),
    [],
  );
  const { filters, setFilter, setMany, reset: resetFilters, commit: commitFilters } = useUrlFilters(defaults);

  const dateRange: [dayjs.Dayjs | null, dayjs.Dayjs | null] | null =
    filters.from || filters.to
      ? [filters.from ? dayjs(filters.from) : null, filters.to ? dayjs(filters.to) : null]
      : null;

  // ─── Build query params from URL filters ──────────────────────────────
  const queryParams = useMemo(() => {
    const params: Record<string, string | number> = {
      page: Number(filters.page) || 1,
      limit: Number(filters.limit) || 50,
    };
    if (filters.user_id) params.user_id = filters.user_id;
    if (filters.action) params.action = filters.action;
    if (filters.resource_type) params.resource_type = filters.resource_type;
    if (filters.from) params.from = filters.from;
    if (filters.to) params.to = filters.to;
    return params;
  }, [filters]);

  const { data: queryData, isLoading } = useAdminAuditLogs(queryParams);

  const data = (queryData?.data ?? []) as AuditLog[];
  const meta = queryData?.meta ?? { page: 1, limit: 50, total: 0, hasMore: false };
  const pagination = { current: meta.page, pageSize: meta.limit, total: meta.total };

  const applyPreset = (sf: SavedFilters) => {
    setMany({
      user_id: sf.user_id ?? '',
      action: sf.action ?? '',
      resource_type: sf.resource_type ?? '',
      from: sf.from ?? '',
      to: sf.to ?? '',
      page: '1',
    });
    setTimeout(() => commitFilters(), 0);
  };

  const handleSavePreset = () => {
    if (!presetName.trim()) return;
    const sf: SavedFilters = {
      user_id: filters.user_id || undefined,
      action: filters.action || undefined,
      resource_type: filters.resource_type || undefined,
      from: filters.from || undefined,
      to: filters.to || undefined,
    };
    const created = savePreset<SavedFilters>(SCOPE, presetName.trim(), sf);
    setPresets((p) => [created, ...p]);
    setPresetName('');
    setSavePromptOpen(false);
    push('success', `Saved preset "${created.name}".`);
  };

  const handleDeletePreset = (id: string) => {
    deletePreset(SCOPE, id);
    setPresets((p) => p.filter((x) => x.id !== id));
    push('info', 'Preset deleted.');
  };

  const startRenaming = (preset: FilterPreset<SavedFilters>) => {
    setEditingPresetId(preset.id);
    setEditingName(preset.name);
  };

  const commitRename = () => {
    if (!editingPresetId || !editingName.trim()) {
      setEditingPresetId(null);
      return;
    }
    const next = renamePreset<SavedFilters>(SCOPE, editingPresetId, editingName.trim());
    setPresets(next);
    setEditingPresetId(null);
    push('success', 'Preset renamed.');
  };

  const cancelRename = () => {
    setEditingPresetId(null);
    setEditingName('');
  };

  const exportCurrentView = () => {
    const cols: CsvColumn<AuditLog>[] = [
      { header: 'When', accessor: (l) => dayjs(l.created_at).format('YYYY-MM-DD HH:mm:ss') },
      { header: 'Action', accessor: (l) => l.action },
      { header: 'Resource type', accessor: (l) => l.resource_type ?? '' },
      { header: 'Resource ID', accessor: (l) => l.resource_id ?? '' },
      { header: 'User ID', accessor: (l) => l.user_id ?? '' },
      { header: 'IP', accessor: (l) => l.ip_address ?? '' },
    ];
    downloadCsv(`audit-current-${dayjs().format('YYYYMMDD-HHmmss')}`, data, cols);
    push('success', `Exported ${data.length} entries.`);
  };

  const handleTableChange = (pag: TablePaginationConfig) => {
    setFilter('page', String(pag.current ?? 1));
    setFilter('limit', String(pag.pageSize ?? 50));
  };

  const exportCsv = async () => {
    if (!filters.from || !filters.to) {
      push('warning', 'Select a date range to export.');
      return;
    }
    setExporting(true);
    try {
      const { data: csvData } = await api.get('/admin/audit-logs/export', {
        params: { from: filters.from, to: filters.to },
        responseType: 'blob',
      });
      const url = URL.createObjectURL(csvData);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${filters.from}-${filters.to}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      push('error', 'Failed to export audit logs.');
    } finally {
      setExporting(false);
    }
  };

  const filtersActive = !!(
    filters.user_id || filters.action || filters.resource_type || filters.from || filters.to
  );

  const allColumns: ColumnsType<AuditLog> = [
    {
      title: 'When',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (v: string) => <RelativeTime value={v} />,
    },
    {
      title: 'Action',
      dataIndex: 'action',
      key: 'action',
      render: (v: string) => {
        const t = actionTone(v);
        return (
          <span
            className="inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold"
            style={{ background: t.bg, color: t.text, borderColor: t.border }}
          >
            {v}
          </span>
        );
      },
    },
    {
      title: 'Resource',
      key: 'resource',
      render: (_: unknown, r: AuditLog) =>
        r.resource_type ? (
          <span className="font-mono text-xs text-slate-600 dark:text-slate-300">
            {r.resource_type}
            {r.resource_id ? `:` : ''}
            {r.resource_id && <CopyableId value={r.resource_id} />}
          </span>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        ),
    },
    {
      title: 'User',
      dataIndex: 'user_id',
      key: 'user_id',
      width: 140,
      render: (v: string | null) => <CopyableId value={v} />,
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
  ];

  const columns = allColumns.filter((c) => colVis.isVisible(c.key as string));

  return (
    <div>
      <PageHeader
        eyebrow="Security"
        title="Audit logs"
        subtitle="Tamper-evident record of every PHI access and security event."
        actions={
          <>
            <Tooltip title={liveRefresh ? 'Auto-refresh ON · 15s' : 'Enable auto-refresh'}>
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
            <Button onClick={exportCurrentView} disabled={data.length === 0}>
              Export view
            </Button>
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={exportCsv}
              loading={exporting}
            >
              Export range
            </Button>
          </>
        }
      />

      <SectionCard
        title="All entries"
        subtitle={`${pagination.total.toLocaleString()} matching log lines`}
        flush
      >
        {/* ─── Saved-view chip row ───────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-5 py-3 dark:border-white/[0.06]">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Quick views
          </span>
          {BUILTIN_PRESETS.map((p) => (
            <Tag
              key={p.name}
              className="!cursor-pointer !rounded-full !border-slate-200 !bg-white !px-3 !py-1 !text-xs !font-medium hover:!border-brand-400 hover:!text-brand-700 dark:!border-slate-700 dark:!bg-slate-800 dark:!text-slate-200"
              onClick={() => applyPreset(p.filters)}
            >
              <StarOutlined /> {p.name}
            </Tag>
          ))}
          {presets.map((p) => {
            const isEditing = editingPresetId === p.id;
            if (isEditing) {
              return (
                <span
                  key={p.id}
                  className="inline-flex items-center gap-1 rounded-full border border-brand-300 bg-white px-2 py-0.5 dark:border-brand-600 dark:bg-slate-800"
                >
                  <Input
                    autoFocus
                    size="small"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onPressEnter={commitRename}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') cancelRename();
                    }}
                    style={{ width: 160 }}
                  />
                  <Button
                    type="text"
                    size="small"
                    icon={<CheckOutlined style={{ color: '#10B981' }} />}
                    onClick={commitRename}
                  />
                  <Button
                    type="text"
                    size="small"
                    icon={<CloseOutlined style={{ color: '#94A3B8' }} />}
                    onClick={cancelRename}
                  />
                </span>
              );
            }
            return (
              <Tooltip key={p.id} title="Double-click to rename">
                <Tag
                  className="!cursor-pointer !rounded-full !border-brand-200 !bg-brand-50 !px-3 !py-1 !text-xs !font-medium !text-brand-700 hover:!bg-brand-100 dark:!border-brand-700 dark:!bg-brand-900/30 dark:!text-brand-200"
                  closeIcon={<DeleteOutlined onClick={() => handleDeletePreset(p.id)} />}
                  closable
                  onClick={() => applyPreset(p.filters)}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    startRenaming(p);
                  }}
                >
                  <StarFilled /> {p.name}
                  <EditOutlined className="ml-1 opacity-40" style={{ fontSize: 10 }} />
                </Tag>
              </Tooltip>
            );
          })}
          <Button
            type="link"
            size="small"
            disabled={!filtersActive}
            onClick={() => setSavePromptOpen(true)}
          >
            + Save current view
          </Button>
        </div>

        {/* Filter bar */}
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
            placeholder="Action"
            allowClear
            style={{ width: 240 }}
            value={filters.action || undefined}
            onChange={(v) => setFilter('action', v ?? '')}
            options={[
              { value: 'auth.patient_registered', label: 'Patient registered' },
              { value: 'auth.provider_registered', label: 'Provider registered' },
              { value: 'auth.password_reset_requested', label: 'Password reset' },
              { value: 'auth.mfa_enabled', label: 'MFA enabled' },
              { value: 'admin_user_updated', label: 'Admin user updated' },
              { value: 'admin_viewed_audit_logs', label: 'Audit log read' },
              { value: 'provider_viewed_patient_detail', label: 'Patient detail viewed' },
              { value: 'report_viewed', label: 'Report viewed' },
            ]}
          />
          <Select
            placeholder="Resource"
            allowClear
            style={{ width: 170 }}
            value={filters.resource_type || undefined}
            onChange={(v) => setFilter('resource_type', v ?? '')}
            options={[
              { value: 'user', label: 'User' },
              { value: 'report', label: 'Report' },
              { value: 'symptom_log', label: 'Symptom log' },
              { value: 'linking_code', label: 'Linking code' },
              { value: 'audit_log', label: 'Audit log' },
              { value: 'login_event', label: 'Login event' },
              { value: 'session', label: 'Session' },
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
          <div className="ml-auto">
            <ColumnToggle
              columns={[
                { key: 'created_at', label: 'When' },
                { key: 'action', label: 'Action' },
                { key: 'resource', label: 'Resource' },
                { key: 'user_id', label: 'User' },
                { key: 'ip', label: 'IP' },
              ]}
              isVisible={colVis.isVisible}
              toggle={colVis.toggle}
              reset={colVis.reset}
            />
          </div>
        </form>

        <Table<AuditLog>
          rowKey="id"
          columns={columns}
          dataSource={data}
          loading={isLoading}
          size={density === 'compact' ? 'small' : 'middle'}
          sticky
          scroll={{ x: 'max-content' }}
          rowClassName={() => 'cursor-pointer'}
          onRow={(record) => ({
            onClick: () => setDrawerEntry(record as AuditLogRow),
          })}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showTotal: (t) => `${t.toLocaleString()} entries`,
            style: { padding: '16px 20px', margin: 0 },
          }}
          onChange={handleTableChange}
          locale={{
            emptyText: (
              <EmptyState
                title={filtersActive ? 'No matching events' : 'No audit events yet'}
                description={
                  filtersActive
                    ? 'Try widening the date range or clearing a filter.'
                    : 'Activity will appear here as the platform receives traffic.'
                }
                action={filtersActive ? { label: 'Clear filters', onClick: resetFilters } : undefined}
              />
            ),
          }}
        />
      </SectionCard>

      {/* Save preset modal */}
      <Modal
        open={savePromptOpen}
        title="Save filter preset"
        onCancel={() => setSavePromptOpen(false)}
        onOk={handleSavePreset}
        okText="Save preset"
        okButtonProps={{ disabled: !presetName.trim() }}
        destroyOnClose
      >
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Give this filter combination a memorable name. It will be saved to this browser only.
        </p>
        <Input
          autoFocus
          className="mt-3"
          placeholder="e.g. Suspicious patient access"
          value={presetName}
          onChange={(e) => setPresetName(e.target.value)}
          onPressEnter={handleSavePreset}
        />
      </Modal>

      <AuditDetailDrawer
        open={!!drawerEntry}
        entry={drawerEntry}
        onClose={() => setDrawerEntry(null)}
        onFindSimilar={(patch) => {
          setMany({
            user_id: patch.user_id ?? '',
            action: patch.action ?? '',
            resource_type: patch.resource_type ?? '',
            from: '',
            to: '',
            page: '1',
          });
          setTimeout(() => commitFilters(), 0);
        }}
      />
    </div>
  );
}
