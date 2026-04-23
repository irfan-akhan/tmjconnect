import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo } from 'react';
import { format } from 'date-fns';
import { Activity, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { usePatientSymptoms } from '@/features/patients/detail-queries';
import { EmptyState, SkeletonList } from './shared';
function painChip(value) {
    if (value >= 7)
        return { bg: 'bg-destructive/10', fg: 'text-destructive' };
    if (value >= 4)
        return { bg: 'bg-accent/15', fg: 'text-accent' };
    return { bg: 'bg-secondary', fg: 'text-foreground' };
}
function SymptomItem({ log }) {
    const chip = painChip(log.pain_level);
    return (_jsxs("li", { className: "grid grid-cols-[auto_auto_1fr] items-start gap-6 border-t border-border/70 bg-card p-5 first:border-t-0", children: [_jsxs("div", { className: "w-16 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground", children: [format(new Date(log.logged_at), 'd MMM'), _jsx("div", { className: "mt-1 text-muted-foreground/60", children: format(new Date(log.logged_at), 'HH:mm') })] }), _jsx("div", { className: cn('flex h-12 w-12 items-center justify-center rounded-sm font-serif text-xl tracking-tightest', chip.bg, chip.fg), children: log.pain_level }), _jsxs("div", { className: "min-w-0 space-y-2", children: [_jsxs("div", { className: "flex flex-wrap gap-1.5", children: [log.pain_types.map((t) => (_jsx("span", { className: "rounded-sm border border-border bg-background px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground", children: t }, t))), log.body_areas.map((a, i) => (_jsxs("span", { className: "rounded-sm bg-secondary px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider", children: [a.area, a.side && _jsxs("span", { className: "text-muted-foreground", children: [" \u00B7 ", a.side] })] }, i))), log.duration_minutes != null && (_jsxs("span", { className: "inline-flex items-center gap-1 rounded-sm border border-border bg-background px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground", children: [_jsx(Clock, { className: "h-3 w-3" }), log.duration_minutes, "m"] }))] }), log.triggers.length > 0 && (_jsxs("div", { className: "font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground", children: ["Triggers \u00B7 ", _jsx("span", { className: "text-foreground normal-case tracking-normal", children: log.triggers.join(', ') })] })), log.notes && _jsx("p", { className: "text-sm leading-relaxed text-foreground", children: log.notes })] })] }));
}
export function SymptomsTab({ patientId }) {
    const q = usePatientSymptoms(patientId);
    const logs = useMemo(() => q.data?.pages.flatMap((p) => p.data) ?? [], [q.data]);
    if (q.isLoading)
        return _jsx(SkeletonList, {});
    if (q.isError) {
        return (_jsx("p", { className: "py-8 text-sm text-destructive", children: q.error instanceof Error ? q.error.message : 'Failed to load symptoms.' }));
    }
    if (logs.length === 0) {
        return _jsx(EmptyState, { icon: Activity, title: "No symptom logs yet.", body: "When the patient logs symptoms, they'll appear here." });
    }
    const max = Math.max(...logs.map((l) => l.pain_level), 1);
    return (_jsxs("div", { className: "space-y-10", children: [_jsxs("section", { className: "rounded-sm border border-border/70 bg-card p-8", children: [_jsxs("div", { className: "mb-6 flex items-baseline justify-between", children: [_jsx("h2", { className: "font-serif text-2xl tracking-tightest", children: "Pain over time" }), _jsxs("span", { className: "font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground", children: [logs.length, " logs"] })] }), _jsx("div", { className: "flex h-32 items-end gap-1", children: [...logs].reverse().map((l) => {
                            const h = (l.pain_level / max) * 100;
                            const tone = l.pain_level >= 7 ? 'bg-destructive' : l.pain_level >= 4 ? 'bg-accent' : 'bg-foreground/40';
                            return (_jsx("div", { className: cn('flex-1 rounded-t-sm transition-opacity hover:opacity-70', tone), style: { height: `${Math.max(h, 4)}%` }, title: `${format(new Date(l.logged_at), 'd MMM yyyy')} · Pain ${l.pain_level}` }, l.id));
                        }) })] }), _jsx("ol", { className: "space-y-px overflow-hidden rounded-sm border border-border/70", children: logs.map((l) => (_jsx(SymptomItem, { log: l }, l.id))) }), q.hasNextPage && (_jsx("div", { className: "flex justify-center", children: _jsx(Button, { variant: "outline", onClick: () => q.fetchNextPage(), disabled: q.isFetchingNextPage, children: q.isFetchingNextPage ? 'Loading…' : 'Load more' }) }))] }));
}
export default SymptomsTab;
