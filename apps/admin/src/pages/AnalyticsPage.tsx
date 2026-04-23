import { useState } from 'react';
import { Spin, Alert, Table, Progress, Tag } from 'antd';
import {
  TeamOutlined, FileTextOutlined, ThunderboltOutlined,
  HeartOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip as RechartsTooltip, Cell, Legend,
} from 'recharts';
import PageHeader from '../components/PageHeader';
import SectionCard from '../components/SectionCard';
import KpiCard from '../components/KpiCard';
import { useThemeMode } from '../context/ThemeContext';
import { useAdminAnalytics } from '../hooks/analyticsQueries';
import { colors } from '../theme/tokens';

const TIME_RANGES = [
  { label: '7 days', value: 7 },
  { label: '30 days', value: 30 },
  { label: '90 days', value: 90 },
];

export default function AnalyticsPage() {
  const [days, setDays] = useState(30);
  const { data, isLoading, error } = useAdminAnalytics(days);
  const { mode } = useThemeMode();
  const isDark = mode === 'dark';

  const chartTooltipStyle = {
    background: isDark ? '#1E293B' : '#fff',
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : colors.slate[200]}`,
    borderRadius: 8,
    fontSize: 12,
    color: isDark ? '#E2E8F0' : undefined,
  };

  const gridStroke = isDark ? 'rgba(255,255,255,0.04)' : colors.slate[100];
  const axisStyle = { fontSize: 11, fill: isDark ? '#64748B' : colors.slate[500] };

  if (isLoading) return <div className="flex h-[60vh] items-center justify-center"><Spin size="large" /></div>;
  if (error) return <Alert type="error" message="Failed to load analytics." showIcon />;
  if (!data) return null;

  const providerColumns: ColumnsType<typeof data.provider_workload[0]> = [
    { title: 'Provider', dataIndex: 'name', key: 'name', render: (v: string) => <span className="text-sm font-semibold">{v}</span> },
    { title: 'Patients', dataIndex: 'patient_count', key: 'patients', width: 100, render: (v: number) => <span className="tabular-nums font-semibold">{v}</span> },
    { title: 'Reports (period)', dataIndex: 'reports_30d', key: 'reports', width: 130, render: (v: number) => <span className="tabular-nums">{v}</span> },
    {
      title: 'Avg Response', dataIndex: 'avg_response_hours', key: 'response', width: 130,
      render: (v: number | null) => v == null ? <span className="text-slate-400">—</span> : <Tag color={v <= 6 ? 'green' : v <= 24 ? 'gold' : 'red'}>{v}h</Tag>,
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Intelligence"
        title="Platform analytics"
        subtitle={`Clinical operations, engagement, and pain data across the entire platform (${days}d window).`}
        actions={
          <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1 dark:border-white/10 dark:bg-slate-800">
            {TIME_RANGES.map((r) => (
              <button
                key={r.value}
                onClick={() => setDays(r.value)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  days === r.value
                    ? 'bg-brand-600 text-white'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        }
      />

      {/* KPI Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Avg Pain Level" value={data.pain_overview.avg_pain.toFixed(1)} icon={<HeartOutlined />}
          tone={data.pain_overview.avg_pain >= 6 ? 'danger' : data.pain_overview.avg_pain >= 4 ? 'warning' : 'success'}
          hint={`${data.pain_overview.total_logs.toLocaleString()} logs from ${data.pain_overview.active_loggers} patients`} />
        <KpiCard label="Active Loggers" value={data.pain_overview.active_loggers} icon={<TeamOutlined />} tone="brand"
          hint={`in last ${days} days`} />
        <KpiCard label="Exercise Compliance" value={`${data.exercise_stats.completion_rate}%`} icon={<ThunderboltOutlined />}
          tone={data.exercise_stats.completion_rate >= 70 ? 'success' : data.exercise_stats.completion_rate >= 40 ? 'warning' : 'danger'}
          hint={`${data.exercise_stats.total_assignments} active assignments`} />
        <KpiCard label="Total Exercises" value={data.exercise_stats.total_exercises} icon={<FileTextOutlined />} tone="info"
          hint="in library" />
      </div>

      {/* Pain Trend + Distribution */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SectionCard title="Pain trend" subtitle={`Platform-wide average over ${days} days`}>
            <div style={{ height: 280 }}>
              <ResponsiveContainer>
                <AreaChart data={data.pain_trend} margin={{ top: 10, right: 8, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="painGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={colors.urgent?.base ?? '#EF4444'} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={colors.urgent?.base ?? '#EF4444'} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={gridStroke} vertical={false} />
                  <XAxis dataKey="date" tick={axisStyle} tickLine={false} axisLine={false} tickFormatter={(v: string) => v.slice(5)} />
                  <YAxis domain={[0, 10]} tick={axisStyle} tickLine={false} axisLine={false} width={30} />
                  <RechartsTooltip contentStyle={chartTooltipStyle} />
                  <Area type="monotone" dataKey="avg_pain" stroke={colors.urgent?.base ?? '#EF4444'} strokeWidth={2.5} fill="url(#painGrad)" name="Avg Pain" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>
        </div>

        <SectionCard title="Pain distribution" subtitle="Severity frequency">
          <div style={{ height: 280 }}>
            <ResponsiveContainer>
              <BarChart data={data.pain_distribution} margin={{ top: 10, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid stroke={gridStroke} vertical={false} />
                <XAxis dataKey="level" tick={axisStyle} tickLine={false} axisLine={false} />
                <YAxis tick={axisStyle} tickLine={false} axisLine={false} width={30} />
                <RechartsTooltip contentStyle={chartTooltipStyle} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} name="Logs">
                  {data.pain_distribution.map((entry) => (
                    <Cell key={entry.level} fill={entry.level >= 7 ? '#EF4444' : entry.level >= 4 ? '#F59E0B' : '#10B981'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>

      {/* Report Volume + Response Times */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionCard title="Report volume" subtitle="Daily submissions by urgency">
          <div style={{ height: 240 }}>
            <ResponsiveContainer>
              <BarChart data={data.report_volume} margin={{ top: 10, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid stroke={gridStroke} vertical={false} />
                <XAxis dataKey="date" tick={axisStyle} tickLine={false} axisLine={false} tickFormatter={(v: string) => v.slice(5)} />
                <YAxis tick={axisStyle} tickLine={false} axisLine={false} width={30} />
                <RechartsTooltip contentStyle={chartTooltipStyle} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="routine" stackId="a" fill="#10B981" name="Routine" />
                <Bar dataKey="concerning" stackId="a" fill="#F59E0B" name="Concerning" />
                <Bar dataKey="urgent" stackId="a" fill="#EF4444" name="Urgent" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="Response times" subtitle="Average provider response (hours)">
          <div style={{ height: 240 }}>
            <ResponsiveContainer>
              <AreaChart data={data.response_times} margin={{ top: 10, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="responseGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={colors.brand[500]} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={colors.brand[500]} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={gridStroke} vertical={false} />
                <XAxis dataKey="date" tick={axisStyle} tickLine={false} axisLine={false} tickFormatter={(v: string) => v.slice(5)} />
                <YAxis tick={axisStyle} tickLine={false} axisLine={false} width={30} />
                <RechartsTooltip contentStyle={chartTooltipStyle} />
                <Area type="monotone" dataKey="avg_hours" stroke={colors.brand[600]} strokeWidth={2} fill="url(#responseGrad)" name="Avg Hours" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>

      {/* Engagement Funnel + Top Triggers */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionCard title="Engagement funnel" subtitle="Patient journey from signup to active">
          <div className="space-y-4 py-2">
            {[
              { label: 'Registered', value: data.engagement_funnel.total_users, pct: 100 },
              { label: 'Email Verified', value: data.engagement_funnel.verified, pct: data.engagement_funnel.total_users ? Math.round((data.engagement_funnel.verified / data.engagement_funnel.total_users) * 100) : 0 },
              { label: 'Profile Complete', value: data.engagement_funnel.with_profile, pct: data.engagement_funnel.total_users ? Math.round((data.engagement_funnel.with_profile / data.engagement_funnel.total_users) * 100) : 0 },
              { label: 'Active (30d)', value: data.engagement_funnel.active_30d, pct: data.engagement_funnel.total_users ? Math.round((data.engagement_funnel.active_30d / data.engagement_funnel.total_users) * 100) : 0 },
              { label: 'Active (7d)', value: data.engagement_funnel.active_7d, pct: data.engagement_funnel.total_users ? Math.round((data.engagement_funnel.active_7d / data.engagement_funnel.total_users) * 100) : 0 },
            ].map((step) => (
              <div key={step.label} className="flex items-center gap-4">
                <div className="w-28 shrink-0 text-xs font-semibold text-slate-600 dark:text-slate-300">{step.label}</div>
                <Progress
                  percent={step.pct}
                  size="small"
                  strokeColor={step.pct >= 70 ? '#10B981' : step.pct >= 40 ? '#F59E0B' : '#EF4444'}
                  format={() => <span className="text-xs tabular-nums font-semibold">{step.value}</span>}
                  className="flex-1"
                />
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Top triggers" subtitle="Most reported pain triggers">
          {data.top_triggers.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">No trigger data yet</div>
          ) : (
            <div className="space-y-3 py-2">
              {data.top_triggers.map((t) => (
                <div key={t.trigger} className="flex items-center gap-3">
                  <div className="w-24 shrink-0 truncate text-sm font-medium capitalize text-slate-700 dark:text-slate-200">
                    {t.trigger}
                  </div>
                  <div className="flex-1">
                    <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-700">
                      <div
                        className="h-2 rounded-full bg-brand-500 transition-all"
                        style={{ width: `${t.pct}%` }}
                      />
                    </div>
                  </div>
                  <span className="w-10 text-right text-xs tabular-nums font-semibold text-slate-500">{t.pct}%</span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {/* User Growth */}
      <div className="mt-6">
        <SectionCard title="User growth" subtitle={`New signups over the past ${days} days (real data)`}>
          <div style={{ height: 240 }}>
            <ResponsiveContainer>
              <BarChart data={data.user_growth} margin={{ top: 10, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid stroke={gridStroke} vertical={false} />
                <XAxis dataKey="date" tick={axisStyle} tickLine={false} axisLine={false} tickFormatter={(v: string) => v.slice(5)} />
                <YAxis tick={axisStyle} tickLine={false} axisLine={false} width={30} />
                <RechartsTooltip contentStyle={chartTooltipStyle} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="patients" fill={colors.info?.base ?? '#3B82F6'} name="Patients" radius={[2, 2, 0, 0]} />
                <Bar dataKey="providers" fill={colors.brand[600]} name="Providers" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>

      {/* Provider Workload */}
      <div className="mt-6">
        <SectionCard title="Provider workload" subtitle="Top 20 by patient count" flush>
          <Table
            rowKey="provider_id"
            columns={providerColumns}
            dataSource={data.provider_workload}
            pagination={false}
            size="small"
            scroll={{ x: 'max-content' }}
          />
        </SectionCard>
      </div>
    </div>
  );
}
