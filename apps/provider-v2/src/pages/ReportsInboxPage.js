import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { format, formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { ArrowRight, Check, CheckCheck, ChevronLeft, ChevronRight, Filter, Flag, Image as ImageIcon, Inbox, Mail, Paperclip, Send, TriangleAlert, } from 'lucide-react';
import { Avatar, AvatarFallback, initials } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { FilterPill } from '@/components/ui/filter-pill';
import { PageHeader } from '@/components/ui/page-header';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Sparkline } from '@/components/ui/sparkline';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useFlagReport, useInbox, useMarkReviewed, useReport, useRespondToReport, } from '@/features/reports/queries';
const PAGE_SIZE = 25;
const SORT_OPTIONS = [
    { value: 'urgency', label: 'Urgency (high to low)' },
    { value: 'recent', label: 'Most recent' },
];
function statusBadgeVariant(s) {
    if (s === 'submitted')
        return 'unanswered';
    if (s === 'viewed')
        return 'new';
    if (s === 'responded')
        return 'responded';
    return 'fyi';
}
function statusLabel(s) {
    return {
        submitted: 'Unanswered',
        viewed: 'Opened',
        reviewed: 'Reviewed',
        responded: 'Responded',
    }[s];
}
function urgencyLeft(u) {
    if (u === 'urgent')
        return 'border-l-err';
    if (u === 'concerning')
        return 'border-l-warn';
    return 'border-l-ok';
}
function urgencyBadgeVariant(u) {
    if (u === 'urgent')
        return 'urgent';
    if (u === 'concerning')
        return 'moderate';
    return 'improving';
}
function painTone(value) {
    if (value == null)
        return 'text-muted-foreground';
    if (value >= 7)
        return 'text-err-dark';
    if (value >= 4)
        return 'text-warn-dark';
    return 'text-ok-dark';
}
export function ReportsInboxPage() {
    const navigate = useNavigate();
    const { reportId: paramId } = useParams();
    const [bucket, setBucket] = useState('all');
    const [sort, setSort] = useState('urgency');
    const [page, setPage] = useState(1);
    const inbox = useInbox({ page, limit: PAGE_SIZE });
    const allRows = inbox.data?.data ?? [];
    const total = inbox.data?.meta?.total ?? 0;
    const totalPages = inbox.data?.meta?.totalPages ?? 1;
    const counts = useMemo(() => ({
        all: allRows.length,
        urgent: allRows.filter((r) => r.urgency === 'urgent').length,
        awaiting: allRows.filter((r) => r.status === 'submitted' || r.status === 'viewed').length,
        responded: allRows.filter((r) => r.status === 'responded').length,
        flagged: allRows.filter((r) => r.flagged).length,
    }), [allRows]);
    const filteredRows = useMemo(() => {
        let next = allRows;
        if (bucket === 'urgent')
            next = next.filter((r) => r.urgency === 'urgent');
        if (bucket === 'awaiting')
            next = next.filter((r) => r.status === 'submitted' || r.status === 'viewed');
        if (bucket === 'responded')
            next = next.filter((r) => r.status === 'responded');
        if (bucket === 'flagged')
            next = next.filter((r) => r.flagged);
        const sorted = [...next];
        if (sort === 'urgency') {
            const rank = { urgent: 0, concerning: 1, routine: 2 };
            sorted.sort((a, b) => rank[a.urgency] - rank[b.urgency]);
        }
        else {
            sorted.sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime());
        }
        return sorted;
    }, [allRows, bucket, sort]);
    // Auto-select the first filtered row when none is in the URL.
    useEffect(() => {
        if (paramId)
            return;
        if (filteredRows.length === 0)
            return;
        navigate(`/reports/${filteredRows[0].id}`, { replace: true });
    }, [paramId, filteredRows, navigate]);
    const selectedId = paramId ?? filteredRows[0]?.id;
    // TODO(api): inbox endpoint doesn't return avg-response-time; placeholder.
    const avgResponse = '—';
    return (_jsxs("div", { className: "mx-auto max-w-[1400px] space-y-6", children: [_jsx(PageHeader, { eyebrow: "Reports inbox", title: "Reports from your patients.", description: _jsxs(_Fragment, { children: [_jsx("span", { className: "text-foreground", children: counts.awaiting }), " awaiting response \u00B7", ' ', _jsxs("span", { className: "text-err-dark", children: [counts.urgent, " urgent"] }), " \u00B7 Avg response", ' ', _jsx("span", { className: "text-foreground", children: avgResponse })] }), actions: _jsxs(_Fragment, { children: [_jsxs(Button, { variant: "outline", size: "sm", children: [_jsx(CheckCheck, { className: "mr-2 h-3.5 w-3.5" }), "Mark all read"] }), _jsxs(Button, { variant: "outline", size: "sm", children: [_jsx(Filter, { className: "mr-2 h-3.5 w-3.5" }), "Filters"] })] }) }), _jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx(FilterPill, { active: bucket === 'all', count: counts.all, onClick: () => setBucket('all'), children: "All" }), _jsx(FilterPill, { urgent: true, active: bucket === 'urgent', count: counts.urgent, onClick: () => setBucket('urgent'), children: "Urgent" }), _jsx(FilterPill, { active: bucket === 'awaiting', count: counts.awaiting, onClick: () => setBucket('awaiting'), children: "Awaiting response" }), _jsx(FilterPill, { active: bucket === 'responded', count: counts.responded, onClick: () => setBucket('responded'), children: "Responded" }), _jsx(FilterPill, { active: bucket === 'flagged', count: counts.flagged, onClick: () => setBucket('flagged'), children: "Flagged" })] }), _jsxs(Select, { value: sort, onValueChange: (v) => setSort(v), children: [_jsx(SelectTrigger, { className: "w-[200px]", children: _jsx(SelectValue, {}) }), _jsx(SelectContent, { children: SORT_OPTIONS.map((o) => (_jsx(SelectItem, { value: o.value, children: o.label }, o.value))) })] })] }), _jsxs("div", { className: "grid gap-0 overflow-hidden rounded-sm border border-border/70 bg-card lg:grid-cols-[400px_1fr]", children: [_jsxs("aside", { className: "border-b border-border/70 lg:border-b-0 lg:border-r", children: [_jsx("div", { className: "max-h-[calc(100vh-22rem)] overflow-y-auto", children: inbox.isLoading ? (_jsx(ListSkeletons, {})) : filteredRows.length === 0 ? (_jsx("div", { className: "p-10", children: _jsx(EmptyState, { icon: _jsx(Inbox, { className: "h-6 w-6" }), title: "All caught up.", description: bucket === 'all'
                                            ? "No new reports. We'll notify you instantly when one arrives."
                                            : 'No reports match this filter.' }) })) : (_jsx("ul", { children: filteredRows.map((r) => (_jsx("li", { children: _jsx(ListItem, { row: r, selected: r.id === selectedId, onSelect: () => navigate(`/reports/${r.id}`) }) }, r.id))) })) }), total > PAGE_SIZE && (_jsxs("div", { className: "flex items-center justify-between border-t border-border/70 bg-secondary/30 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground", children: [_jsxs("span", { children: ["Page ", page, " / ", totalPages, " \u00B7 ", total, " filed"] }), _jsxs("div", { className: "flex gap-1", children: [_jsx("button", { onClick: () => setPage((p) => Math.max(1, p - 1)), disabled: page <= 1, className: "inline-flex h-7 w-7 items-center justify-center rounded-sm border border-border bg-card hover:bg-secondary disabled:pointer-events-none disabled:opacity-40", "aria-label": "Previous", children: _jsx(ChevronLeft, { className: "h-3.5 w-3.5" }) }), _jsx("button", { onClick: () => setPage((p) => Math.min(totalPages, p + 1)), disabled: page >= totalPages, className: "inline-flex h-7 w-7 items-center justify-center rounded-sm border border-border bg-card hover:bg-secondary disabled:pointer-events-none disabled:opacity-40", "aria-label": "Next", children: _jsx(ChevronRight, { className: "h-3.5 w-3.5" }) })] })] }))] }), _jsx("section", { className: "min-h-[600px]", children: selectedId ? (_jsx(ReportDetail, { reportId: selectedId })) : (_jsx("div", { className: "flex h-full items-center justify-center p-10", children: _jsx(EmptyState, { icon: _jsx(Mail, { className: "h-6 w-6" }), title: "Select a report", description: "Pick a report from the inbox to read it and respond." }) })) })] })] }));
}
function ListSkeletons() {
    return (_jsx("ul", { children: Array.from({ length: 5 }).map((_, i) => (_jsx("li", { className: "border-b border-border/40 p-4", children: _jsxs("div", { className: "flex gap-3", children: [_jsx(Skeleton, { className: "h-9 w-9 shrink-0" }), _jsxs("div", { className: "flex-1 space-y-2", children: [_jsx(Skeleton, { className: "h-3 w-32" }), _jsx(Skeleton, { className: "h-3 w-full" }), _jsx(Skeleton, { className: "h-3 w-3/4" })] })] }) }, i))) }));
}
function ListItem({ row, selected, onSelect, }) {
    const unread = row.status === 'submitted';
    return (_jsx("button", { type: "button", onClick: onSelect, className: cn('block w-full border-b border-border/40 border-l-2 px-4 py-3 text-left transition-colors hover:bg-secondary/40', urgencyLeft(row.urgency), selected && 'bg-secondary/60', row.urgency === 'urgent' && !selected && 'bg-err/[0.03]'), children: _jsxs("div", { className: "flex items-start gap-3", children: [_jsx(Avatar, { size: "sm", className: "mt-0.5", children: _jsx(AvatarFallback, { children: initials(row.patient_first_name, row.patient_last_name) }) }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsxs("div", { className: "flex items-center justify-between gap-2", children: [_jsxs("div", { className: "flex items-center gap-1.5 truncate", children: [_jsxs("span", { className: cn('truncate font-serif text-sm tracking-tightest', unread && 'font-medium'), children: [row.patient_first_name, " ", row.patient_last_name] }), row.flagged && _jsx(Flag, { className: "h-3 w-3 fill-gold-600 stroke-gold-600" })] }), _jsx("span", { className: "shrink-0 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground", children: formatDistanceToNow(new Date(row.submitted_at), { addSuffix: true }) })] }), _jsx("div", { className: "mt-1 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em]", children: _jsxs(Badge, { variant: urgencyBadgeVariant(row.urgency), children: [row.urgency === 'urgent' && _jsx(TriangleAlert, { className: "h-2.5 w-2.5" }), row.urgency, " \u00B7 pain ", row.pain_level ?? '—', "/10"] }) }), row.description_preview && (_jsx("p", { className: cn('mt-1.5 line-clamp-2 text-xs leading-relaxed', unread ? 'text-foreground' : 'text-muted-foreground'), children: row.description_preview })), _jsx("div", { className: "mt-2 flex items-center justify-between", children: _jsx(Badge, { variant: statusBadgeVariant(row.status), children: statusLabel(row.status) }) })] })] }) }));
}
function ReportDetail({ reportId }) {
    const q = useReport(reportId);
    const flag = useFlagReport(reportId);
    const review = useMarkReviewed(reportId);
    const respond = useRespondToReport(reportId);
    const [message, setMessage] = useState('');
    const [internalNotes, setInternalNotes] = useState('');
    // Reset draft when switching reports.
    useEffect(() => {
        setMessage('');
        setInternalNotes('');
    }, [reportId]);
    if (q.isLoading) {
        return (_jsxs("div", { className: "space-y-4 p-6", children: [_jsx(Skeleton, { className: "h-12 w-2/3" }), _jsx(Skeleton, { className: "h-32 w-full" }), _jsx(Skeleton, { className: "h-24 w-full" })] }));
    }
    if (q.isError || !q.data) {
        return (_jsx("div", { className: "p-10", children: _jsx(EmptyState, { title: "Couldn't load this report.", description: q.error instanceof Error ? q.error.message : 'Try selecting another.' }) }));
    }
    const { report, responses } = q.data;
    async function onSend(e) {
        e.preventDefault();
        if (!message.trim())
            return;
        try {
            await respond.mutateAsync({
                message: message.trim(),
                internal_notes: internalNotes.trim() || undefined,
            });
            toast.success('Response sent to patient.');
            setMessage('');
            setInternalNotes('');
        }
        catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to send.');
        }
    }
    return (_jsxs("article", { className: "flex h-full flex-col overflow-y-auto", children: [_jsxs("header", { className: "border-b border-border/70 p-6", children: [_jsxs("div", { className: "flex flex-wrap items-start justify-between gap-4", children: [_jsxs("div", { className: "flex flex-1 items-start gap-4", children: [_jsx(Avatar, { size: "md", children: _jsx(AvatarFallback, { className: "bg-navy-600 text-background", children: initials(report.patient_id.slice(0, 1), report.patient_id.slice(1, 2)) }) }), _jsxs("div", { className: "min-w-0", children: [_jsx("h2", { className: "font-serif text-2xl tracking-tightest", children: "Report from this patient" }), _jsxs("div", { className: "mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground", children: ["Patient ID \u00B7 ", report.patient_id.slice(0, 8), "\u2026"] })] })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsxs(Button, { variant: "outline", size: "sm", onClick: () => flag.mutate(undefined, {
                                            onSuccess: (res) => toast.success(res?.data?.flagged ? 'Report flagged.' : 'Flag removed.'),
                                            onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to toggle flag.'),
                                        }), disabled: flag.isPending, children: [_jsx(Flag, { className: cn('mr-1.5 h-3.5 w-3.5', report.flagged && 'fill-gold-600 stroke-gold-600') }), report.flagged ? 'Unflag' : 'Flag'] }), report.status !== 'reviewed' && report.status !== 'responded' && (_jsxs(Button, { size: "sm", onClick: () => review.mutate(undefined, {
                                            onSuccess: () => toast.success('Marked reviewed.'),
                                            onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed.'),
                                        }), disabled: review.isPending, children: [_jsx(Check, { className: "mr-1.5 h-3.5 w-3.5" }), "Mark reviewed"] }))] })] }), _jsxs("div", { className: "mt-4 flex flex-wrap items-center gap-2", children: [_jsxs(Badge, { variant: urgencyBadgeVariant(report.urgency), size: "md", children: [report.urgency === 'urgent' && _jsx(TriangleAlert, { className: "h-3 w-3" }), report.urgency] }), _jsxs(Badge, { variant: "muted", children: ["Submitted \u00B7 ", format(new Date(report.submitted_at), 'd MMM · HH:mm')] }), _jsxs(Badge, { variant: "muted", children: ["Status \u00B7 ", statusLabel(report.status)] }), report.flagged && (_jsxs(Badge, { variant: "gold", children: [_jsx(Flag, { className: "h-2.5 w-2.5" }), "Flagged"] }))] })] }), report.pain_level != null && (_jsx("section", { className: "border-b border-border/70 bg-gradient-to-br from-err/5 to-gold-100/40 px-6 py-5", children: _jsxs("div", { className: "flex items-center gap-6", children: [_jsxs("div", { className: "text-center", children: [_jsx("div", { className: cn('font-serif text-6xl leading-none tracking-tightest', painTone(report.pain_level)), children: report.pain_level }), _jsx("div", { className: "mt-1 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground", children: "/ 10 pain" })] }), _jsxs("div", { className: "flex-1", children: [_jsx("div", { className: "font-serif text-lg tracking-tightest text-foreground", children: report.pain_level >= 7
                                        ? 'Pain spike — crossed urgent threshold'
                                        : report.pain_level >= 4
                                            ? 'Moderate pain reported'
                                            : 'Routine check-in' }), _jsx("p", { className: "mt-1 text-sm text-muted-foreground", children: report.pain_level >= 7
                                        ? 'Patient reported severe pain. Consider rapid response, especially if symptoms are escalating.'
                                        : 'Patient submitted a structured update. Review and reply to keep the chart current.' })] })] }) })), _jsxs("section", { className: "border-b border-border/70 px-6 py-5", children: [_jsx("div", { className: "mb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground", children: "Patient's message" }), _jsx("blockquote", { className: "border-l-2 border-gold-600 bg-secondary/30 p-4 font-serif text-base italic leading-relaxed tracking-tight text-foreground", children: report.description }), report.patient_notes && (_jsxs("div", { className: "mt-3 rounded-sm border border-border/60 bg-card p-3", children: [_jsx("div", { className: "mb-1 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground", children: "Additional notes" }), _jsx("p", { className: "whitespace-pre-wrap text-sm leading-relaxed", children: report.patient_notes })] }))] }), report.photo_url && (_jsxs("section", { className: "border-b border-border/70 px-6 py-5", children: [_jsx("div", { className: "mb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground", children: "Attached photo \u00B7 1 of 1" }), _jsx("div", { className: "overflow-hidden rounded-sm border border-border/70", children: _jsx("img", { src: report.photo_url, alt: "Report attachment", className: "max-h-80 w-full object-cover" }) })] })), _jsxs("section", { className: "grid grid-cols-3 gap-px border-b border-border/70 bg-border/70", children: [_jsx(ContextCard, { label: "14-day pain trend", 
                        // TODO(api): trend requires daily symptom data; renders empty state for now.
                        value: _jsx(Sparkline, { data: [], height: 28 }), hint: "Climbing steadily" }), _jsx(ContextCard, { label: "Adherence \u00B7 7d", value: _jsx("span", { className: "font-serif text-2xl tracking-tightest text-warn-dark", children: "\u2014" }), hint: "Below target (80%)" }), _jsx(ContextCard, { label: "Last clinic visit", value: _jsx("span", { className: "font-serif text-2xl tracking-tightest text-foreground", children: "\u2014" }), hint: "Days ago" })] }), responses.length > 0 && (_jsxs("section", { className: "border-b border-border/70 px-6 py-5", children: [_jsxs("div", { className: "mb-3 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground", children: ["Conversation \u00B7 ", responses.length.toString().padStart(2, '0'), " response", responses.length === 1 ? '' : 's'] }), _jsx("ol", { className: "space-y-3", children: responses.map((r) => (_jsx(ResponseItem, { r: r }, r.id))) })] })), _jsxs("form", { onSubmit: onSend, className: "m-6 mt-auto rounded-sm border-2 border-gold-600/40 bg-card", children: [_jsx("div", { className: "flex items-center justify-between border-b border-gold-600/30 bg-gold-100/30 px-4 py-2", children: _jsxs("div", { className: "flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-gold-700", children: [_jsx(Mail, { className: "h-3.5 w-3.5" }), "Respond"] }) }), _jsxs("div", { className: "space-y-3 p-4", children: [_jsx(Textarea, { value: message, onChange: (e) => setMessage(e.target.value), placeholder: "Write a clear, calm response\u2026", rows: 4, required: true, className: "resize-none border-0 bg-transparent p-0 focus-visible:ring-0" }), _jsxs("div", { className: "border-t border-border/60 pt-3", children: [_jsx("label", { className: "mb-1.5 block font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground", children: "Internal notes \u00B7 private" }), _jsx(Textarea, { value: internalNotes, onChange: (e) => setInternalNotes(e.target.value), placeholder: "Clinical notes the patient won't see\u2026", rows: 2, className: "resize-none bg-secondary/30" })] }), respond.isError && (_jsx("p", { className: "text-xs text-destructive", children: respond.error instanceof Error ? respond.error.message : 'Failed to send.' }))] }), _jsxs("div", { className: "flex items-center justify-between border-t border-border/60 bg-secondary/30 px-4 py-3", children: [_jsxs("div", { className: "flex items-center gap-1 text-muted-foreground", children: [_jsx("button", { type: "button", className: "rounded-sm p-1 hover:bg-secondary", "aria-label": "Attach file", children: _jsx(Paperclip, { className: "h-3.5 w-3.5" }) }), _jsx("button", { type: "button", className: "rounded-sm p-1 hover:bg-secondary", "aria-label": "Attach image", children: _jsx(ImageIcon, { className: "h-3.5 w-3.5" }) }), _jsxs("span", { className: "ml-3 font-mono text-[10px] uppercase tracking-[0.18em]", children: [message.length, "/5000"] })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Button, { type: "button", variant: "outline", size: "sm", children: "Save draft" }), _jsxs(Button, { type: "submit", size: "sm", disabled: respond.isPending || !message.trim(), children: [respond.isPending ? 'Sending…' : 'Send response', _jsx(ArrowRight, { className: "ml-1.5 h-3.5 w-3.5" })] })] })] })] })] }));
}
function ContextCard({ label, value, hint, }) {
    return (_jsxs("div", { className: "bg-card p-4", children: [_jsx("div", { className: "mb-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground", children: label }), _jsx("div", { children: value }), _jsx("div", { className: "mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground", children: hint })] }));
}
function ResponseItem({ r }) {
    return (_jsxs("li", { className: "rounded-sm border border-border/70 bg-card p-4", children: [_jsxs("div", { className: "mb-2 flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground", children: [_jsx("span", { className: "text-foreground", children: "You responded" }), _jsx("span", { children: format(new Date(r.responded_at), 'd MMM yyyy · HH:mm') })] }), _jsx("p", { className: "whitespace-pre-wrap text-sm leading-relaxed", children: r.message }), r.internal_notes && (_jsxs("div", { className: "mt-3 rounded-sm border-l-2 border-gold-600 bg-gold-100/30 p-3", children: [_jsx("div", { className: "mb-1 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground", children: "Internal notes \u00B7 private" }), _jsx("p", { className: "whitespace-pre-wrap text-sm leading-relaxed", children: r.internal_notes })] }))] }));
}
// re-export so the existing /reports/:reportId route works through the same split UI.
export { ReportsInboxPage as ReportsInboxRoute };
// Send action icon — kept for future toolbar growth.
export const _Send = Send;
