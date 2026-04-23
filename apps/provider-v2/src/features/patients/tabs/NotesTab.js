import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { z } from 'zod';
import { Lock, MoreVertical, Pencil, StickyNote, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, } from '@/components/ui/dialog';
import { useCreateNote, useDeleteNote, usePatientNotes, useUpdateNote, } from '@/features/patients/notes-queries';
import { EmptyState, SkeletonList } from './shared';
const noteFormSchema = z.object({
    body: z.string().min(1, 'A note needs at least one character.').max(10000, 'Too long.'),
    tagsText: z.string().max(500, 'Keep the tag list short.'),
});
function parseTags(raw) {
    return raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 20);
}
export function NotesTab({ patientId }) {
    const q = usePatientNotes(patientId);
    const [formOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const del = useDeleteNote(patientId);
    if (q.isLoading)
        return _jsx(SkeletonList, {});
    if (q.isError) {
        return (_jsx("p", { className: "py-8 text-sm text-destructive", children: q.error instanceof Error ? q.error.message : 'Failed to load notes.' }));
    }
    const rows = q.data?.data ?? [];
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex items-start gap-3 rounded-sm border-l-2 border-accent bg-accent/5 px-4 py-3", children: [_jsx(Lock, { className: "mt-0.5 h-4 w-4 stroke-[1.5] text-accent" }), _jsxs("div", { className: "flex-1", children: [_jsx("div", { className: "font-mono text-[10px] uppercase tracking-[0.22em] text-accent", children: "Private to you" }), _jsx("p", { className: "text-sm text-muted-foreground", children: "Clinical notes are never shared with the patient. Only you can read or edit them." })] })] }), _jsx("div", { className: "flex justify-end", children: _jsx(Button, { onClick: () => {
                        setEditing(null);
                        setFormOpen(true);
                    }, children: "New note" }) }), rows.length === 0 ? (_jsx(EmptyState, { icon: StickyNote, title: "No notes yet.", body: "Jot an observation, a plan, or a question for next visit \u2014 this space is yours.", cta: _jsx(Button, { onClick: () => {
                        setEditing(null);
                        setFormOpen(true);
                    }, children: "Write the first note" }) })) : (_jsx("ol", { className: "space-y-3", children: rows.map((n) => (_jsx(NoteCard, { note: n, onEdit: () => {
                        setEditing(n);
                        setFormOpen(true);
                    }, onDelete: () => setDeleteTarget(n) }, n.id))) })), _jsx(NoteFormDialog, { open: formOpen, onOpenChange: setFormOpen, patientId: patientId, note: editing }), _jsx(Dialog, { open: Boolean(deleteTarget), onOpenChange: (v) => !v && setDeleteTarget(null), children: _jsxs(DialogContent, { className: "max-w-md", children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: "Delete this note?" }), _jsx(DialogDescription, { children: "This cannot be undone. The note will be permanently removed from the patient chart." })] }), _jsxs(DialogFooter, { children: [_jsx(Button, { variant: "outline", onClick: () => setDeleteTarget(null), children: "Cancel" }), _jsx(Button, { variant: "destructive", disabled: del.isPending, onClick: async () => {
                                        if (!deleteTarget)
                                            return;
                                        await del.mutateAsync(deleteTarget.id);
                                        setDeleteTarget(null);
                                    }, children: del.isPending ? 'Deleting…' : 'Delete' })] })] }) })] }));
}
function NoteCard({ note, onEdit, onDelete, }) {
    const edited = note.updated_at !== note.created_at;
    return (_jsxs("li", { className: "group rounded-sm border border-border/70 bg-card p-5", children: [_jsxs("div", { className: "mb-3 flex items-start justify-between gap-4", children: [_jsxs("div", { className: "font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground", children: [format(new Date(note.created_at), 'd MMM yyyy · HH:mm'), edited && (_jsxs("span", { className: "ml-2 text-muted-foreground/60", children: ["\u00B7 edited ", format(new Date(note.updated_at), 'd MMM')] }))] }), _jsxs(DropdownMenu, { children: [_jsx(DropdownMenuTrigger, { asChild: true, children: _jsx(Button, { variant: "ghost", size: "icon", className: "h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100 data-[state=open]:opacity-100", children: _jsx(MoreVertical, { className: "h-4 w-4" }) }) }), _jsxs(DropdownMenuContent, { align: "end", children: [_jsxs(DropdownMenuItem, { onSelect: onEdit, children: [_jsx(Pencil, { className: "h-3.5 w-3.5" }), "Edit"] }), _jsxs(DropdownMenuItem, { destructive: true, onSelect: onDelete, children: [_jsx(Trash2, { className: "h-3.5 w-3.5" }), "Delete"] })] })] })] }), _jsx("p", { className: "whitespace-pre-wrap font-serif text-[15px] leading-[1.65] tracking-tight", children: note.body }), note.tags.length > 0 && (_jsx("div", { className: "mt-4 flex flex-wrap gap-1.5 border-t border-border/70 pt-3", children: note.tags.map((t) => (_jsx("span", { className: "rounded-sm bg-secondary px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground", children: t }, t))) }))] }));
}
function NoteFormDialog({ open, onOpenChange, patientId, note, }) {
    const create = useCreateNote(patientId);
    const update = useUpdateNote(patientId);
    const isEdit = Boolean(note);
    const mutation = isEdit ? update : create;
    const form = useForm({
        resolver: zodResolver(noteFormSchema),
        defaultValues: {
            body: note?.body ?? '',
            tagsText: (note?.tags ?? []).join(', '),
        },
    });
    // Reset whenever the dialog opens against a different note (or for a fresh one).
    useEffect(() => {
        if (!open)
            return;
        form.reset({
            body: note?.body ?? '',
            tagsText: (note?.tags ?? []).join(', '),
        });
    }, [open, note, form]);
    async function onSubmit(values) {
        const tags = parseTags(values.tagsText);
        try {
            if (isEdit && note) {
                await update.mutateAsync({ id: note.id, body: values.body, tags });
                toast.success('Note updated.');
            }
            else {
                await create.mutateAsync({ body: values.body, tags });
                toast.success('Note saved.');
            }
            onOpenChange(false);
        }
        catch (err) {
            toast.error(err instanceof Error ? err.message : 'Save failed.');
        }
    }
    return (_jsx(Dialog, { open: open, onOpenChange: (v) => {
            onOpenChange(v);
        }, children: _jsxs(DialogContent, { className: "max-w-2xl", children: [_jsxs(DialogHeader, { children: [_jsxs("div", { className: "font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground", children: [isEdit ? 'Edit note' : 'New note', " \u00B7 private to you"] }), _jsx(DialogTitle, { children: isEdit ? 'Refine the observation.' : (_jsxs(_Fragment, { children: ["A note for ", _jsx("em", { className: "text-accent", children: "the chart." })] })) }), _jsx(DialogDescription, { children: "Clinical notes are never visible to the patient." })] }), _jsxs("form", { onSubmit: form.handleSubmit(onSubmit), className: "space-y-5", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "note-body", className: "font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground", children: "Body" }), _jsx(Textarea, { id: "note-body", rows: 8, placeholder: "Observations, plan, questions for next visit\u2026", className: "font-serif text-[15px] leading-[1.65]", "aria-invalid": Boolean(form.formState.errors.body) || undefined, ...form.register('body') }), form.formState.errors.body && (_jsx("p", { className: "text-xs text-destructive", children: form.formState.errors.body.message }))] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "note-tags", className: "font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground", children: "Tags \u00B7 comma-separated" }), _jsx(Input, { id: "note-tags", placeholder: "follow-up, imaging, bruxism", "aria-invalid": Boolean(form.formState.errors.tagsText) || undefined, ...form.register('tagsText') }), form.formState.errors.tagsText && (_jsx("p", { className: "text-xs text-destructive", children: form.formState.errors.tagsText.message }))] }), _jsxs(DialogFooter, { children: [_jsx(Button, { type: "button", variant: "outline", onClick: () => onOpenChange(false), children: "Cancel" }), _jsx(Button, { type: "submit", disabled: mutation.isPending || form.formState.isSubmitting, children: mutation.isPending ? 'Saving…' : isEdit ? 'Save' : 'Create note' })] })] })] }) }));
}
export default NotesTab;
