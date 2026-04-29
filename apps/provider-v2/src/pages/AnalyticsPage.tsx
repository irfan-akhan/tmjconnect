import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Download,
  Dumbbell,
  Minus,
  Users,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Avatar, AvatarFallback, initials } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { KpiCard } from '@/components/ui/kpi-card';
import { PageHeader } from '@/components/ui/page-header';
import { Section } from '@/components/ui/section';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useProviderAnalytics } from '@/features/analytics/queries';

const TIME_RANGES = [
  { label: '7D', value: 7 },
  { label: '30D', value: 30 },
  { label: '90D', value: 90 },
] as const;

const NAVY = 'hsl(210 53% 23%)';
const GOLD = 'hsl(38 66% 55%)';
const ERR = 'hsl(0 53% 48%)';
const WARN = 'hsl(31 80% 44%)';
const OK = 'hsl(154 70% 32%)';
const BORDER = 'hsl(220 18% 88%)';
const MUTED = 'hsl(220 12% 42%)';

export function AnalyticsPage() {
  const [days, setDays] = useState<number>(30);
  const { data, isLoading } = useProviderAnalytics(days);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        eyebrow="Workspace · Analytics"
        title={
          <>
            Practice <em className="not-italic text-gold-700">insights.</em>
          </>
        }
        description={
          <>
            Cross-patient analytics ·{' '}
            <span className="text-foreground">Last updated just now</span>
          </>
        }
        actions={
          <>
            <Button variant="outline" size="sm">
              <Download className="mr-2 h-3.5 w-3.5" />
              Export
            </Button>
            <div className="inline-flex rounded-sm border border-border bg-card p-1">
              {TIME_RANGES.map((r) => (
                <button
                  key={r.value}
                  onClick={() => setDays(r.value)}
                  className={cn(
                    'rounded-sm px-3 py-1 font-mono text-[11px] uppercase tracking-[0.18em] transition-colors',
                    days === r.value
                      ? 'bg-navy-600 text-background'
                      : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </>
        }
      />

      {isLoading ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
          <Skeleton className="h-72" />
          <Skeleton className="h-56" />
        </div>
      ) : !data ? (
        <EmptyState
          title="Analytics aren't ready yet."
          description="Once your patients start logging symptoms, this dashboard will fill in."
        />
      ) : (
        <>
          {/* KPI strip */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Total patients"
              value={data.overview.total_patients}
              icon={<Users className="h-4 w-4" />}
              hint={`${data.overview.active_patients_7d} active this week`}
            />
            <KpiCard
              accent="urgent"
              label="Avg pain level"
              value={data.overview.avg_pain_level.toFixed(1)}
              icon={<Activity className="h-4 w-4" />}
              trend={data.overview.avg_pain_trend < 0 ? 'down' : data.overview.avg_pain_trend > 0 ? 'up' : 'flat'}
              delta={`${data.overview.avg_pain_trend > 0 ? '+' : ''}${data.overview.avg_pain_trend.toFixed(1)} vs prior`}
            />
            <KpiCard
              accent="navy"
              label="Symptom logs"
              value={data.overview.total_logs_30d.toLocaleString()}
              icon={<BarChart3 className="h-4 w-4" />}
              hint={`In last ${days} days`}
            />
            <KpiCard
              accent="gold"
              label="Exercise compliance"
              value={`${data.overview.exercise_compliance_pct}%`}
              icon={<Dumbbell className="h-4 w-4" />}
              hint="Assignments completed"
            />
          </div>

          {/* Pain trend + Top triggers */}
          <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
            <Card title="Pain trend" subtitle={`Cross-patient average over ${days} days`}>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.pain_trend}>
                    <defs>
                      <linearGradient id="painArea" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={GOLD} stopOpacity={0.35} />
                        <stop offset="95%" stopColor={GOLD} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={BORDER} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: MUTED, fontFamily: 'JetBrains Mono' }}
                      tickFormatter={(v: string) => v.slice(5)}
                    />
                    <YAxis
                      domain={[0, 10]}
                      tick={{ fontSize: 10, fill: MUTED, fontFamily: 'JetBrains Mono' }}
                    />
                    <Tooltip
                      contentStyle={{
                        background: 'hsl(36 40% 100%)',
                        border: `1px solid ${BORDER}`,
                        borderRadius: 4,
                        fontSize: 12,
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="avg_pain"
                      stroke={GOLD}
                      strokeWidth={2}
                      fill="url(#painArea)"
                      name="Avg pain"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card title="Top triggers" subtitle="What's setting symptoms off">
              {data.trigger_distribution.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No trigger data yet.
                </p>
              ) : (
                <ul className="space-y-3">
                  {data.trigger_distribution.slice(0, 8).map((t) => (
                    <li key={t.trigger}>
                      <div className="mb-1 flex items-baseline justify-between">
                        <span className="text-sm capitalize text-foreground">{t.trigger}</span>
                        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                          {t.pct}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-sm bg-secondary">
                        <div
                          className="h-full rounded-sm bg-gold-600 transition-all"
                          style={{ width: `${t.pct}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          {/* Pain distribution + Exercise impact */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Pain distribution" subtitle="Frequency by severity level">
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.pain_distribution}>
                    <CartesianGrid strokeDasharray="3 3" stroke={BORDER} />
                    <XAxis
                      dataKey="level"
                      tick={{ fontSize: 10, fill: MUTED, fontFamily: 'JetBrains Mono' }}
                    />
                    <YAxis tick={{ fontSize: 10, fill: MUTED, fontFamily: 'JetBrains Mono' }} />
                    <Tooltip
                      contentStyle={{
                        background: 'hsl(36 40% 100%)',
                        border: `1px solid ${BORDER}`,
                        borderRadius: 4,
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="count" radius={[2, 2, 0, 0]} name="Logs">
                      {data.pain_distribution.map((entry) => (
                        <Cell
                          key={entry.level}
                          fill={entry.level >= 7 ? ERR : entry.level >= 4 ? WARN : OK}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 flex items-center justify-center gap-4 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                <LegendDot color="bg-ok" label="Mild · 0–3" />
                <LegendDot color="bg-warn" label="Moderate · 4–6" />
                <LegendDot color="bg-err" label="Severe · 7–10" />
              </div>
            </Card>

            <Card title="Exercise impact" subtitle="Pain on exercise days vs non-exercise days">
              <div className="grid grid-cols-2 gap-4 py-2">
                <ImpactPanel
                  variant="positive"
                  icon={<Dumbbell className="h-4 w-4" />}
                  value={data.exercise_impact.with_exercise_avg_pain.toFixed(1)}
                  label="With exercises"
                  meta={`${data.exercise_impact.with_exercise_days} days`}
                />
                <ImpactPanel
                  variant="negative"
                  icon={<Minus className="h-4 w-4" />}
                  value={data.exercise_impact.without_exercise_avg_pain.toFixed(1)}
                  label="Without exercises"
                  meta={`${data.exercise_impact.without_exercise_days} days`}
                />
              </div>
              {data.exercise_impact.with_exercise_avg_pain > 0 &&
                data.exercise_impact.without_exercise_avg_pain > 0 && (
                  <div className="mt-2 rounded-sm border border-ok/30 bg-ok/5 px-3 py-2 text-center text-sm text-ok-dark">
                    Exercises reduce pain by{' '}
                    <strong>
                      {(
                        data.exercise_impact.without_exercise_avg_pain -
                        data.exercise_impact.with_exercise_avg_pain
                      ).toFixed(1)}{' '}
                      pts
                    </strong>{' '}
                    on average
                  </div>
                )}
            </Card>
          </div>

          {/* Day-of-week */}
          <Card title="Day-of-week pattern" subtitle="When patients report the most pain">
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.day_of_week_pattern}>
                  <CartesianGrid strokeDasharray="3 3" stroke={BORDER} />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 11, fill: MUTED, fontFamily: 'JetBrains Mono' }}
                  />
                  <YAxis
                    domain={[0, 10]}
                    tick={{ fontSize: 10, fill: MUTED, fontFamily: 'JetBrains Mono' }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(36 40% 100%)',
                      border: `1px solid ${BORDER}`,
                      borderRadius: 4,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="avg_pain" fill={NAVY} radius={[2, 2, 0, 0]} name="Avg pain" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Patient engagement table */}
          <Card
            title="Patient engagement"
            subtitle="Who's logging, how often"
            action={
              <Link
                to="/patients"
                className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground"
              >
                All patients
                <ArrowRight className="h-3 w-3" />
              </Link>
            }
          >
            {data.patient_engagement.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No patient data yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/60">
                      <Th>Patient</Th>
                      <Th align="right">Logs</Th>
                      <Th align="right">Avg pain</Th>
                      <Th align="right">Trend</Th>
                      <Th align="right">Exercises done</Th>
                      <Th align="right">Last active</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.patient_engagement.map((p) => (
                      <tr key={p.patient_id} className="border-b border-border/40 last:border-b-0">
                        <td className="py-3 pr-4">
                          <Link
                            to={`/patients/${p.patient_id}`}
                            className="group flex items-center gap-3 hover:text-foreground"
                          >
                            <Avatar size="sm">
                              <AvatarFallback>{initials(p.first_name, p.last_name)}</AvatarFallback>
                            </Avatar>
                            <span className="font-serif text-sm tracking-tightest">
                              {p.first_name} {p.last_name}
                            </span>
                            <ArrowUpRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
                          </Link>
                        </td>
                        <td className="py-3 text-right font-mono text-xs">{p.logs_30d}</td>
                        <td className="py-3 text-right">
                          <span
                            className={cn(
                              'font-serif text-base tracking-tightest',
                              p.avg_pain >= 7
                                ? 'text-err-dark'
                                : p.avg_pain >= 4
                                  ? 'text-warn-dark'
                                  : 'text-ok-dark',
                            )}
                          >
                            {p.avg_pain.toFixed(1)}
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          <TrendCell value={p.pain_delta} />
                        </td>
                        <td className="py-3 text-right font-mono text-xs">
                          {p.exercises_completed_30d}
                        </td>
                        <td className="py-3 text-right font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                          {p.last_log_at
                            ? formatDistanceToNow(new Date(p.last_log_at), { addSuffix: true })
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function Card({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Section
      title={title}
      subtitle={
        subtitle ? (
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            {subtitle}
          </span>
        ) : undefined
      }
      action={action}
    >
      {children}
    </Section>
  );
}

function Th({ children, align }: { children: React.ReactNode; align?: 'right' | 'left' }) {
  return (
    <th
      className={cn(
        'pb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground',
        align === 'right' && 'text-right',
      )}
    >
      {children}
    </th>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn('h-2 w-2 rounded-sm', color)} />
      {label}
    </span>
  );
}

function ImpactPanel({
  variant,
  icon,
  value,
  label,
  meta,
}: {
  variant: 'positive' | 'negative';
  icon: React.ReactNode;
  value: string;
  label: string;
  meta: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-2 rounded-sm border p-4 text-center',
        variant === 'positive' ? 'border-navy-600/30 bg-navy-50/40' : 'border-err/30 bg-err/5',
      )}
    >
      <span
        className={cn(
          'flex h-9 w-9 items-center justify-center rounded-sm',
          variant === 'positive' ? 'bg-navy-600 text-background' : 'bg-err text-background',
        )}
      >
        {icon}
      </span>
      <div className={cn('font-serif text-3xl tracking-tightest', variant === 'positive' ? 'text-navy-700' : 'text-err-dark')}>
        {value}
      </div>
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label} · {meta}
      </div>
    </div>
  );
}

function TrendCell({ value }: { value: number }) {
  if (value === 0)
    return (
      <span className="inline-flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
        <Minus className="h-3 w-3" />
        flat
      </span>
    );
  const up = value > 0;
  // For pain: up is bad, down is good.
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 font-mono text-[10px]',
        up ? 'text-err-dark' : 'text-ok-dark',
      )}
    >
      {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {up ? '+' : ''}
      {value.toFixed(1)}
    </span>
  );
}

// Badge import kept available for future status pills inside cards.
export const _Badge = Badge;
