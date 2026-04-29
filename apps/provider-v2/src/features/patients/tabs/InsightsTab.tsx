import { useState } from 'react';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Cell,
} from 'recharts';
import { Activity, Dumbbell, TrendingUp, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usePatientAnalytics } from '@/features/patients/detail-queries';

const RANGES = [
  { label: '7d', value: 7 },
  { label: '30d', value: 30 },
  { label: '90d', value: 90 },
] as const;

export default function InsightsTab({ patientId }: { patientId: string }) {
  const [days, setDays] = useState(30);
  const { data, isLoading } = usePatientAnalytics(patientId, days);

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-48 animate-pulse rounded-sm bg-secondary" />
        ))}
      </div>
    );
  }

  if (!data) return null;

  const tooltipStyle = {
    background: 'hsl(var(--card))',
    border: '1px solid hsl(var(--border))',
    borderRadius: 8,
    fontSize: 12,
  };

  return (
    <div className="space-y-6">
      {/* Time range selector */}
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-xl tracking-tightest">Patient insights</h3>
        <div className="flex gap-1 rounded-sm border border-border/70 bg-card p-1">
          {RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => setDays(r.value)}
              className={cn(
                'rounded-sm px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] transition-colors',
                days === r.value
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-4 gap-3">
        <MiniKpi label="Avg Pain" value={data.pain_summary.avg_pain.toFixed(1)} sub={`${data.pain_summary.total_logs} logs`}
          icon={<Activity className="h-4 w-4" />}
          tone={data.pain_summary.avg_pain >= 6 ? 'destructive' : data.pain_summary.avg_pain >= 4 ? 'accent' : 'primary'} />
        <MiniKpi label="Min / Max" value={`${data.pain_summary.min_pain} – ${data.pain_summary.max_pain}`} sub="pain range"
          icon={data.pain_summary.max_pain >= 7 ? <TrendingUp className="h-4 w-4" /> : <Minus className="h-4 w-4" />} />
        <MiniKpi label="Compliance" value={`${data.exercise_compliance.rate}%`} sub={`${data.exercise_compliance.completed} completions`}
          icon={<Dumbbell className="h-4 w-4" />}
          tone={data.exercise_compliance.rate >= 70 ? 'primary' : data.exercise_compliance.rate >= 40 ? 'accent' : 'destructive'} />
        <MiniKpi label="Active Exercises" value={String(data.exercise_compliance.assigned)} sub="assigned"
          icon={<Dumbbell className="h-4 w-4" />} />
      </div>

      {/* Pain trend chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="font-serif text-lg tracking-tightest">Pain trend</CardTitle>
        </CardHeader>
        <CardContent>
          {data.pain_trend.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No symptom logs in this period</p>
          ) : (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.pain_trend}>
                  <defs>
                    <linearGradient id="ptPainFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v: string) => v.slice(5)} />
                  <YAxis domain={[0, 10]} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="pain_level" stroke="hsl(var(--accent))" strokeWidth={2} fill="url(#ptPainFill)" name="Pain" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Triggers + Body areas */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-serif text-lg tracking-tightest">Top triggers</CardTitle>
          </CardHeader>
          <CardContent>
            {data.trigger_frequency.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No triggers recorded</p>
            ) : (
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.trigger_frequency} layout="vertical" margin={{ left: 60 }}>
                    <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis type="category" dataKey="trigger" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} width={60} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name="Count" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-serif text-lg tracking-tightest">Pain by day of week</CardTitle>
          </CardHeader>
          <CardContent>
            {data.day_of_week.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Not enough data</p>
            ) : (
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.day_of_week}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis domain={[0, 10]} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="avg_pain" radius={[4, 4, 0, 0]} name="Avg Pain">
                      {data.day_of_week.map((entry, i) => (
                        <Cell key={i} fill={entry.avg_pain >= 6 ? 'hsl(var(--destructive))' : entry.avg_pain >= 4 ? 'hsl(var(--accent))' : 'hsl(var(--primary))'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Body areas */}
      {data.body_area_frequency.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-serif text-lg tracking-tightest">Most affected areas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {data.body_area_frequency.map((a) => (
                <div key={a.area} className="inline-flex items-center gap-2 rounded-sm border border-border/70 bg-secondary/30 px-3 py-1.5">
                  <span className="text-sm capitalize">{a.area}</span>
                  <span className="font-mono text-xs text-muted-foreground">{a.count}x</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function MiniKpi({
  label, value, sub, icon, tone = 'primary',
}: {
  label: string; value: string; sub: string; icon: React.ReactNode;
  tone?: 'primary' | 'accent' | 'destructive';
}) {
  return (
    <div className="rounded-sm border border-border/70 bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">{label}</span>
        <span className={cn('text-muted-foreground', tone === 'destructive' && 'text-destructive', tone === 'accent' && 'text-accent')}>{icon}</span>
      </div>
      <div className="mt-2 font-serif text-2xl tracking-tightest">{value}</div>
      <div className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">{sub}</div>
    </div>
  );
}
