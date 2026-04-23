import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, } from 'recharts';
import { Activity, Dumbbell, TrendingUp, Minus } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
function usePatientAnalytics(patientId, days) {
    return useQuery({
        queryKey: ['patient-analytics', patientId, days],
        queryFn: () => apiFetch(`/providers/patients/${patientId}/analytics`, {
            query: { days },
        }).then((r) => r.data),
        staleTime: 5 * 60_000,
    });
}
const RANGES = [
    { label: '7d', value: 7 },
    { label: '30d', value: 30 },
    { label: '90d', value: 90 },
];
export default function InsightsTab({ patientId }) {
    const [days, setDays] = useState(30);
    const { data, isLoading } = usePatientAnalytics(patientId, days);
    if (isLoading) {
        return (_jsx("div", { className: "grid gap-4 md:grid-cols-2", children: Array.from({ length: 4 }).map((_, i) => (_jsx("div", { className: "h-48 animate-pulse rounded-sm bg-secondary" }, i))) }));
    }
    if (!data)
        return null;
    const tooltipStyle = {
        background: 'hsl(var(--card))',
        border: '1px solid hsl(var(--border))',
        borderRadius: 8,
        fontSize: 12,
    };
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h3", { className: "font-serif text-xl tracking-tightest", children: "Patient insights" }), _jsx("div", { className: "flex gap-1 rounded-sm border border-border/70 bg-card p-1", children: RANGES.map((r) => (_jsx("button", { onClick: () => setDays(r.value), className: cn('rounded-sm px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] transition-colors', days === r.value
                                ? 'bg-primary text-primary-foreground'
                                : 'text-muted-foreground hover:bg-secondary hover:text-foreground'), children: r.label }, r.value))) })] }), _jsxs("div", { className: "grid grid-cols-4 gap-3", children: [_jsx(MiniKpi, { label: "Avg Pain", value: data.pain_summary.avg_pain.toFixed(1), sub: `${data.pain_summary.total_logs} logs`, icon: _jsx(Activity, { className: "h-4 w-4" }), tone: data.pain_summary.avg_pain >= 6 ? 'destructive' : data.pain_summary.avg_pain >= 4 ? 'accent' : 'primary' }), _jsx(MiniKpi, { label: "Min / Max", value: `${data.pain_summary.min_pain} – ${data.pain_summary.max_pain}`, sub: "pain range", icon: data.pain_summary.max_pain >= 7 ? _jsx(TrendingUp, { className: "h-4 w-4" }) : _jsx(Minus, { className: "h-4 w-4" }) }), _jsx(MiniKpi, { label: "Compliance", value: `${data.exercise_compliance.rate}%`, sub: `${data.exercise_compliance.completed} completions`, icon: _jsx(Dumbbell, { className: "h-4 w-4" }), tone: data.exercise_compliance.rate >= 70 ? 'primary' : data.exercise_compliance.rate >= 40 ? 'accent' : 'destructive' }), _jsx(MiniKpi, { label: "Active Exercises", value: String(data.exercise_compliance.assigned), sub: "assigned", icon: _jsx(Dumbbell, { className: "h-4 w-4" }) })] }), _jsxs(Card, { children: [_jsx(CardHeader, { className: "pb-2", children: _jsx(CardTitle, { className: "font-serif text-lg tracking-tightest", children: "Pain trend" }) }), _jsx(CardContent, { children: data.pain_trend.length === 0 ? (_jsx("p", { className: "py-8 text-center text-sm text-muted-foreground", children: "No symptom logs in this period" })) : (_jsx("div", { className: "h-48", children: _jsx(ResponsiveContainer, { width: "100%", height: "100%", children: _jsxs(AreaChart, { data: data.pain_trend, children: [_jsx("defs", { children: _jsxs("linearGradient", { id: "ptPainFill", x1: "0", y1: "0", x2: "0", y2: "1", children: [_jsx("stop", { offset: "5%", stopColor: "hsl(var(--accent))", stopOpacity: 0.3 }), _jsx("stop", { offset: "95%", stopColor: "hsl(var(--accent))", stopOpacity: 0 })] }) }), _jsx(CartesianGrid, { strokeDasharray: "3 3", stroke: "hsl(var(--border))" }), _jsx(XAxis, { dataKey: "date", tick: { fontSize: 10, fill: 'hsl(var(--muted-foreground))' }, tickFormatter: (v) => v.slice(5) }), _jsx(YAxis, { domain: [0, 10], tick: { fontSize: 10, fill: 'hsl(var(--muted-foreground))' } }), _jsx(Tooltip, { contentStyle: tooltipStyle }), _jsx(Area, { type: "monotone", dataKey: "pain_level", stroke: "hsl(var(--accent))", strokeWidth: 2, fill: "url(#ptPainFill)", name: "Pain" })] }) }) })) })] }), _jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [_jsxs(Card, { children: [_jsx(CardHeader, { className: "pb-2", children: _jsx(CardTitle, { className: "font-serif text-lg tracking-tightest", children: "Top triggers" }) }), _jsx(CardContent, { children: data.trigger_frequency.length === 0 ? (_jsx("p", { className: "py-6 text-center text-sm text-muted-foreground", children: "No triggers recorded" })) : (_jsx("div", { className: "h-40", children: _jsx(ResponsiveContainer, { width: "100%", height: "100%", children: _jsxs(BarChart, { data: data.trigger_frequency, layout: "vertical", margin: { left: 60 }, children: [_jsx(XAxis, { type: "number", tick: { fontSize: 10, fill: 'hsl(var(--muted-foreground))' } }), _jsx(YAxis, { type: "category", dataKey: "trigger", tick: { fontSize: 11, fill: 'hsl(var(--muted-foreground))' }, width: 60 }), _jsx(Tooltip, { contentStyle: tooltipStyle }), _jsx(Bar, { dataKey: "count", fill: "hsl(var(--primary))", radius: [0, 4, 4, 0], name: "Count" })] }) }) })) })] }), _jsxs(Card, { children: [_jsx(CardHeader, { className: "pb-2", children: _jsx(CardTitle, { className: "font-serif text-lg tracking-tightest", children: "Pain by day of week" }) }), _jsx(CardContent, { children: data.day_of_week.length === 0 ? (_jsx("p", { className: "py-6 text-center text-sm text-muted-foreground", children: "Not enough data" })) : (_jsx("div", { className: "h-40", children: _jsx(ResponsiveContainer, { width: "100%", height: "100%", children: _jsxs(BarChart, { data: data.day_of_week, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3", stroke: "hsl(var(--border))" }), _jsx(XAxis, { dataKey: "day", tick: { fontSize: 11, fill: 'hsl(var(--muted-foreground))' } }), _jsx(YAxis, { domain: [0, 10], tick: { fontSize: 10, fill: 'hsl(var(--muted-foreground))' } }), _jsx(Tooltip, { contentStyle: tooltipStyle }), _jsx(Bar, { dataKey: "avg_pain", radius: [4, 4, 0, 0], name: "Avg Pain", children: data.day_of_week.map((entry, i) => (_jsx(Cell, { fill: entry.avg_pain >= 6 ? 'hsl(var(--destructive))' : entry.avg_pain >= 4 ? 'hsl(var(--accent))' : 'hsl(var(--primary))' }, i))) })] }) }) })) })] })] }), data.body_area_frequency.length > 0 && (_jsxs(Card, { children: [_jsx(CardHeader, { className: "pb-2", children: _jsx(CardTitle, { className: "font-serif text-lg tracking-tightest", children: "Most affected areas" }) }), _jsx(CardContent, { children: _jsx("div", { className: "flex flex-wrap gap-2", children: data.body_area_frequency.map((a) => (_jsxs("div", { className: "inline-flex items-center gap-2 rounded-sm border border-border/70 bg-secondary/30 px-3 py-1.5", children: [_jsx("span", { className: "text-sm capitalize", children: a.area }), _jsxs("span", { className: "font-mono text-xs text-muted-foreground", children: [a.count, "x"] })] }, a.area))) }) })] }))] }));
}
function MiniKpi({ label, value, sub, icon, tone = 'primary', }) {
    return (_jsxs("div", { className: "rounded-sm border border-border/70 bg-card p-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground", children: label }), _jsx("span", { className: cn('text-muted-foreground', tone === 'destructive' && 'text-destructive', tone === 'accent' && 'text-accent'), children: icon })] }), _jsx("div", { className: "mt-2 font-serif text-2xl tracking-tightest", children: value }), _jsx("div", { className: "mt-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground", children: sub })] }));
}
