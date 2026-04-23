import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts';
import {
  TrendingUp, TrendingDown, Minus, Users, Activity, Dumbbell, BarChart3, ArrowUpRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useProviderAnalytics } from '@/features/analytics/queries';
import { formatDistanceToNow } from 'date-fns';

const TIME_RANGES = [
  { label: '7d', value: 7 },
  { label: '30d', value: 30 },
  { label: '90d', value: 90 },
] as const;

export function AnalyticsPage() {
  const [days, setDays] = useState(30);
  const { data, isLoading } = useProviderAnalytics(days);

  return (
    <div className="mx-auto max-w-6xl space-y-10">
      <header className="flex items-end justify-between gap-8 border-b border-border/70 pb-8">
        <div>
          <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            Folio № 07 — Analytics
          </div>
          <h1 className="font-serif text-5xl tracking-tightest">
            Practice <em className="text-accent">insights.</em>
          </h1>
        </div>
        <div className="flex gap-1 rounded-sm border border-border/70 bg-card p-1">
          {TIME_RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => setDays(r.value)}
              className={cn(
                'rounded-sm px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] transition-colors',
                days === r.value
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </header>

      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-xl bg-secondary" />
          ))}
          <div className="col-span-full h-72 animate-pulse rounded-xl bg-secondary" />
        </div>
      ) : data ? (
        <>
          {/* KPI Cards */}
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Total Patients"
              value={data.overview.total_patients}
              sub={`${data.overview.active_patients_7d} active this week`}
              icon={<Users className="h-4 w-4" />}
            />
            <KpiCard
              label="Avg Pain Level"
              value={data.overview.avg_pain_level.toFixed(1)}
              sub={<TrendIndicator value={data.overview.avg_pain_trend} invert />}
              icon={<Activity className="h-4 w-4" />}
            />
            <KpiCard
              label="Symptom Logs"
              value={data.overview.total_logs_30d}
              sub={`in last ${days} days`}
              icon={<BarChart3 className="h-4 w-4" />}
            />
            <KpiCard
              label="Exercise Compliance"
              value={`${data.overview.exercise_compliance_pct}%`}
              sub="assignments completed"
              icon={<Dumbbell className="h-4 w-4" />}
            />
          </section>

          {/* Charts Row */}
          <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
            {/* Pain Trend */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="font-serif text-xl tracking-tightest">Pain trend</CardTitle>
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                  Cross-patient average over {days} days
                </p>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.pain_trend}>
                      <defs>
                        <linearGradient id="painFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                        tickFormatter={(v: string) => v.slice(5)}
                      />
                      <YAxis domain={[0, 10]} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                      <Tooltip
                        contentStyle={{
                          background: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="avg_pain"
                        stroke="hsl(var(--accent))"
                        strokeWidth={2}
                        fill="url(#painFill)"
                        name="Avg Pain"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Trigger Distribution */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="font-serif text-xl tracking-tightest">Top triggers</CardTitle>
              </CardHeader>
              <CardContent>
                {data.trigger_distribution.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">No trigger data yet</p>
                ) : (
                  <ul className="space-y-3">
                    {data.trigger_distribution.slice(0, 8).map((t) => (
                      <li key={t.trigger} className="flex items-center gap-3">
                        <div className="flex-1">
                          <div className="mb-1 flex items-baseline justify-between">
                            <span className="text-sm capitalize">{t.trigger}</span>
                            <span className="font-mono text-[10px] text-muted-foreground">{t.pct}%</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-secondary">
                            <div
                              className="h-1.5 rounded-full bg-accent transition-all"
                              style={{ width: `${t.pct}%` }}
                            />
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </section>

          {/* Second Row */}
          <section className="grid gap-6 lg:grid-cols-2">
            {/* Pain Distribution */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="font-serif text-xl tracking-tightest">Pain distribution</CardTitle>
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                  Frequency by severity level
                </p>
              </CardHeader>
              <CardContent>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.pain_distribution}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="level" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                      <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                      <Tooltip
                        contentStyle={{
                          background: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]} name="Logs">
                        {data.pain_distribution.map((entry) => (
                          <Cell
                            key={entry.level}
                            fill={entry.level >= 7 ? 'hsl(var(--destructive))' : entry.level >= 4 ? 'hsl(var(--accent))' : 'hsl(var(--primary))'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Exercise Impact */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="font-serif text-xl tracking-tightest">Exercise impact</CardTitle>
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                  Pain on exercise days vs non-exercise days
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-6 py-4">
                  <div className="text-center">
                    <div className="mb-2 inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                      <Dumbbell className="h-5 w-5 text-primary" />
                    </div>
                    <div className="font-serif text-3xl tracking-tightest">
                      {data.exercise_impact.with_exercise_avg_pain.toFixed(1)}
                    </div>
                    <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                      avg pain ({data.exercise_impact.with_exercise_days} days)
                    </div>
                    <div className="mt-0.5 text-xs text-primary">With exercises</div>
                  </div>
                  <div className="text-center">
                    <div className="mb-2 inline-flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                      <Minus className="h-5 w-5 text-destructive" />
                    </div>
                    <div className="font-serif text-3xl tracking-tightest">
                      {data.exercise_impact.without_exercise_avg_pain.toFixed(1)}
                    </div>
                    <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                      avg pain ({data.exercise_impact.without_exercise_days} days)
                    </div>
                    <div className="mt-0.5 text-xs text-destructive">Without exercises</div>
                  </div>
                </div>
                {data.exercise_impact.with_exercise_avg_pain > 0 && data.exercise_impact.without_exercise_avg_pain > 0 && (
                  <div className="mt-2 rounded-sm border border-border/70 bg-secondary/30 p-3 text-center">
                    <span className="text-sm">
                      Exercises reduce pain by{' '}
                      <strong className="text-primary">
                        {(data.exercise_impact.without_exercise_avg_pain - data.exercise_impact.with_exercise_avg_pain).toFixed(1)} pts
                      </strong>{' '}
                      on average
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          </section>

          {/* Day of Week Pattern */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="font-serif text-xl tracking-tightest">Day-of-week pattern</CardTitle>
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                When patients report the most pain
              </p>
            </CardHeader>
            <CardContent>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.day_of_week_pattern}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis domain={[0, 10]} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                    <Tooltip
                      contentStyle={{
                        background: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="avg_pain" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Avg Pain" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Patient Engagement Table */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-baseline justify-between">
                <CardTitle className="font-serif text-xl tracking-tightest">Patient engagement</CardTitle>
                <Link
                  to="/patients"
                  className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground"
                >
                  All patients →
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {data.patient_engagement.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No patient data yet</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/70">
                        <th className="pb-3 pr-4 text-left font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Patient</th>
                        <th className="pb-3 px-4 text-right font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Logs</th>
                        <th className="pb-3 px-4 text-right font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Avg Pain</th>
                        <th className="pb-3 px-4 text-right font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Trend</th>
                        <th className="pb-3 px-4 text-right font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Exercises</th>
                        <th className="pb-3 pl-4 text-right font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Last Active</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.patient_engagement.map((p) => (
                        <tr key={p.patient_id} className="border-b border-border/50 last:border-0">
                          <td className="py-3 pr-4">
                            <Link to={`/patients/${p.patient_id}`} className="group flex items-center gap-2 hover:text-accent">
                              <span className="flex h-7 w-7 items-center justify-center rounded-sm bg-secondary font-mono text-[10px] uppercase">
                                {p.first_name[0]}{p.last_name[0]}
                              </span>
                              <span className="font-serif tracking-tightest">{p.first_name} {p.last_name}</span>
                              <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-100" />
                            </Link>
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-xs">{p.logs_30d}</td>
                          <td className="py-3 px-4 text-right font-mono text-xs">{p.avg_pain.toFixed(1)}</td>
                          <td className="py-3 px-4 text-right">
                            <TrendIndicator value={p.pain_delta} invert compact />
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-xs">{p.exercises_completed_30d}</td>
                          <td className="py-3 pl-4 text-right font-mono text-[10px] text-muted-foreground">
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
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: string | number;
  sub: React.ReactNode;
  icon: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{label}</span>
          <span className="flex h-8 w-8 items-center justify-center rounded-sm bg-secondary text-muted-foreground">{icon}</span>
        </div>
        <div className="mt-3 font-serif text-4xl tracking-tightest">{value}</div>
        <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{sub}</div>
      </CardContent>
    </Card>
  );
}

function TrendIndicator({
  value,
  invert = false,
  compact = false,
}: {
  value: number;
  invert?: boolean;
  compact?: boolean;
}) {
  if (value === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-muted-foreground">
        <Minus className="h-3 w-3" />
        {!compact && <span className="font-mono text-[10px]">no change</span>}
      </span>
    );
  }

  const isPositive = value > 0;
  const isGood = invert ? !isPositive : isPositive;

  return (
    <span className={cn('inline-flex items-center gap-1', isGood ? 'text-emerald-600' : 'text-red-500')}>
      {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      <span className="font-mono text-[10px]">
        {isPositive ? '+' : ''}{value.toFixed(1)}
      </span>
    </span>
  );
}
