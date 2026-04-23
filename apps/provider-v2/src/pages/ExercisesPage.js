import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { BarChart3, Dumbbell, Pencil, Plus, Trash2, Upload, } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { FilterPill } from '@/components/ui/filter-pill';
import { PageHeader } from '@/components/ui/page-header';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ExerciseFormDialog } from '@/features/exercises/ExerciseFormDialog';
import { useDeleteExercise, useExercises } from '@/features/exercises/queries';
const LIMIT = 24;
const SORT_OPTIONS = [
    { value: 'recent', label: 'Most recent' },
    { value: 'title', label: 'Title (A → Z)' },
];
const CATEGORIES = ['Jaw Mobility', 'Stretching', 'Strengthening', 'Relaxation'];
function formatDuration(seconds) {
    if (!seconds)
        return null;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}
export function ExercisesPage() {
    const [page, setPage] = useState(1);
    const [filterCategory, setFilterCategory] = useState(null);
    const [sort, setSort] = useState('recent');
    const [formOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const { data, isLoading, isError, error } = useExercises({ page, limit: LIMIT });
    const del = useDeleteExercise();
    const allRows = data?.data ?? [];
    const total = data?.meta?.total ?? 0;
    const counts = useMemo(() => {
        const map = {};
        for (const cat of CATEGORIES)
            map[cat] = 0;
        for (const ex of allRows) {
            const cat = ex.category;
            if (cat && map[cat] !== undefined)
                map[cat] += 1;
        }
        return map;
    }, [allRows]);
    const filteredRows = useMemo(() => {
        let next = allRows;
        if (filterCategory)
            next = next.filter((ex) => ex.category === filterCategory);
        const sorted = [...next];
        if (sort === 'title')
            sorted.sort((a, b) => a.title.localeCompare(b.title));
        if (sort === 'recent')
            sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        return sorted;
    }, [allRows, filterCategory, sort]);
    const lastUpload = useMemo(() => {
        if (allRows.length === 0)
            return null;
        return allRows.reduce((latest, ex) => new Date(ex.created_at) > new Date(latest.created_at) ? ex : latest);
    }, [allRows]);
    function onNew() {
        setEditing(null);
        setFormOpen(true);
    }
    function onEdit(ex) {
        setEditing(ex);
        setFormOpen(true);
    }
    return (_jsxs("div", { className: "mx-auto max-w-7xl space-y-6", children: [_jsx(PageHeader, { eyebrow: "Exercise library", title: "Record once, prescribe forever.", description: _jsxs(_Fragment, { children: [_jsx("span", { className: "text-foreground", children: total }), " exercise", total === 1 ? '' : 's', " across ", CATEGORIES.length, " categories", lastUpload && (_jsxs(_Fragment, { children: [' · ', "Last upload", ' ', _jsx("span", { className: "text-foreground", children: formatDistanceToNow(new Date(lastUpload.created_at), { addSuffix: true }) })] }))] }), actions: _jsxs(_Fragment, { children: [_jsxs(Button, { variant: "outline", size: "sm", children: [_jsx(BarChart3, { className: "mr-2 h-3.5 w-3.5" }), "Analytics"] }), _jsxs(Button, { size: "sm", onClick: onNew, children: [_jsx(Upload, { className: "mr-2 h-3.5 w-3.5" }), "Upload new video"] })] }) }), _jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx(FilterPill, { active: filterCategory === null, count: allRows.length, onClick: () => setFilterCategory(null), children: "All exercises" }), CATEGORIES.map((cat) => (_jsx(FilterPill, { active: filterCategory === cat, count: counts[cat] ?? 0, onClick: () => setFilterCategory(cat), children: cat }, cat)))] }), _jsxs(Select, { value: sort, onValueChange: (v) => setSort(v), children: [_jsx(SelectTrigger, { className: "w-[180px]", children: _jsx(SelectValue, {}) }), _jsx(SelectContent, { children: SORT_OPTIONS.map((o) => (_jsx(SelectItem, { value: o.value, children: o.label }, o.value))) })] })] }), isLoading ? (_jsx("div", { className: "grid gap-4 sm:grid-cols-2 xl:grid-cols-3", children: Array.from({ length: 6 }).map((_, i) => (_jsx(Skeleton, { className: "h-72" }, i))) })) : isError ? (_jsx(EmptyState, { title: "Couldn't load exercises.", description: error instanceof Error ? error.message : 'Unknown error' })) : filteredRows.length === 0 ? (_jsx(EmptyState, { icon: _jsx(Dumbbell, { className: "h-6 w-6" }), title: filterCategory ? 'No exercises in this category yet.' : 'An empty library.', description: filterCategory
                    ? 'Switch categories or upload a new video.'
                    : 'Record a short demonstration and write a few lines about the movement.', action: _jsx(Button, { onClick: onNew, children: "Create your first exercise" }) })) : (_jsx("div", { className: "grid gap-4 sm:grid-cols-2 xl:grid-cols-3", children: filteredRows.map((ex) => (_jsx(ExerciseCardItem, { ex: ex, onEdit: () => onEdit(ex), onDelete: () => setDeleteTarget(ex) }, ex.id))) })), data?.meta && data.meta.total > LIMIT && (_jsxs("div", { className: "flex items-center justify-between border-t border-border/70 pt-4 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground", children: [_jsxs("span", { children: ["Page ", page, " / ", data.meta.totalPages, " \u00B7 ", data.meta.total, " total"] }), _jsxs("div", { className: "flex gap-1", children: [_jsx(Button, { variant: "outline", size: "sm", disabled: page <= 1, onClick: () => setPage((p) => Math.max(1, p - 1)), children: "Previous" }), _jsx(Button, { variant: "outline", size: "sm", disabled: page >= (data.meta.totalPages ?? 1), onClick: () => setPage((p) => Math.min(data.meta.totalPages, p + 1)), children: "Next" })] })] })), _jsx(ExerciseFormDialog, { open: formOpen, onOpenChange: setFormOpen, exercise: editing }), _jsx(Dialog, { open: Boolean(deleteTarget), onOpenChange: (v) => !v && setDeleteTarget(null), children: _jsxs(DialogContent, { className: "max-w-md", children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: "Remove this exercise?" }), _jsxs(DialogDescription, { children: ["Active assignments referencing", ' ', _jsx("strong", { className: "font-serif text-foreground", children: deleteTarget?.title }), " will remain \u2014 but you won't be able to assign it to new patients."] })] }), _jsxs(DialogFooter, { children: [_jsx(Button, { variant: "outline", onClick: () => setDeleteTarget(null), children: "Cancel" }), _jsx(Button, { variant: "destructive", disabled: del.isPending, onClick: async () => {
                                        if (!deleteTarget)
                                            return;
                                        await del.mutateAsync(deleteTarget.id);
                                        setDeleteTarget(null);
                                    }, children: del.isPending ? 'Removing…' : 'Remove' })] })] }) })] }));
}
function ExerciseCardItem({ ex, onEdit, onDelete, }) {
    // TODO(api): exercise endpoint doesn't yet expose assignment count or completion %.
    // Card shows category, duration, "Recorded by" + date as the meta line.
    return (_jsxs("div", { className: "group relative", children: [_jsxs("article", { className: "flex flex-col overflow-hidden rounded-sm border border-border/70 bg-card shadow-navy-xs transition hover:-translate-y-0.5 hover:shadow-navy-sm", children: [_jsxs("div", { className: "relative aspect-video w-full overflow-hidden bg-gradient-to-br from-navy-700 to-navy-900", children: [ex.thumbnail_url ? (_jsx("img", { src: ex.thumbnail_url, alt: "", className: "h-full w-full object-cover" })) : ex.video_url ? (_jsx("video", { src: ex.video_url, className: "h-full w-full object-cover", muted: true })) : (_jsx("div", { className: "absolute inset-0 flex items-center justify-center text-gold-600/70", children: _jsx(Dumbbell, { className: "h-12 w-12", strokeWidth: 1.25 }) })), ex.category && (_jsx("span", { className: "absolute left-2 top-2 rounded-sm bg-navy-700/80 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-background backdrop-blur-sm", children: ex.category })), formatDuration(ex.duration_seconds) && (_jsx("span", { className: "absolute right-2 top-2 rounded-sm bg-foreground/70 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-background", children: formatDuration(ex.duration_seconds) }))] }), _jsxs("div", { className: "flex flex-col gap-2 p-4", children: [_jsx("h3", { className: "font-serif text-base leading-tight tracking-tightest text-foreground", children: ex.title }), ex.description && (_jsx("p", { className: "line-clamp-2 text-xs leading-relaxed text-muted-foreground", children: ex.description })), _jsxs("div", { className: "mt-1 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground", children: [_jsxs("span", { children: ["Added ", format(new Date(ex.created_at), 'd MMM yyyy')] }), _jsx("span", { className: "text-muted-foreground/60", children: "\u2014 \u00B7 \u2014 completion" })] })] })] }), _jsxs("div", { className: "absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100", children: [_jsx(Button, { variant: "outline", size: "icon", onClick: onEdit, "aria-label": "Edit", className: "h-7 w-7 bg-card/95 backdrop-blur", children: _jsx(Pencil, { className: "h-3 w-3" }) }), _jsx(Button, { variant: "outline", size: "icon", onClick: onDelete, "aria-label": "Delete", className: "h-7 w-7 bg-card/95 backdrop-blur", children: _jsx(Trash2, { className: "h-3 w-3" }) })] })] }));
}
// Plus icon kept for any future toolbar usage of the same module.
export const _Plus = Plus;
