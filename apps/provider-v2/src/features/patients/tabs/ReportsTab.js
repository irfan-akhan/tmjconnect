import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { format, formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router-dom';
import { AlertTriangle, FileText, Flag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { usePatientReports } from '@/features/patients/detail-queries';
import { EmptyState, SkeletonList } from './shared';
export function ReportsTab({ patientId }) {
    const q = usePatientReports(patientId);
    if (q.isLoading)
        return _jsx(SkeletonList, {});
    if (q.isError) {
        return (_jsx("p", { className: "py-8 text-sm text-destructive", children: q.error instanceof Error ? q.error.message : 'Failed to load reports.' }));
    }
    const rows = q.data?.data ?? [];
    if (rows.length === 0) {
        return _jsx(EmptyState, { icon: FileText, title: "No reports filed.", body: "Reports submitted by this patient will stream into their chart here." });
    }
    return (_jsx("ol", { className: "overflow-hidden rounded-sm border border-border/70", children: rows.map((r) => (_jsx(ReportItem, { r: r }, r.id))) }));
}
function ReportItem({ r }) {
    const urgencyTone = r.urgency === 'urgent'
        ? 'text-destructive border-destructive/30'
        : r.urgency === 'concerning'
            ? 'text-accent border-accent/30'
            : 'text-muted-foreground border-border';
    const statusLabel = {
        submitted: 'Awaiting review',
        viewed: 'Opened',
        reviewed: 'Reviewed',
        responded: 'Responded',
    };
    return (_jsxs("li", { className: "grid grid-cols-[auto_auto_1fr_auto] items-start gap-5 border-t border-border/70 bg-card p-5 first:border-t-0", children: [_jsxs("div", { className: "w-16 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground", children: [format(new Date(r.submitted_at), 'd MMM'), _jsx("div", { className: "mt-1 text-muted-foreground/60", children: formatDistanceToNow(new Date(r.submitted_at), { addSuffix: true }) })] }), _jsxs("div", { className: cn('flex h-6 items-center rounded-sm border px-2 font-mono text-[10px] uppercase tracking-[0.18em]', urgencyTone), children: [r.urgency === 'urgent' && _jsx(AlertTriangle, { className: "mr-1 h-3 w-3" }), r.urgency] }), _jsxs("div", { className: "min-w-0 space-y-1", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground", children: statusLabel[r.status] }), r.flagged && _jsx(Flag, { className: "h-3 w-3 fill-accent stroke-accent" }), r.pain_level != null && (_jsxs("span", { className: "font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground", children: ["\u00B7 Pain ", r.pain_level] }))] }), r.description_preview && (_jsx("p", { className: "line-clamp-2 text-sm leading-relaxed text-foreground", children: r.description_preview }))] }), _jsx(Button, { asChild: true, variant: "outline", size: "sm", children: _jsx(Link, { to: `/reports/${r.id}`, children: "Open" }) })] }));
}
export default ReportsTab;
