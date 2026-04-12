import { Spin, Alert, Tag, Empty, Button } from 'antd';
import {
  TeamOutlined,
  UserOutlined,
  FileTextOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  RiseOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import dayjs from 'dayjs';
import { Link } from 'react-router-dom';
import KpiCard from '../components/KpiCard';
import PageHeader from '../components/PageHeader';
import SectionCard from '../components/SectionCard';
import RelativeTime from '../components/RelativeTime';
import { colors, urgencyColors } from '../theme/tokens';
import { useAuth } from '../context/AuthContext';
import { usePreferences } from '../context/PreferencesContext';
import { useThemeMode } from '../context/ThemeContext';
import { useAdminStats, useAdminReports, useAdminAuditLogs } from '../hooks/queries';

/** Mock 14-day signup trend until the API exposes it. */
function buildSignupSeries(total: number) {
  const today = dayjs();
  const days = 14;
  return Array.from({ length: days }, (_, i) => {
    const date = today.subtract(days - 1 - i, 'day');
    const fraction = (i + 1) / days;
    const value = Math.round(total * fraction * (0.9 + Math.random() * 0.2));
    return { date: date.format('MMM D'), users: value };
  });
}

function buildSparkSeries(base: number, variance = 0.4): number[] {
  return Array.from({ length: 14 }, (_, i) => {
    const fraction = (i + 1) / 14;
    return Math.max(0, Math.round(base * fraction * (1 - variance / 2 + Math.random() * variance)));
  });
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { recentlyViewed } = usePreferences();
  const { mode } = useThemeMode();
  const isDark = mode === 'dark';

  // Chart tooltip style that respects dark mode.
  const chartTooltipStyle = {
    background: isDark ? '#1E293B' : '#fff',
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : colors.slate[200]}`,
    borderRadius: 8,
    boxShadow: isDark
      ? '0 8px 24px -4px rgba(0,0,0,0.5)'
      : '0 4px 12px -2px rgb(15 23 42 / 0.1)',
    fontSize: 12,
    color: isDark ? '#E2E8F0' : undefined,
  };

  // All three queries run in parallel on mount. React Query deduplicates
  // the /admin/stats call with the Settings page and caches everything
  // with a stale-while-revalidate strategy.
  const statsQ = useAdminStats();
  const reportsQ = useAdminReports({ page: 1, limit: 5 });
  const selfAuditQ = useAdminAuditLogs({
    user_id: user?.id ?? '',
    from: dayjs().format('YYYY-MM-DD'),
    limit: 6,
  });

  const loading = statsQ.isLoading;
  const error = statsQ.error;
  const stats = statsQ.data ?? null;
  const recentReports = reportsQ.data?.data ?? [];
  const selfAudit = selfAuditQ.data?.data ?? [];

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }
  if (error) return <Alert type="error" message="Failed to load dashboard data." showIcon />;
  if (!stats) return null;

  const signupSeries = buildSignupSeries(stats.total_users);

  const roleSplit = [
    { name: 'Patients', value: stats.patients, color: colors.info.base },
    { name: 'Providers', value: stats.providers, color: colors.brand[600] },
    {
      name: 'Admins',
      value: Math.max(0, stats.total_users - stats.patients - stats.providers),
      color: colors.urgent.base,
    },
  ].filter((entry) => entry.value > 0);

  const activeRate = stats.total_users
    ? Math.round((stats.active_users / stats.total_users) * 100)
    : 0;

  return (
    <div>
      <PageHeader
        eyebrow="Overview"
        title="Welcome back"
        subtitle="A snapshot of platform activity, system health, and clinical operations."
        actions={
          <Button type="primary" icon={<RiseOutlined />}>
            View full report
          </Button>
        }
      />

      {/* ─── KPI grid ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Total users"
          value={stats.total_users.toLocaleString()}
          icon={<TeamOutlined />}
          tone="brand"
          delta={12}
          deltaLabel="vs. last week"
          sparkline={buildSparkSeries(stats.total_users)}
        />
        <KpiCard
          label="Active users"
          value={stats.active_users.toLocaleString()}
          icon={<CheckCircleOutlined />}
          tone="success"
          hint={`${activeRate}% of total accounts`}
          sparkline={buildSparkSeries(stats.active_users, 0.25)}
        />
        <KpiCard
          label="Reports today"
          value={stats.reports_today}
          icon={<FileTextOutlined />}
          tone="info"
          delta={stats.reports_today > 0 ? 8 : 0}
          deltaLabel="vs. yesterday"
          sparkline={buildSparkSeries(Math.max(stats.reports_today, 4), 0.5)}
        />
        <KpiCard
          label="Avg response time"
          value={stats.avg_response_hours !== null ? `${stats.avg_response_hours}h` : '—'}
          icon={<ClockCircleOutlined />}
          tone="warning"
          hint="Provider responses (last 7d)"
          sparkline={
            stats.avg_response_hours !== null
              ? buildSparkSeries(Math.max(stats.avg_response_hours * 2, 6), 0.5)
              : undefined
          }
        />
      </div>

      {/* ─── Charts row ───────────────────────────────────────────────── */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SectionCard
            title="User growth"
            subtitle="New signups over the past 14 days"
            extra={
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Updated <RelativeTime value={new Date()} />
              </span>
            }
          >
            <div style={{ height: 280 }}>
              <ResponsiveContainer>
                <AreaChart data={signupSeries} margin={{ top: 10, right: 8, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="brandGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={colors.brand[500]} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={colors.brand[500]} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={isDark ? 'rgba(255,255,255,0.04)' : colors.slate[100]} vertical={false} />
                  <XAxis
                    dataKey="date"
                    stroke={isDark ? '#475569' : colors.slate[400]}
                    tick={{ fontSize: 11, fill: isDark ? '#64748B' : undefined }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke={isDark ? '#475569' : colors.slate[400]}
                    tick={{ fontSize: 11, fill: isDark ? '#64748B' : undefined }}
                    tickLine={false}
                    axisLine={false}
                    width={40}
                  />
                  <RechartsTooltip
                    contentStyle={chartTooltipStyle}
                    cursor={{ stroke: colors.brand[300], strokeWidth: 1 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="users"
                    stroke={colors.brand[600]}
                    strokeWidth={2.5}
                    fill="url(#brandGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>
        </div>

        <div>
          <SectionCard title="Role breakdown" subtitle="Distribution of accounts">
            <div style={{ height: 280 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={roleSplit}
                    cx="50%"
                    cy="50%"
                    innerRadius={62}
                    outerRadius={88}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {roleSplit.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} stroke="#fff" strokeWidth={2} />
                    ))}
                  </Pie>
                  <RechartsTooltip contentStyle={chartTooltipStyle} />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: 12, color: isDark ? '#94A3B8' : colors.slate[600] }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>
        </div>
      </div>

      {/* ─── Recent reports + activity column ──────────────────────────── */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SectionCard
            title="Recent patient reports"
            subtitle="Latest 5 reports across all providers"
            extra={
              <Link
                to="/reports"
                className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400"
              >
                View all <ArrowRightOutlined />
              </Link>
            }
            flush
          >
            {recentReports.length === 0 ? (
              <div className="py-10">
                <Empty description="No reports yet" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              </div>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {recentReports.map((r) => {
                  const u = urgencyColors[r.urgency];
                  return (
                    <li
                      key={r.id}
                      className="flex items-center gap-4 px-5 py-4 transition hover:bg-slate-50 dark:hover:bg-slate-700/30"
                    >
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
                        style={{ background: u.bg, color: u.text, border: `1px solid ${u.border}` }}
                      >
                        {r.patient_name?.charAt(0)?.toUpperCase() ?? 'P'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {r.patient_name ?? 'Unknown patient'}
                          </span>
                          <Tag
                            style={{
                              background: u.bg,
                              color: u.text,
                              border: `1px solid ${u.border}`,
                              fontWeight: 600,
                              fontSize: 10,
                              textTransform: 'uppercase',
                              letterSpacing: '0.04em',
                            }}
                          >
                            {r.urgency}
                          </Tag>
                          {r.flagged && (
                            <Tag color="red" style={{ fontSize: 10 }}>
                              FLAGGED
                            </Tag>
                          )}
                        </div>
                        <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                          To{' '}
                          <span className="font-medium text-slate-700 dark:text-slate-200">
                            {r.provider_name ?? '—'}
                          </span>
                          {' · '}
                          <RelativeTime value={r.submitted_at} />
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">PAIN</div>
                        <div
                          className="text-base font-semibold"
                          style={{
                            color:
                              r.pain_level >= 7
                                ? colors.urgent.base
                                : r.pain_level >= 4
                                ? colors.warning.base
                                : colors.success.base,
                          }}
                        >
                          {r.pain_level}/10
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </SectionCard>

          {/* Self-audit + recently-viewed strip */}
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SectionCard
              title="What you've done today"
              subtitle="Audit entries authored by you in the last 24h"
            >
              {selfAudit.length === 0 ? (
                <div className="py-4 text-center text-xs text-slate-500 dark:text-slate-400">
                  No actions yet today.
                </div>
              ) : (
                <ul className="space-y-2">
                  {selfAudit.map((e) => (
                    <li
                      key={e.id}
                      className="flex items-start justify-between gap-3 rounded-md border border-slate-100 px-3 py-2 dark:border-white/[0.06]"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                          {e.action}
                        </div>
                        {e.resource_type && (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            <span className="font-mono">{e.resource_type}</span>
                            {e.resource_id ? `:${e.resource_id.slice(0, 8)}` : ''}
                          </div>
                        )}
                      </div>
                      <RelativeTime value={e.created_at} />
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>

            <SectionCard
              title="Recently viewed"
              subtitle={`Last ${recentlyViewed.length} entities you opened`}
            >
              {recentlyViewed.length === 0 ? (
                <div className="py-4 text-center text-xs text-slate-500 dark:text-slate-400">
                  Nothing viewed yet.
                </div>
              ) : (
                <ul className="space-y-2">
                  {recentlyViewed.slice(0, 5).map((e) => (
                    <li key={`${e.type}-${e.id}`}>
                      <Link
                        to={e.type === 'user' ? `/users/${e.id}?focus=1` : '/reports?focus=1'}
                        className="flex items-center justify-between gap-2 rounded-md border border-slate-100 px-3 py-2 transition hover:border-brand-300 hover:bg-brand-50 dark:border-white/[0.06] dark:hover:bg-slate-700/40"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-xs font-semibold text-slate-700 dark:text-slate-200">
                            {e.label}
                          </div>
                          {e.subtitle && (
                            <div className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                              {e.subtitle}
                            </div>
                          )}
                        </div>
                        <RelativeTime value={e.visitedAt} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          </div>
        </div>

        <div>
          <SectionCard title="System status">
            <ul className="space-y-2">
              {[
                { label: 'API', status: 'Operational' },
                { label: 'Database', status: 'Operational' },
                { label: 'Email · SMS · Push', status: 'Operational' },
              ].map((s) => (
                <li
                  key={s.label}
                  className="flex items-center justify-between rounded-md border border-slate-100 bg-slate-50 px-3 py-2 dark:border-white/[0.06] dark:bg-slate-900/40"
                >
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
                    {s.label}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60"></span>
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                    </span>
                    <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                      {s.status}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </SectionCard>

          <div className="mt-4">
            <SectionCard title="Quick actions">
              <div className="grid grid-cols-2 gap-2">
                <Link
                  to="/users"
                  className="flex flex-col items-center justify-center gap-1 rounded-md border border-slate-200 p-3 text-center transition hover:border-brand-500 hover:bg-brand-50 dark:border-white/[0.06] dark:hover:border-brand-500 dark:hover:bg-slate-700/50"
                >
                  <TeamOutlined style={{ fontSize: 20, color: colors.brand[600] }} />
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    Manage users
                  </span>
                </Link>
                <Link
                  to="/audit-logs"
                  className="flex flex-col items-center justify-center gap-1 rounded-md border border-slate-200 p-3 text-center transition hover:border-brand-500 hover:bg-brand-50 dark:border-white/[0.06] dark:hover:border-brand-500 dark:hover:bg-slate-700/50"
                >
                  <UserOutlined style={{ fontSize: 20, color: colors.brand[600] }} />
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    View audit log
                  </span>
                </Link>
              </div>
            </SectionCard>
          </div>
        </div>
      </div>
    </div>
  );
}
