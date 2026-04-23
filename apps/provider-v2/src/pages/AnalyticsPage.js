import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { Activity, ArrowDownRight, ArrowRight, ArrowUpRight, BarChart3, Download, Dumbbell, Minus, Users, } from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis, } from 'recharts';
import { Avatar, AvatarFallback, initials } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { KpiCard } from '@/components/ui/kpi-card';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useProviderAnalytics } from '@/features/analytics/queries';
const TIME_RANGES = [
    { label: '7D', value: 7 },
    { label: '30D', value: 30 },
    { label: '90D', value: 90 },
];
const NAVY = 'hsl(210 53% 23%)';
const GOLD = 'hsl(38 66% 55%)';
const ERR = 'hsl(0 53% 48%)';
const WARN = 'hsl(31 80% 44%)';
const OK = 'hsl(154 70% 32%)';
const BORDER = 'hsl(220 18% 88%)';
const MUTED = 'hsl(220 12% 42%)';
export function AnalyticsPage() {
    const [days, setDays] = useState(30);
    const { data, isLoading } = useProviderAnalytics(days);
    return (_jsxs("div", { className: "mx-auto max-w-7xl space-y-6", children: [_jsx(PageHeader, { eyebrow: "Workspace \u00B7 Analytics", title: _jsxs(_Fragment, { children: ["Practice ", _jsx("em", { className: "not-italic text-gold-700", children: "insights." })] }), description: _jsxs(_Fragment, { children: ["Cross-patient analytics \u00B7", ' ', _jsx("span", { className: "text-foreground", children: "Last updated just now" })] }), actions: _jsxs(_Fragment, { children: [_jsxs(Button, { variant: "outline", size: "sm", children: [_jsx(Download, { className: "mr-2 h-3.5 w-3.5" }), "Export"] }), _jsx("div", { className: "inline-flex rounded-sm border border-border bg-card p-1", children: TIME_RANGES.map((r) => (_jsx("button", { onClick: () => setDays(r.value), className: cn('rounded-sm px-3 py-1 font-mono text-[11px] uppercase tracking-[0.18em] transition-colors', days === r.value
                                    ? 'bg-navy-600 text-background'
                                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'), children: r.label }, r.value))) })] }) }), isLoading ? (_jsxs("div", { className: "space-y-6", children: [_jsx("div", { className: "grid gap-4 sm:grid-cols-2 lg:grid-cols-4", children: Array.from({ length: 4 }).map((_, i) => (_jsx(Skeleton, { className: "h-28" }, i))) }), _jsx(Skeleton, { className: "h-72" }), _jsx(Skeleton, { className: "h-56" })] })) : !data ? (_jsx(EmptyState, { title: "Analytics aren't ready yet.", description: "Once your patients start logging symptoms, this dashboard will fill in." })) : (_jsxs(_Fragment, { children: [_jsxs("div", { className: "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4", children: [_jsx(KpiCard, { label: "Total patients", value: data.overview.total_patients, icon: _jsx(Users, { className: "h-4 w-4" }), hint: `${data.overview.active_patients_7d} active this week` }), _jsx(KpiCard, { accent: "urgent", label: "Avg pain level", value: data.overview.avg_pain_level.toFixed(1), icon: _jsx(Activity, { className: "h-4 w-4" }), trend: data.overview.avg_pain_trend < 0 ? 'down' : data.overview.avg_pain_trend > 0 ? 'up' : 'flat', delta: `${data.overview.avg_pain_trend > 0 ? '+' : ''}${data.overview.avg_pain_trend.toFixed(1)} vs prior` }), _jsx(KpiCard, { accent: "navy", label: "Symptom logs", value: data.overview.total_logs_30d.toLocaleString(), icon: _jsx(BarChart3, { className: "h-4 w-4" }), hint: `In last ${days} days` }), _jsx(KpiCard, { accent: "gold", label: "Exercise compliance", value: `${data.overview.exercise_compliance_pct}%`, icon: _jsx(Dumbbell, { className: "h-4 w-4" }), hint: "Assignments completed" })] }), _jsxs("div", { className: "grid gap-4 lg:grid-cols-[2fr_1fr]", children: [_jsx(Card, { title: "Pain trend", subtitle: `Cross-patient average over ${days} days`, children: _jsx("div", { className: "h-64", children: _jsx(ResponsiveContainer, { width: "100%", height: "100%", children: _jsxs(AreaChart, { data: data.pain_trend, children: [_jsx("defs", { children: _jsxs("linearGradient", { id: "painArea", x1: "0", y1: "0", x2: "0", y2: "1", children: [_jsx("stop", { offset: "5%", stopColor: GOLD, stopOpacity: 0.35 }), _jsx("stop", { offset: "95%", stopColor: GOLD, stopOpacity: 0 })] }) }), _jsx(CartesianGrid, { strokeDasharray: "3 3", stroke: BORDER }), _jsx(XAxis, { dataKey: "date", tick: { fontSize: 10, fill: MUTED, fontFamily: 'JetBrains Mono' }, tickFormatter: (v) => v.slice(5) }), _jsx(YAxis, { domain: [0, 10], tick: { fontSize: 10, fill: MUTED, fontFamily: 'JetBrains Mono' } }), _jsx(Tooltip, { contentStyle: {
                                                        background: 'hsl(36 40% 100%)',
                                                        border: `1px solid ${BORDER}`,
                                                        borderRadius: 4,
                                                        fontSize: 12,
                                                    } }), _jsx(Area, { type: "monotone", dataKey: "avg_pain", stroke: GOLD, strokeWidth: 2, fill: "url(#painArea)", name: "Avg pain" })] }) }) }) }), _jsx(Card, { title: "Top triggers", subtitle: "What's setting symptoms off", children: data.trigger_distribution.length === 0 ? (_jsx("p", { className: "py-8 text-center text-sm text-muted-foreground", children: "No trigger data yet." })) : (_jsx("ul", { className: "space-y-3", children: data.trigger_distribution.slice(0, 8).map((t) => (_jsxs("li", { children: [_jsxs("div", { className: "mb-1 flex items-baseline justify-between", children: [_jsx("span", { className: "text-sm capitalize text-foreground", children: t.trigger }), _jsxs("span", { className: "font-mono text-[10px] uppercase tracking-wider text-muted-foreground", children: [t.pct, "%"] })] }), _jsx("div", { className: "h-1.5 w-full overflow-hidden rounded-sm bg-secondary", children: _jsx("div", { className: "h-full rounded-sm bg-gold-600 transition-all", style: { width: `${t.pct}%` } }) })] }, t.trigger))) })) })] }), _jsxs("div", { className: "grid gap-4 lg:grid-cols-2", children: [_jsxs(Card, { title: "Pain distribution", subtitle: "Frequency by severity level", children: [_jsx("div", { className: "h-48", children: _jsx(ResponsiveContainer, { width: "100%", height: "100%", children: _jsxs(BarChart, { data: data.pain_distribution, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3", stroke: BORDER }), _jsx(XAxis, { dataKey: "level", tick: { fontSize: 10, fill: MUTED, fontFamily: 'JetBrains Mono' } }), _jsx(YAxis, { tick: { fontSize: 10, fill: MUTED, fontFamily: 'JetBrains Mono' } }), _jsx(Tooltip, { contentStyle: {
                                                            background: 'hsl(36 40% 100%)',
                                                            border: `1px solid ${BORDER}`,
                                                            borderRadius: 4,
                                                            fontSize: 12,
                                                        } }), _jsx(Bar, { dataKey: "count", radius: [2, 2, 0, 0], name: "Logs", children: data.pain_distribution.map((entry) => (_jsx(Cell, { fill: entry.level >= 7 ? ERR : entry.level >= 4 ? WARN : OK }, entry.level))) })] }) }) }), _jsxs("div", { className: "mt-3 flex items-center justify-center gap-4 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground", children: [_jsx(LegendDot, { color: "bg-ok", label: "Mild \u00B7 0\u20133" }), _jsx(LegendDot, { color: "bg-warn", label: "Moderate \u00B7 4\u20136" }), _jsx(LegendDot, { color: "bg-err", label: "Severe \u00B7 7\u201310" })] })] }), _jsxs(Card, { title: "Exercise impact", subtitle: "Pain on exercise days vs non-exercise days", children: [_jsxs("div", { className: "grid grid-cols-2 gap-4 py-2", children: [_jsx(ImpactPanel, { variant: "positive", icon: _jsx(Dumbbell, { className: "h-4 w-4" }), value: data.exercise_impact.with_exercise_avg_pain.toFixed(1), label: "With exercises", meta: `${data.exercise_impact.with_exercise_days} days` }), _jsx(ImpactPanel, { variant: "negative", icon: _jsx(Minus, { className: "h-4 w-4" }), value: data.exercise_impact.without_exercise_avg_pain.toFixed(1), label: "Without exercises", meta: `${data.exercise_impact.without_exercise_days} days` })] }), data.exercise_impact.with_exercise_avg_pain > 0 &&
                                        data.exercise_impact.without_exercise_avg_pain > 0 && (_jsxs("div", { className: "mt-2 rounded-sm border border-ok/30 bg-ok/5 px-3 py-2 text-center text-sm text-ok-dark", children: ["Exercises reduce pain by", ' ', _jsxs("strong", { children: [(data.exercise_impact.without_exercise_avg_pain -
                                                        data.exercise_impact.with_exercise_avg_pain).toFixed(1), ' ', "pts"] }), ' ', "on average"] }))] })] }), _jsx(Card, { title: "Day-of-week pattern", subtitle: "When patients report the most pain", children: _jsx("div", { className: "h-48", children: _jsx(ResponsiveContainer, { width: "100%", height: "100%", children: _jsxs(BarChart, { data: data.day_of_week_pattern, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3", stroke: BORDER }), _jsx(XAxis, { dataKey: "day", tick: { fontSize: 11, fill: MUTED, fontFamily: 'JetBrains Mono' } }), _jsx(YAxis, { domain: [0, 10], tick: { fontSize: 10, fill: MUTED, fontFamily: 'JetBrains Mono' } }), _jsx(Tooltip, { contentStyle: {
                                                background: 'hsl(36 40% 100%)',
                                                border: `1px solid ${BORDER}`,
                                                borderRadius: 4,
                                                fontSize: 12,
                                            } }), _jsx(Bar, { dataKey: "avg_pain", fill: NAVY, radius: [2, 2, 0, 0], name: "Avg pain" })] }) }) }) }), _jsx(Card, { title: "Patient engagement", subtitle: "Who's logging, how often", action: _jsxs(Link, { to: "/patients", className: "inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground", children: ["All patients", _jsx(ArrowRight, { className: "h-3 w-3" })] }), children: data.patient_engagement.length === 0 ? (_jsx("p", { className: "py-8 text-center text-sm text-muted-foreground", children: "No patient data yet." })) : (_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b border-border/60", children: [_jsx(Th, { children: "Patient" }), _jsx(Th, { align: "right", children: "Logs" }), _jsx(Th, { align: "right", children: "Avg pain" }), _jsx(Th, { align: "right", children: "Trend" }), _jsx(Th, { align: "right", children: "Exercises done" }), _jsx(Th, { align: "right", children: "Last active" })] }) }), _jsx("tbody", { children: data.patient_engagement.map((p) => (_jsxs("tr", { className: "border-b border-border/40 last:border-b-0", children: [_jsx("td", { className: "py-3 pr-4", children: _jsxs(Link, { to: `/patients/${p.patient_id}`, className: "group flex items-center gap-3 hover:text-foreground", children: [_jsx(Avatar, { size: "sm", children: _jsx(AvatarFallback, { children: initials(p.first_name, p.last_name) }) }), _jsxs("span", { className: "font-serif text-sm tracking-tightest", children: [p.first_name, " ", p.last_name] }), _jsx(ArrowUpRight, { className: "h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" })] }) }), _jsx("td", { className: "py-3 text-right font-mono text-xs", children: p.logs_30d }), _jsx("td", { className: "py-3 text-right", children: _jsx("span", { className: cn('font-serif text-base tracking-tightest', p.avg_pain >= 7
                                                            ? 'text-err-dark'
                                                            : p.avg_pain >= 4
                                                                ? 'text-warn-dark'
                                                                : 'text-ok-dark'), children: p.avg_pain.toFixed(1) }) }), _jsx("td", { className: "py-3 text-right", children: _jsx(TrendCell, { value: p.pain_delta }) }), _jsx("td", { className: "py-3 text-right font-mono text-xs", children: p.exercises_completed_30d }), _jsx("td", { className: "py-3 text-right font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground", children: p.last_log_at
                                                        ? formatDistanceToNow(new Date(p.last_log_at), { addSuffix: true })
                                                        : '—' })] }, p.patient_id))) })] }) })) })] }))] }));
}
function Card({ title, subtitle, action, children, }) {
    return (_jsxs("section", { className: "rounded-sm border border-border/70 bg-card p-5 shadow-navy-xs", children: [_jsxs("div", { className: "mb-4 flex items-start justify-between gap-3", children: [_jsxs("div", { children: [_jsx("h3", { className: "font-serif text-xl tracking-tightest", children: title }), subtitle && (_jsx("p", { className: "mt-0.5 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground", children: subtitle }))] }), action] }), children] }));
}
function Th({ children, align }) {
    return (_jsx("th", { className: cn('pb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground', align === 'right' && 'text-right'), children: children }));
}
function LegendDot({ color, label }) {
    return (_jsxs("span", { className: "inline-flex items-center gap-1.5", children: [_jsx("span", { className: cn('h-2 w-2 rounded-sm', color) }), label] }));
}
function ImpactPanel({ variant, icon, value, label, meta, }) {
    return (_jsxs("div", { className: cn('flex flex-col items-center gap-2 rounded-sm border p-4 text-center', variant === 'positive' ? 'border-navy-600/30 bg-navy-50/40' : 'border-err/30 bg-err/5'), children: [_jsx("span", { className: cn('flex h-9 w-9 items-center justify-center rounded-sm', variant === 'positive' ? 'bg-navy-600 text-background' : 'bg-err text-background'), children: icon }), _jsx("div", { className: cn('font-serif text-3xl tracking-tightest', variant === 'positive' ? 'text-navy-700' : 'text-err-dark'), children: value }), _jsxs("div", { className: "font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground", children: [label, " \u00B7 ", meta] })] }));
}
function TrendCell({ value }) {
    if (value === 0)
        return (_jsxs("span", { className: "inline-flex items-center gap-1 font-mono text-[10px] text-muted-foreground", children: [_jsx(Minus, { className: "h-3 w-3" }), "flat"] }));
    const up = value > 0;
    // For pain: up is bad, down is good.
    return (_jsxs("span", { className: cn('inline-flex items-center gap-1 font-mono text-[10px]', up ? 'text-err-dark' : 'text-ok-dark'), children: [up ? _jsx(ArrowUpRight, { className: "h-3 w-3" }) : _jsx(ArrowDownRight, { className: "h-3 w-3" }), up ? '+' : '', value.toFixed(1)] }));
}
// Badge import kept available for future status pills inside cards.
export const _Badge = Badge;
