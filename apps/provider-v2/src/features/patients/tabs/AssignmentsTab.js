import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Check, Dumbbell, MoreVertical, Pause, Play, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, } from '@/components/ui/dialog';
import { usePatientAssignments } from '@/features/patients/detail-queries';
import { useDeleteAssignment, useUpdateAssignment, } from '@/features/patients/assignment-mutations';
import { EmptyState, SkeletonList } from './shared';
const FREQUENCIES = ['daily', '2x daily', '3x daily', 'alt days', 'weekly'];
export function AssignmentsTab({ patientId, onAssign }) {
    const q = usePatientAssignments(patientId);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const del = useDeleteAssignment(patientId);
    if (q.isLoading)
        return _jsx(SkeletonList, {});
    if (q.isError) {
        return (_jsx("p", { className: "py-8 text-sm text-destructive", children: q.error instanceof Error ? q.error.message : 'Failed to load assignments.' }));
    }
    if (!q.data || q.data.length === 0) {
        return (_jsx(EmptyState, { icon: Dumbbell, title: "No exercises assigned.", body: "Pick from your library to create the first assignment.", cta: _jsx(Button, { onClick: onAssign, children: "Assign an exercise" }) }));
    }
    const grouped = { active: [], paused: [], completed: [] };
    for (const a of q.data)
        grouped[a.status]?.push(a);
    return (_jsxs(_Fragment, { children: [_jsx("div", { className: "grid gap-6 lg:grid-cols-3", children: ['active', 'paused', 'completed'].map((status) => (_jsxs("section", { className: "space-y-3", children: [_jsxs("div", { className: "flex items-baseline justify-between border-b border-border/70 pb-2", children: [_jsx("h3", { className: "font-mono text-[11px] uppercase tracking-[0.22em]", children: status }), _jsx("span", { className: "font-mono text-[10px] text-muted-foreground", children: grouped[status].length.toString().padStart(2, '0') })] }), grouped[status].length === 0 ? (_jsx("p", { className: "py-8 text-center font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground", children: "None" })) : (grouped[status].map((a) => (_jsx(AssignmentCard, { assignment: a, patientId: patientId, onDelete: () => setDeleteTarget(a) }, a.id))))] }, status))) }), _jsx(Dialog, { open: Boolean(deleteTarget), onOpenChange: (v) => !v && setDeleteTarget(null), children: _jsxs(DialogContent, { className: "max-w-md", children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: "Remove this assignment?" }), _jsxs(DialogDescription, { children: [_jsx("strong", { className: "font-serif text-foreground", children: deleteTarget?.title }), " will no longer appear in the patient's plan. Completion history is preserved."] })] }), _jsxs(DialogFooter, { children: [_jsx(Button, { variant: "outline", onClick: () => setDeleteTarget(null), children: "Cancel" }), _jsx(Button, { variant: "destructive", disabled: del.isPending, onClick: async () => {
                                        if (!deleteTarget)
                                            return;
                                        await del.mutateAsync(deleteTarget.id);
                                        setDeleteTarget(null);
                                    }, children: del.isPending ? 'Removing…' : 'Remove' })] })] }) })] }));
}
function AssignmentCard({ assignment, patientId, onDelete, }) {
    const update = useUpdateAssignment(patientId);
    const [editOpen, setEditOpen] = useState(false);
    const a = assignment;
    function setStatus(status) {
        update.mutate({ assignmentId: a.id, body: { status } });
    }
    return (_jsxs(_Fragment, { children: [_jsxs("article", { className: "group relative rounded-sm border border-border/70 bg-card p-4", children: [_jsxs("div", { className: "flex items-start justify-between gap-2", children: [_jsx("div", { className: "font-serif text-lg tracking-tightest", children: a.title }), _jsxs(DropdownMenu, { children: [_jsx(DropdownMenuTrigger, { asChild: true, children: _jsx(Button, { variant: "ghost", size: "icon", className: "h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100 data-[state=open]:opacity-100", children: _jsx(MoreVertical, { className: "h-4 w-4" }) }) }), _jsxs(DropdownMenuContent, { align: "end", children: [_jsx(DropdownMenuItem, { onSelect: () => setEditOpen(true), children: "Edit cadence" }), a.status === 'active' && (_jsxs(DropdownMenuItem, { onSelect: () => setStatus('paused'), children: [_jsx(Pause, { className: "h-3.5 w-3.5" }), "Pause"] })), a.status === 'paused' && (_jsxs(DropdownMenuItem, { onSelect: () => setStatus('active'), children: [_jsx(Play, { className: "h-3.5 w-3.5" }), "Resume"] })), a.status !== 'completed' && (_jsxs(DropdownMenuItem, { onSelect: () => setStatus('completed'), children: [_jsx(Check, { className: "h-3.5 w-3.5" }), "Mark complete"] })), _jsx(DropdownMenuSeparator, {}), _jsxs(DropdownMenuItem, { destructive: true, onSelect: onDelete, children: [_jsx(Trash2, { className: "h-3.5 w-3.5" }), "Remove"] })] })] })] }), a.description && (_jsx("p", { className: "mb-3 line-clamp-2 text-xs leading-relaxed text-muted-foreground", children: a.description })), _jsxs("dl", { className: "grid grid-cols-2 gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground", children: [_jsxs("div", { children: [_jsx("dt", { className: "text-muted-foreground/60", children: "Frequency" }), _jsx("dd", { className: "text-foreground normal-case tracking-normal", children: a.frequency })] }), _jsxs("div", { children: [_jsx("dt", { className: "text-muted-foreground/60", children: "Sets" }), _jsx("dd", { className: "text-foreground", children: a.sets })] })] }), _jsxs("div", { className: "mt-3 border-t border-border/70 pt-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground", children: ["Since ", format(new Date(a.assigned_at), 'd MMM yyyy')] })] }), _jsx(EditAssignmentDialog, { open: editOpen, onOpenChange: setEditOpen, assignment: a, patientId: patientId })] }));
}
function EditAssignmentDialog({ open, onOpenChange, assignment, patientId, }) {
    const update = useUpdateAssignment(patientId);
    const [frequency, setFrequency] = useState(assignment.frequency);
    const [sets, setSets] = useState(assignment.sets);
    useMemo(() => {
        if (open) {
            setFrequency(assignment.frequency);
            setSets(assignment.sets);
        }
    }, [open, assignment]);
    async function onSave(e) {
        e.preventDefault();
        await update.mutateAsync({ assignmentId: assignment.id, body: { frequency, sets } });
        onOpenChange(false);
    }
    return (_jsx(Dialog, { open: open, onOpenChange: onOpenChange, children: _jsxs(DialogContent, { className: "max-w-md", children: [_jsxs(DialogHeader, { children: [_jsx("div", { className: "font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground", children: "Edit cadence" }), _jsx(DialogTitle, { children: _jsx("em", { className: "text-accent", children: assignment.title }) })] }), _jsxs("form", { onSubmit: onSave, className: "space-y-5", children: [_jsxs("div", { className: "space-y-2", children: [_jsx("div", { className: "font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground", children: "Frequency" }), _jsx("div", { className: "flex flex-wrap gap-1.5", children: FREQUENCIES.map((f) => (_jsx("button", { type: "button", onClick: () => setFrequency(f), className: 'rounded-sm border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] transition-colors ' +
                                            (frequency === f
                                                ? 'border-foreground bg-foreground text-background'
                                                : 'border-border bg-card text-muted-foreground hover:border-foreground/40 hover:text-foreground'), children: f }, f))) })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("div", { className: "font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground", children: "Sets" }), _jsx("input", { type: "number", min: 1, value: sets, onChange: (e) => setSets(Math.max(1, Number(e.target.value) || 1)), className: "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" })] }), _jsxs(DialogFooter, { children: [_jsx(Button, { type: "button", variant: "outline", onClick: () => onOpenChange(false), children: "Cancel" }), _jsx(Button, { type: "submit", disabled: update.isPending, children: update.isPending ? 'Saving…' : 'Save' })] })] })] }) }));
}
export default AssignmentsTab;
