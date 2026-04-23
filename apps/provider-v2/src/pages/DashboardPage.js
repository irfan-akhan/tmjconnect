import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { differenceInDays, formatDistanceToNow } from 'date-fns';
import { ArrowRight, Download, Inbox, TriangleAlert, UserPlus, Users, } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage, initials } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { FilterPill } from '@/components/ui/filter-pill';
import { KpiCard } from '@/components/ui/kpi-card';
import { PageHeader } from '@/components/ui/page-header';
import { Sparkline } from '@/components/ui/sparkline';
import { useAuth } from '@/features/auth/AuthProvider';
import { useDashboardSummary } from '@/features/dashboard/queries';
function painSeverity(value) {
    if (value == null)
        return { variant: 'inactive', label: 'No data' };
    if (value >= 7)
        return { variant: 'urgent', label: 'Urgent' };
    if (value >= 4)
        return { variant: 'moderate', label: 'Moderate' };
    if (value > 0)
        return { variant: 'stable', label: 'Stable' };
    return { variant: 'improving', label: 'Improving' };
}
function bucketFor(p) {
    const buckets = ['all'];
    const isUrgent = (p.avg_pain_7d ?? 0) >= 7;
    const lastDays = p.last_symptom_at ? differenceInDays(new Date(), new Date(p.last_symptom_at)) : null;
    if (isUrgent)
        buckets.push('attention');
    if (lastDays != null && lastDays <= 3)
        buckets.push('recent');
    if (lastDays == null || lastDays > 7)
        buckets.push('inactive');
    return buckets;
}
export function DashboardPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { data, isLoading } = useDashboardSummary();
    const [filter, setFilter] = useState('all');
    const greeting = (() => {
        const h = new Date().getHours();
        if (h < 5)
            return 'Working late';
        if (h < 12)
            return 'Good morning';
        if (h < 18)
            return 'Good afternoon';
        return 'Good evening';
    })();
    const today = new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
    });
    const urgentCount = useMemo(() => data.recentPatients.filter((p) => (p.avg_pain_7d ?? 0) >= 7).length, [data.recentPatients]);
    const inactiveCount = useMemo(() => data.recentPatients.filter((p) => !p.last_symptom_at || differenceInDays(new Date(), new Date(p.last_symptom_at)) > 7).length, [data.recentPatients]);
    const recentCount = useMemo(() => data.recentPatients.filter((p) => p.last_symptom_at && differenceInDays(new Date(), new Date(p.last_symptom_at)) <= 3).length, [data.recentPatients]);
    const filteredRows = useMemo(() => data.recentPatients.filter((p) => bucketFor(p).includes(filter)), [data.recentPatients, filter]);
    const columns = [
        {
            key: 'patient',
            header: 'Patient',
            cell: (p) => (_jsxs("div", { className: "flex items-center gap-3", children: [_jsxs(Avatar, { size: "sm", children: [p.avatar_url && _jsx(AvatarImage, { src: p.avatar_url, alt: "" }), _jsx(AvatarFallback, { children: initials(p.first_name, p.last_name) })] }), _jsxs("div", { className: "min-w-0", children: [_jsxs("div", { className: "truncate font-serif text-base tracking-tightest", children: [p.first_name, " ", p.last_name] }), _jsx("div", { className: "truncate font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground", children: p.last_symptom_at
                                    ? `Last log ${formatDistanceToNow(new Date(p.last_symptom_at), { addSuffix: true })}`
                                    : 'No logs yet' })] })] })),
        },
        {
            key: 'pain',
            header: '7-day pain',
            align: 'right',
            width: '110px',
            cell: (p) => (_jsx("span", { className: "font-serif text-lg tracking-tightest text-foreground", children: p.avg_pain_7d != null ? p.avg_pain_7d.toFixed(1) : '—' })),
        },
        {
            key: 'trend',
            header: '14-day trend',
            width: '160px',
            // TODO(api): backend doesn't return time-series yet; sparkline shows
            // empty state until the patient list endpoint exposes daily pain values.
            cell: () => _jsx(Sparkline, { data: [], height: 28 }),
        },
        {
            key: 'status',
            header: 'Status',
            width: '120px',
            cell: (p) => {
                const sev = painSeverity(p.avg_pain_7d);
                return _jsx(Badge, { variant: sev.variant, children: sev.label });
            },
        },
        {
            key: 'action',
            header: '',
            width: '40px',
            align: 'right',
            cell: () => _jsx(ArrowRight, { className: "ml-auto h-4 w-4 text-muted-foreground" }),
        },
    ];
    return (_jsxs("div", { className: "mx-auto max-w-7xl space-y-8", children: [_jsx(PageHeader, { eyebrow: today, title: _jsxs(_Fragment, { children: [greeting, ",", ' ', _jsxs("em", { className: "not-italic text-gold-700", children: ["Dr. ", user?.firstName ?? 'Provider', "."] })] }), description: urgentCount > 0
                    ? `${urgentCount} patient${urgentCount === 1 ? '' : 's'} flagged urgent — start with the inbox.`
                    : 'No urgent flags right now. A calm day ahead.', actions: _jsxs(_Fragment, { children: [_jsxs(Button, { variant: "outline", size: "sm", children: [_jsx(Download, { className: "mr-2 h-3.5 w-3.5" }), "Export"] }), _jsxs(Button, { size: "sm", onClick: () => navigate('/linking'), children: [_jsx(UserPlus, { className: "mr-2 h-3.5 w-3.5" }), "Invite patient"] })] }) }), _jsxs("div", { className: "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4", children: [_jsx(KpiCard, { label: "Total patients", value: isLoading ? '—' : data.activePatients, icon: _jsx(Users, { className: "h-4 w-4" }), 
                        // TODO(api): no period-over-period delta yet; hint is static.
                        hint: "Linked to your practice" }), _jsx(KpiCard, { accent: "gold", label: "Reports awaiting", value: isLoading ? '—' : data.unreadReports, icon: _jsx(Inbox, { className: "h-4 w-4" }), hint: "In your inbox" }), _jsx(KpiCard, { accent: "urgent", label: "Urgent (pain \u22657)", value: isLoading ? '—' : urgentCount, icon: _jsx(TriangleAlert, { className: "h-4 w-4" }), hint: "Triage these first" }), _jsx(KpiCard, { accent: "ok", label: "Pending invites", value: isLoading ? '—' : data.pendingCodes, hint: "Linking codes unaccepted" })] }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx(FilterPill, { active: filter === 'all', count: data.recentPatients.length, onClick: () => setFilter('all'), children: "All" }), _jsx(FilterPill, { urgent: true, active: filter === 'attention', count: urgentCount, onClick: () => setFilter('attention'), children: "Needs attention" }), _jsx(FilterPill, { active: filter === 'recent', count: recentCount, onClick: () => setFilter('recent'), children: "Recent activity" }), _jsx(FilterPill, { active: filter === 'inactive', count: inactiveCount, onClick: () => setFilter('inactive'), children: "No activity \u00B7 7d" })] }), _jsx(DataTable, { columns: columns, rows: filteredRows, rowKey: (p) => p.patient_id, loading: isLoading, onRowClick: (p) => navigate(`/patients/${p.patient_id}`), rowClassName: (p) => ((p.avg_pain_7d ?? 0) >= 7 ? 'bg-err/5 hover:bg-err/10' : undefined), emptyState: _jsx("div", { className: "text-center font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground", children: "No patients match this filter." }) })] })] }));
}
