import { useState } from 'react';
import { Select, Table } from 'antd';
import {
  WarningOutlined, LockOutlined, SafetyOutlined, GlobalOutlined,
} from '@ant-design/icons';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
} from 'recharts';
import dayjs from 'dayjs';
import PageHeader from '../components/PageHeader';
import SectionCard from '../components/SectionCard';
import KpiCard from '../components/KpiCard';
import EmptyState from '../components/EmptyState';
import { useSecuritySummary } from '../hooks/todoQueries';
import { useThemeMode } from '../context/ThemeContext';
import { colors } from '../theme/tokens';

interface Summary {
  failed_logins: number;
  failed_logins_by_ip: Array<{ ip: string; count: number }>;
  failed_logins_by_email: Array<{ email: string; count: number }>;
  refresh_token_replays: number;
  new_device_logins: number;
  hourly_failed_logins: Array<{ hour: string; count: number }>;
}

export default function SecurityPage() {
  const [window, setWindow] = useState('24h');
  const { data, isLoading } = useSecuritySummary(window);
  const { mode } = useThemeMode();
  const isDark = mode === 'dark';

  const s: Summary = data ?? {
    failed_logins: 0, failed_logins_by_ip: [], failed_logins_by_email: [],
    refresh_token_replays: 0, new_device_logins: 0, hourly_failed_logins: [],
  };

  return (
    <div>
      <PageHeader
        eyebrow="Security"
        title="Security operations"
        subtitle="Consolidated view of authentication events and anomalies."
        actions={
          <Select
            value={window}
            onChange={setWindow}
            style={{ width: 140 }}
            options={[
              { value: '1h', label: 'Last hour' },
              { value: '6h', label: 'Last 6 hours' },
              { value: '12h', label: 'Last 12 hours' },
              { value: '24h', label: 'Last 24 hours' },
              { value: '7d', label: 'Last 7 days' },
            ]}
          />
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Failed logins"
          value={isLoading ? '—' : s.failed_logins}
          icon={<WarningOutlined />}
          tone={s.failed_logins > 20 ? 'danger' : s.failed_logins > 5 ? 'warning' : 'success'}
          hint={`In ${window}`}
        />
        <KpiCard
          label="Token replays"
          value={isLoading ? '—' : s.refresh_token_replays}
          icon={<LockOutlined />}
          tone={s.refresh_token_replays > 0 ? 'danger' : 'success'}
          hint="Session hijacking attempts"
        />
        <KpiCard
          label="New device logins"
          value={isLoading ? '—' : s.new_device_logins}
          icon={<GlobalOutlined />}
          tone="info"
          hint="Distinct devices"
        />
        <KpiCard
          label="Unique IPs (failed)"
          value={isLoading ? '—' : s.failed_logins_by_ip.length}
          icon={<SafetyOutlined />}
          tone={s.failed_logins_by_ip.length > 10 ? 'danger' : 'warning'}
          hint="Distinct sources"
        />
      </div>

      {/* ─── Hourly chart ────────────────────────────────────────── */}
      {s.hourly_failed_logins.length > 0 && (
        <div className="mt-6">
          <SectionCard title="Failed logins over time" subtitle="Hourly bucket counts">
            <div style={{ height: 220 }}>
              <ResponsiveContainer>
                <AreaChart data={s.hourly_failed_logins.map((h) => ({
                  hour: dayjs(h.hour).format('MMM D HH:mm'),
                  count: h.count,
                }))}>
                  <defs>
                    <linearGradient id="failGrad" x1="0" y1="0" x2="0" y2="1">
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
                  <Area type="monotone" dataKey="count" stroke={colors.danger.base} fill="url(#failGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>
        </div>
      )}

      {/* ─── Top failure sources ─────────────────────────────────── */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionCard title="Top failure sources — by IP" subtitle="Distinct IPs with most failed attempts" flush>
          <Table
            rowKey="ip"
            size="small"
            dataSource={s.failed_logins_by_ip}
            pagination={false}
            columns={[
              { title: 'IP', dataIndex: 'ip', render: (v: string) => <span className="font-mono text-xs">{v}</span> },
              { title: 'Failed attempts', dataIndex: 'count', width: 140, render: (v: number) => <span className="tabular-nums">{v}</span> },
            ]}
            locale={{ emptyText: <EmptyState title="No failed logins in window" /> }}
          />
        </SectionCard>

        <SectionCard title="Top failure sources — by email" subtitle="Emails being targeted" flush>
          <Table
            rowKey="email"
            size="small"
            dataSource={s.failed_logins_by_email}
            pagination={false}
            columns={[
              { title: 'Email', dataIndex: 'email', render: (v: string) => <span className="text-xs">{v}</span> },
              { title: 'Failed attempts', dataIndex: 'count', width: 140, render: (v: number) => <span className="tabular-nums">{v}</span> },
            ]}
            locale={{ emptyText: <EmptyState title="No failed logins in window" /> }}
          />
        </SectionCard>
      </div>
    </div>
  );
}
