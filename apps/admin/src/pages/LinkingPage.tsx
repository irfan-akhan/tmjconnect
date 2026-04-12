import { useMemo } from 'react';
import { Table, Tag, Tabs, Select } from 'antd';
import { LinkOutlined, DisconnectOutlined, MailOutlined, WarningOutlined } from '@ant-design/icons';
import PageHeader from '../components/PageHeader';
import SectionCard from '../components/SectionCard';
import KpiCard from '../components/KpiCard';
import RelativeTime from '../components/RelativeTime';
import EmptyState from '../components/EmptyState';
import { useLinkingSummary, useLinkingCodes, useLinkingLinks } from '../hooks/todoQueries';
import { useUrlFilters } from '../hooks/useUrlFilters';

interface Summary {
  active_links: number;
  disconnected_30d: number;
  pending_codes: number;
  expired_codes: number;
  top_providers: Array<{ provider_id: string; name: string; patient_count: number }>;
}

export default function LinkingPage() {
  const defaults = useMemo(
    () => ({ tab: 'links', linkStatus: 'active', codeStatus: '', page: '1', limit: '20' }),
    [],
  );
  const { filters, setFilter } = useUrlFilters(defaults);

  const summaryQ = useLinkingSummary();
  const s: Summary = summaryQ.data ?? { active_links: 0, disconnected_30d: 0, pending_codes: 0, expired_codes: 0, top_providers: [] };

  const listParams = {
    page: Number(filters.page) || 1,
    limit: Number(filters.limit) || 20,
  };

  const codesQ = useLinkingCodes({ ...listParams, status: filters.codeStatus || undefined });
  const linksQ = useLinkingLinks({ ...listParams, status: filters.linkStatus || undefined });

  return (
    <div>
      <PageHeader
        eyebrow="Operations"
        title="Linking & relationships"
        subtitle="Patient-provider connections, pending invites, and the platform's relationship graph."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Active links" value={s.active_links} icon={<LinkOutlined />} tone="success" />
        <KpiCard label="Disconnected (30d)" value={s.disconnected_30d} icon={<DisconnectOutlined />} tone="warning" />
        <KpiCard label="Pending codes" value={s.pending_codes} icon={<MailOutlined />} tone="info" />
        <KpiCard label="Expired codes" value={s.expired_codes} icon={<WarningOutlined />} tone="danger" />
      </div>

      {s.top_providers.length > 0 && (
        <div className="mt-6">
          <SectionCard title="Top providers by patient count">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {s.top_providers.slice(0, 6).map((p) => (
                <div
                  key={p.provider_id}
                  className="flex items-center justify-between rounded-md border border-slate-100 px-3 py-2 dark:border-white/[0.06]"
                >
                  <span className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">{p.name.trim() || 'Unknown'}</span>
                  <Tag color="cyan">{p.patient_count} patients</Tag>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      )}

      <div className="mt-6">
        <SectionCard
          title="Connections"
          flush
          extra={
            <Tabs
              activeKey={filters.tab}
              onChange={(k) => { setFilter('tab', k); setFilter('page', '1'); }}
              items={[
                { key: 'links', label: `Links (${s.active_links + s.disconnected_30d})` },
                { key: 'codes', label: `Codes (${s.pending_codes + s.expired_codes})` },
              ]}
              size="small"
            />
          }
        >
          {filters.tab === 'codes' ? (
            <>
              <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100 dark:border-white/[0.06]">
                <Select
                  size="small"
                  allowClear
                  placeholder="All statuses"
                  style={{ width: 140 }}
                  value={filters.codeStatus || undefined}
                  onChange={(v) => setFilter('codeStatus', v ?? '')}
                  options={[
                    { value: 'pending', label: 'Pending' },
                    { value: 'connected', label: 'Connected' },
                    { value: 'expired', label: 'Expired' },
                  ]}
                />
              </div>
              <Table
                rowKey="id"
                size="small"
                dataSource={codesQ.data?.data ?? []}
                loading={codesQ.isLoading}
                pagination={{
                  current: codesQ.data?.meta?.page ?? 1,
                  pageSize: codesQ.data?.meta?.limit ?? 20,
                  total: codesQ.data?.meta?.total ?? 0,
                  showSizeChanger: true,
                  onChange: (page, limit) => {
                    setFilter('page', String(page));
                    setFilter('limit', String(limit));
                  },
                }}
                columns={[
                  { title: 'Code', dataIndex: 'code', width: 120, render: (v: string) => <span className="font-mono font-semibold">{v}</span> },
                  {
                    title: 'Provider',
                    key: 'provider',
                    render: (_: unknown, r: Record<string, string | null>) => (
                      <div>
                        <div className="text-sm font-medium">{(r.provider_first_name ?? '') + ' ' + (r.provider_last_name ?? '')}</div>
                        <div className="text-xs text-slate-500">{r.provider_email}</div>
                      </div>
                    ),
                  },
                  { title: 'Status', dataIndex: 'status', width: 120, render: (v: string) => <Tag>{v}</Tag> },
                  { title: 'Expires', dataIndex: 'expires_at', width: 140, render: (v: string) => <RelativeTime value={v} /> },
                  { title: 'Created', dataIndex: 'created_at', width: 140, render: (v: string) => <RelativeTime value={v} /> },
                ]}
                locale={{ emptyText: <EmptyState title="No codes" /> }}
              />
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100 dark:border-white/[0.06]">
                <Select
                  size="small"
                  allowClear
                  placeholder="All"
                  style={{ width: 140 }}
                  value={filters.linkStatus || undefined}
                  onChange={(v) => setFilter('linkStatus', v ?? '')}
                  options={[
                    { value: 'active', label: 'Active' },
                    { value: 'disconnected', label: 'Disconnected' },
                  ]}
                />
              </div>
              <Table
                rowKey="id"
                size="small"
                dataSource={linksQ.data?.data ?? []}
                loading={linksQ.isLoading}
                pagination={{
                  current: linksQ.data?.meta?.page ?? 1,
                  pageSize: linksQ.data?.meta?.limit ?? 20,
                  total: linksQ.data?.meta?.total ?? 0,
                  showSizeChanger: true,
                  onChange: (page, limit) => {
                    setFilter('page', String(page));
                    setFilter('limit', String(limit));
                  },
                }}
                columns={[
                  {
                    title: 'Patient',
                    key: 'patient',
                    render: (_: unknown, r: Record<string, string | null>) => (
                      <div>
                        <div className="text-sm font-medium">{(r.patient_first_name ?? '') + ' ' + (r.patient_last_name ?? '')}</div>
                        <div className="text-xs text-slate-500">{r.patient_email}</div>
                      </div>
                    ),
                  },
                  {
                    title: 'Provider',
                    key: 'provider',
                    render: (_: unknown, r: Record<string, string | null>) => (
                      <div>
                        <div className="text-sm font-medium">{(r.provider_first_name ?? '') + ' ' + (r.provider_last_name ?? '')}</div>
                        <div className="text-xs text-slate-500">{r.provider_email}</div>
                      </div>
                    ),
                  },
                  {
                    title: 'Status',
                    key: 'status',
                    width: 120,
                    render: (_: unknown, r: Record<string, string | null>) => (
                      <Tag color={r.unlinked_at ? 'default' : 'green'}>
                        {r.unlinked_at ? 'Disconnected' : 'Active'}
                      </Tag>
                    ),
                  },
                  { title: 'Linked', dataIndex: 'linked_at', width: 140, render: (v: string) => <RelativeTime value={v} /> },
                  {
                    title: 'Disconnected',
                    dataIndex: 'unlinked_at',
                    width: 140,
                    render: (v: string | null) => v ? <RelativeTime value={v} /> : <span className="text-xs text-slate-400">—</span>,
                  },
                ]}
                locale={{ emptyText: <EmptyState title="No links" /> }}
              />
            </>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
