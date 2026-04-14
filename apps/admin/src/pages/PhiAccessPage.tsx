import { useState } from 'react';
import { Tabs, Input, DatePicker, Button, Table, Tag, Alert, Select } from 'antd';
import { UserOutlined, FileSearchOutlined, WarningOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import PageHeader from '../components/PageHeader';
import SectionCard from '../components/SectionCard';
import RelativeTime from '../components/RelativeTime';
import CopyableId from '../components/CopyableId';
import {
  usePhiByActor, usePhiByResource, usePhiAnomalies,
} from '../hooks/todoQueries';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
} from 'recharts';
import { useThemeMode } from '../context/ThemeContext';
import { colors } from '../theme/tokens';

export default function PhiAccessPage() {
  const { mode } = useThemeMode();
  const isDark = mode === 'dark';

  const [tab, setTab] = useState<'actor' | 'resource'>('actor');

  // Actor form
  const [actorUserId, setActorUserId] = useState('');
  const [actorRange, setActorRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>([
    dayjs().subtract(30, 'day'), dayjs(),
  ]);
  const [actorSubmitted, setActorSubmitted] = useState<{ user_id: string; from: string; to: string } | null>(null);

  const actorQ = usePhiByActor(
    actorSubmitted ?? { user_id: '', from: '', to: '' },
    !!actorSubmitted,
  );

  // Resource form
  const [resourceType, setResourceType] = useState('user');
  const [resourceId, setResourceId] = useState('');
  const [resourceRange, setResourceRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>([
    dayjs().subtract(30, 'day'), dayjs(),
  ]);
  const [resourceSubmitted, setResourceSubmitted] = useState<{ resource_type: string; resource_id: string; from: string; to: string } | null>(null);

  const resourceQ = usePhiByResource(
    resourceSubmitted ?? { resource_type: '', resource_id: '', from: '', to: '' },
    !!resourceSubmitted,
  );

  // Anomalies sidebar
  const [anomalyWindow, setAnomalyWindow] = useState('24h');
  const anomaliesQ = usePhiAnomalies(anomalyWindow);
  const anomalies = (anomaliesQ.data ?? { bulk_listings: [], unusual_patient_views: [] }) as {
    bulk_listings: Array<{ actor_id: string; actor_email: string; count: number; window_start: string }>;
    unusual_patient_views: Array<{ actor_id: string; actor_email: string; patient_count: number; window_start: string }>;
  };

  const submitActor = () => {
    if (!actorUserId || !actorRange) return;
    setActorSubmitted({
      user_id: actorUserId,
      from: actorRange[0].format('YYYY-MM-DD'),
      to: actorRange[1].format('YYYY-MM-DD'),
    });
  };
  const submitResource = () => {
    if (!resourceId || !resourceRange) return;
    setResourceSubmitted({
      resource_type: resourceType,
      resource_id: resourceId,
      from: resourceRange[0].format('YYYY-MM-DD'),
      to: resourceRange[1].format('YYYY-MM-DD'),
    });
  };

  return (
    <div>
      <PageHeader
        eyebrow="Compliance"
        title="PHI access reports"
        subtitle="HIPAA audit artifact. Slice the audit log by actor, resource, or anomaly."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
        {/* ─── Main panel ─────────────────────────────────────────── */}
        <div>
          <SectionCard flush>
            <Tabs
              activeKey={tab}
              onChange={(k) => setTab(k as 'actor' | 'resource')}
              tabBarStyle={{ padding: '0 20px', margin: 0 }}
              items={[
                { key: 'actor', label: <><UserOutlined /> By actor</> },
                { key: 'resource', label: <><FileSearchOutlined /> By resource</> },
              ]}
            />

            {tab === 'actor' ? (
              <div className="p-5">
                <div className="flex flex-wrap items-end gap-3 rounded-md border border-slate-100 bg-slate-50 p-4 dark:border-white/[0.06] dark:bg-slate-900/40">
                  <div>
                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">User ID</div>
                    <Input
                      placeholder="UUID of the actor"
                      value={actorUserId}
                      onChange={(e) => setActorUserId(e.target.value)}
                      style={{ width: 320 }}
                    />
                  </div>
                  <div>
                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Date range</div>
                    <DatePicker.RangePicker
                      value={actorRange}
                      onChange={(r) => setActorRange(r as [dayjs.Dayjs, dayjs.Dayjs] | null)}
                    />
                  </div>
                  <Button type="primary" onClick={submitActor} disabled={!actorUserId || !actorRange}>
                    Run report
                  </Button>
                </div>

                {actorQ.data && (
                  <div className="mt-5">
                    <div className="mb-4 rounded-md border border-slate-200 bg-white p-4 dark:border-white/[0.06] dark:bg-[#0F172A]">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-semibold">{actorQ.data.actor?.email ?? 'Unknown'}</div>
                          <div className="text-xs text-slate-500">{actorQ.data.actor?.role}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold">{actorQ.data.summary?.total_accesses ?? 0}</div>
                          <div className="text-xs text-slate-500">Total accesses</div>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        {Object.entries(actorQ.data.summary?.by_resource_type ?? {}).map(([k, v]) => (
                          <div key={k} className="text-xs">
                            <span className="text-slate-500">{k}: </span>
                            <span className="font-semibold">{v as number}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {actorQ.data.timeline?.length > 0 && (
                      <div style={{ height: 180 }}>
                        <ResponsiveContainer>
                          <AreaChart data={actorQ.data.timeline}>
                            <CartesianGrid stroke={isDark ? 'rgba(255,255,255,0.04)' : colors.slate[100]} vertical={false} />
                            <XAxis dataKey="date" stroke={isDark ? '#475569' : colors.slate[400]} tick={{ fontSize: 11 }} />
                            <YAxis stroke={isDark ? '#475569' : colors.slate[400]} tick={{ fontSize: 11 }} />
                            <RechartsTooltip
                              contentStyle={{
                                background: isDark ? '#1E293B' : '#fff',
                                border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : colors.slate[200]}`,
                                borderRadius: 8, fontSize: 12,
                              }}
                            />
                            <Area type="monotone" dataKey="count" stroke={colors.brand[600]} fill={colors.brand[100]} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    <div className="mt-4">
                      <Table
                        size="small"
                        rowKey="id"
                        dataSource={actorQ.data.details ?? []}
                        pagination={{ pageSize: 20 }}
                        columns={[
                          { title: 'When', dataIndex: 'created_at', width: 160, render: (v: string) => <RelativeTime value={v} /> },
                          { title: 'Action', dataIndex: 'action', render: (v: string) => <Tag color="cyan" style={{ fontFamily: 'monospace', fontSize: 11 }}>{v}</Tag> },
                          { title: 'Resource', dataIndex: 'resource_type', width: 140 },
                          { title: 'Resource ID', dataIndex: 'resource_id', width: 140, render: (v: string) => <CopyableId value={v} /> },
                          { title: 'IP', dataIndex: 'ip_address', width: 130, render: (v: string) => <span className="font-mono text-xs">{v ?? '—'}</span> },
                        ]}
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-5">
                <div className="flex flex-wrap items-end gap-3 rounded-md border border-slate-100 bg-slate-50 p-4 dark:border-white/[0.06] dark:bg-slate-900/40">
                  <div>
                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Type</div>
                    <Select
                      value={resourceType}
                      onChange={setResourceType}
                      style={{ width: 160 }}
                      options={[
                        { value: 'user', label: 'User' },
                        { value: 'report', label: 'Report' },
                        { value: 'symptom_log', label: 'Symptom log' },
                      ]}
                    />
                  </div>
                  <div>
                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Resource ID</div>
                    <Input
                      placeholder="UUID"
                      value={resourceId}
                      onChange={(e) => setResourceId(e.target.value)}
                      style={{ width: 320 }}
                    />
                  </div>
                  <div>
                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Date range</div>
                    <DatePicker.RangePicker
                      value={resourceRange}
                      onChange={(r) => setResourceRange(r as [dayjs.Dayjs, dayjs.Dayjs] | null)}
                    />
                  </div>
                  <Button type="primary" onClick={submitResource} disabled={!resourceId || !resourceRange}>
                    Run report
                  </Button>
                </div>

                {resourceQ.data && (
                  <div className="mt-5">
                    <Alert
                      type="info"
                      message={`${resourceQ.data.unique_actors ?? 0} unique actors accessed this resource`}
                      className="mb-4"
                    />
                    <Table
                      size="small"
                      rowKey={(r: Record<string, string>) => `${r.actor_id}-${r.created_at}`}
                      dataSource={resourceQ.data.accesses ?? []}
                      pagination={{ pageSize: 20 }}
                      columns={[
                        { title: 'When', dataIndex: 'created_at', width: 160, render: (v: string) => <RelativeTime value={v} /> },
                        { title: 'Actor', dataIndex: 'actor_email' },
                        { title: 'Role', dataIndex: 'actor_role', width: 100, render: (v: string) => <Tag>{v}</Tag> },
                        { title: 'Action', dataIndex: 'action', render: (v: string) => <Tag color="cyan" style={{ fontFamily: 'monospace', fontSize: 11 }}>{v}</Tag> },
                        { title: 'IP', dataIndex: 'ip_address', width: 130, render: (v: string) => <span className="font-mono text-xs">{v ?? '—'}</span> },
                      ]}
                    />
                  </div>
                )}
              </div>
            )}
          </SectionCard>
        </div>

        {/* ─── Anomalies sidebar ──────────────────────────────────── */}
        <div>
          <SectionCard
            title={<><WarningOutlined style={{ color: '#F59E0B' }} /> Anomalies</>}
            subtitle="Data exfiltration patterns"
            extra={
              <Select
                size="small"
                value={anomalyWindow}
                onChange={setAnomalyWindow}
                style={{ width: 110 }}
                options={[
                  { value: '1h', label: 'Last 1h' },
                  { value: '6h', label: 'Last 6h' },
                  { value: '12h', label: 'Last 12h' },
                  { value: '24h', label: 'Last 24h' },
                ]}
              />
            }
          >
            <div className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Bulk listings ({anomalies.bulk_listings.length})
            </div>
            {anomalies.bulk_listings.length === 0 ? (
              <div className="py-2 text-xs text-slate-500 dark:text-slate-400">None detected.</div>
            ) : (
              <ul className="flex flex-col gap-2">
                {anomalies.bulk_listings.map((a, i) => (
                  <li key={i} className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-700 dark:bg-amber-900/20">
                    <div className="text-xs font-semibold text-slate-800 dark:text-slate-100">{a.actor_email ?? 'unknown'}</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">{a.count} list calls in window</div>
                  </li>
                ))}
              </ul>
            )}

            <div className="mb-3 mt-4 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Unusual patient views ({anomalies.unusual_patient_views.length})
            </div>
            {anomalies.unusual_patient_views.length === 0 ? (
              <div className="py-2 text-xs text-slate-500 dark:text-slate-400">None detected.</div>
            ) : (
              <ul className="flex flex-col gap-2">
                {anomalies.unusual_patient_views.map((a, i) => (
                  <li key={i} className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 dark:border-rose-700 dark:bg-rose-900/20">
                    <div className="text-xs font-semibold text-slate-800 dark:text-slate-100">{a.actor_email ?? 'unknown'}</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">{a.patient_count} distinct patients viewed</div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
