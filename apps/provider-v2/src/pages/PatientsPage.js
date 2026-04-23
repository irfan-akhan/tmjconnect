import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { differenceInDays, format, formatDistanceToNow } from 'date-fns';
import { ArrowRight, Download, Inbox, Search, TriangleAlert, UserPlus, Users, } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage, initials } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { FilterPill } from '@/components/ui/filter-pill';
import { Input } from '@/components/ui/input';
import { KpiCard } from '@/components/ui/kpi-card';
import { PageHeader } from '@/components/ui/page-header';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkline } from '@/components/ui/sparkline';
import { useDebounced } from '@/hooks/useDebounced';
import { usePatients } from '@/features/patients/queries';
import { cn } from '@/lib/utils';
const LIMIT = 10;
const SORT_OPTIONS = [
    { value: 'urgency', label: 'Urgency (high to low)' },
    { value: 'recent', label: 'Most recent activity' },
    { value: 'pain', label: 'Highest 7-day pain' },
    { value: 'name', label: 'Name (A → Z)' },
];
function painTone(value) {
    if (value == null)
        return { variant: 'inactive', label: 'Inactive', color: 'text-muted-foreground' };
    if (value >= 7)
        return { variant: 'urgent', label: 'Urgent', color: 'text-err-dark' };
    if (value >= 4)
        return { variant: 'moderate', label: 'Moderate', color: 'text-warn-dark' };
    if (value > 0)
        return { variant: 'stable', label: 'Stable', color: 'text-ok-dark' };
    return { variant: 'improving', label: 'Improving', color: 'text-ok-dark' };
}
function isInactive(p) {
    if (!p.last_symptom_at)
        return true;
    return differenceInDays(new Date(), new Date(p.last_symptom_at)) > 7;
}
function isRecent(p) {
    if (!p.last_symptom_at)
        return false;
    return differenceInDays(new Date(), new Date(p.last_symptom_at)) <= 3;
}
export function PatientsPage() {
    const navigate = useNavigate();
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [bucket, setBucket] = useState('all');
    const [sort, setSort] = useState('urgency');
    const debouncedSearch = useDebounced(search, 300);
    const query = usePatients({ page, limit: LIMIT, search: debouncedSearch });
    const allRows = query.data?.data ?? [];
    const total = query.data?.meta?.total ?? 0;
    const counts = useMemo(() => ({
        all: allRows.length,
        attention: allRows.filter((p) => (p.avg_pain_7d ?? 0) >= 7).length,
        recent: allRows.filter(isRecent).length,
        inactive: allRows.filter(isInactive).length,
    }), [allRows]);
    const filteredRows = useMemo(() => {
        let next = allRows;
        if (bucket === 'attention')
            next = next.filter((p) => (p.avg_pain_7d ?? 0) >= 7);
        if (bucket === 'recent')
            next = next.filter(isRecent);
        if (bucket === 'inactive')
            next = next.filter(isInactive);
        const sorted = [...next];
        if (sort === 'urgency')
            sorted.sort((a, b) => (b.avg_pain_7d ?? -1) - (a.avg_pain_7d ?? -1));
        if (sort === 'pain')
            sorted.sort((a, b) => (b.avg_pain_7d ?? -1) - (a.avg_pain_7d ?? -1));
        if (sort === 'name')
            sorted.sort((a, b) => `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`));
        if (sort === 'recent')
            sorted.sort((a, b) => (b.last_symptom_at ? new Date(b.last_symptom_at).getTime() : 0) -
                (a.last_symptom_at ? new Date(a.last_symptom_at).getTime() : 0));
        return sorted;
    }, [allRows, bucket, sort]);
    const columns = [
        {
            key: 'patient',
            header: 'Patient',
            cell: (p) => (_jsxs("div", { className: "flex items-center gap-3", children: [_jsxs(Avatar, { size: "sm", children: [p.avatar_url && _jsx(AvatarImage, { src: p.avatar_url, alt: "" }), _jsx(AvatarFallback, { children: initials(p.first_name, p.last_name) })] }), _jsxs("div", { className: "min-w-0", children: [_jsxs("div", { className: "truncate font-serif text-base tracking-tightest", children: [p.first_name, " ", p.last_name] }), _jsxs("div", { className: "truncate font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground", children: ["Linked ", format(new Date(p.linked_at), 'd MMM yyyy')] })] })] })),
        },
        {
            key: 'last_login',
            header: 'Last activity',
            width: '160px',
            cell: (p) => (_jsx("div", { className: "font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground", children: p.last_symptom_at ? (_jsxs(_Fragment, { children: [_jsx("div", { className: "text-foreground", children: formatDistanceToNow(new Date(p.last_symptom_at), { addSuffix: true }) }), _jsx("div", { children: "Symptom log" })] })) : ('No logs yet') })),
        },
        {
            key: 'pain',
            header: '7-day pain',
            align: 'right',
            width: '110px',
            cell: (p) => {
                const tone = painTone(p.avg_pain_7d);
                return (_jsxs("div", { className: "flex items-baseline justify-end gap-1", children: [_jsx("span", { className: cn('font-serif text-2xl tracking-tightest', tone.color), children: p.avg_pain_7d != null ? p.avg_pain_7d.toFixed(1) : '—' }), _jsx("span", { className: "font-mono text-[10px] uppercase tracking-wider text-muted-foreground", children: "/10" })] }));
            },
        },
        {
            key: 'trend',
            header: '14-day trend',
            width: '160px',
            // TODO(api): patient list endpoint doesn't expose daily pain time-series yet —
            // sparkline renders the empty state. Add when /providers/patients returns history.
            cell: () => _jsx(Sparkline, { data: [], height: 32 }),
        },
        {
            key: 'status',
            header: 'Status',
            width: '120px',
            cell: (p) => {
                const tone = painTone(p.avg_pain_7d);
                return _jsx(Badge, { variant: tone.variant, children: tone.label });
            },
        },
        {
            key: 'go',
            header: '',
            width: '40px',
            align: 'right',
            cell: () => _jsx(ArrowRight, { className: "ml-auto h-4 w-4 text-muted-foreground" }),
        },
    ];
    return (_jsxs("div", { className: "mx-auto max-w-7xl space-y-8", children: [_jsx(PageHeader, { eyebrow: `${total.toString().padStart(3, '0')} total in your roster`, title: "Your patients.", description: "Triage by urgency, scan recent activity, and jump into any chart in one click.", actions: _jsxs(_Fragment, { children: [_jsxs(Button, { variant: "outline", size: "sm", children: [_jsx(Download, { className: "mr-2 h-3.5 w-3.5" }), "Export"] }), _jsxs(Button, { size: "sm", onClick: () => navigate('/linking'), children: [_jsx(UserPlus, { className: "mr-2 h-3.5 w-3.5" }), "Invite patient"] })] }) }), _jsxs("div", { className: "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4", children: [_jsx(KpiCard, { label: "Total patients", value: total || '—', icon: _jsx(Users, { className: "h-4 w-4" }), hint: "Linked & active" }), _jsx(KpiCard, { accent: "urgent", label: "Urgent \u00B7 pain \u2265 7", value: counts.attention, icon: _jsx(TriangleAlert, { className: "h-4 w-4" }), hint: "Triage these first" }), _jsx(KpiCard, { accent: "ok", label: "Recent activity \u00B7 3d", value: counts.recent, hint: "Logged in past 72 hours" }), _jsx(KpiCard, { accent: "gold", label: "No activity \u00B7 7d", value: counts.inactive, icon: _jsx(Inbox, { className: "h-4 w-4" }), hint: "Consider a check-in" })] }), _jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [_jsxs("div", { className: "relative w-full max-w-sm", children: [_jsx(Search, { className: "pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 stroke-[1.5] text-muted-foreground" }), _jsx(Input, { placeholder: "Search by name\u2026", value: search, onChange: (e) => {
                                    setSearch(e.target.value);
                                    setPage(1);
                                }, className: "pl-9" })] }), _jsxs("div", { className: "flex items-center gap-3", children: [query.isFetching && !query.isLoading && (_jsx("span", { className: "font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground", children: "Updating\u2026" })), _jsxs(Select, { value: sort, onValueChange: (v) => setSort(v), children: [_jsx(SelectTrigger, { className: "w-[200px]", children: _jsx(SelectValue, {}) }), _jsx(SelectContent, { children: SORT_OPTIONS.map((o) => (_jsx(SelectItem, { value: o.value, children: o.label }, o.value))) })] })] })] }), _jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx(FilterPill, { active: bucket === 'all', count: counts.all, onClick: () => setBucket('all'), children: "All patients" }), _jsx(FilterPill, { urgent: true, active: bucket === 'attention', count: counts.attention, onClick: () => setBucket('attention'), children: "Needs attention" }), _jsx(FilterPill, { active: bucket === 'recent', count: counts.recent, onClick: () => setBucket('recent'), children: "Recent activity" }), _jsx(FilterPill, { active: bucket === 'inactive', count: counts.inactive, onClick: () => setBucket('inactive'), children: "No activity \u00B7 7d" })] }), query.isError ? (_jsx(EmptyState, { title: "Couldn't load patients.", description: query.error instanceof Error ? query.error.message : 'Unknown error' })) : filteredRows.length === 0 && !query.isLoading ? (_jsx(EmptyState, { icon: _jsx(Users, { className: "h-6 w-6" }), title: debouncedSearch ? 'No matches.' : "Let's add your first patient.", description: debouncedSearch
                    ? 'Try a different spelling or clear the search.'
                    : "Generate an invite code and your patient will connect from their mobile app.", action: !debouncedSearch && (_jsx(Button, { onClick: () => navigate('/linking'), children: "Invite your first patient" })) })) : (_jsx(DataTable, { columns: columns, rows: filteredRows, rowKey: (p) => p.patient_id, loading: query.isLoading, page: page, pageSize: LIMIT, total: total, onPageChange: setPage, onRowClick: (p) => navigate(`/patients/${p.patient_id}`), rowClassName: (p) => ((p.avg_pain_7d ?? 0) >= 7 ? 'bg-err/5 hover:bg-err/10' : undefined) }))] }));
}
