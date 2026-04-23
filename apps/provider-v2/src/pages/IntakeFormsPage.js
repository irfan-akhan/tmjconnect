import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { format } from 'date-fns';
import { ChevronDown, ChevronUp, ClipboardList, GripVertical, Pencil, Plus, Send, Trash2, X, } from 'lucide-react';
import { Avatar, AvatarFallback, initials } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useAssignIntakeForm, useCreateIntakeForm, useDeleteIntakeForm, useIntakeForms, useIntakeResponses, useUpdateIntakeForm, } from '@/features/intake/queries';
import { usePatients } from '@/features/patients/queries';
const FIELD_TYPES = [
    { value: 'scale', label: 'Pain scale (0–10)' },
    { value: 'checkbox', label: 'Checkbox list' },
    { value: 'text', label: 'Free text' },
    { value: 'select', label: 'Single select' },
    { value: 'number', label: 'Number' },
];
export function IntakeFormsPage() {
    const { data: forms, isLoading } = useIntakeForms();
    const [editorOpen, setEditorOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [viewingResponses, setViewingResponses] = useState(null);
    const [assigning, setAssigning] = useState(null);
    const del = useDeleteIntakeForm();
    const allForms = forms ?? [];
    const published = allForms.filter((f) => f.status === 'published');
    const drafts = allForms.filter((f) => f.status === 'draft');
    function openNew() {
        setEditing(null);
        setEditorOpen(true);
    }
    function openEdit(form) {
        setEditing(form);
        setEditorOpen(true);
    }
    return (_jsxs("div", { className: "mx-auto max-w-6xl space-y-6", children: [_jsx(PageHeader, { eyebrow: "Manage \u00B7 Intake forms", title: _jsxs(_Fragment, { children: ["Custom ", _jsx("em", { className: "not-italic text-gold-700", children: "forms." })] }), description: _jsxs(_Fragment, { children: ["Build questionnaires and assign them to patients during onboarding or check-ins \u00B7", ' ', _jsxs("span", { className: "text-foreground", children: [published.length, " published"] }), " \u00B7", ' ', _jsxs("span", { className: "text-foreground", children: [drafts.length, " draft"] })] }), actions: _jsxs(Button, { size: "sm", onClick: openNew, children: [_jsx(Plus, { className: "mr-2 h-3.5 w-3.5" }), "New form"] }) }), isLoading ? (_jsx("div", { className: "grid gap-4 md:grid-cols-2", children: Array.from({ length: 4 }).map((_, i) => (_jsx(Skeleton, { className: "h-44" }, i))) })) : allForms.length === 0 ? (_jsx(EmptyState, { icon: _jsx(ClipboardList, { className: "h-6 w-6" }), title: "No forms yet.", description: "Create your first intake form \u2014 add pain scales, checkboxes, text fields, and more.", action: _jsx(Button, { onClick: openNew, children: "Create your first form" }) })) : (_jsx("div", { className: "grid gap-4 md:grid-cols-2", children: allForms.map((form) => (_jsx(FormCard, { form: form, onEdit: () => openEdit(form), onDelete: () => del.mutate(form.id), onAssign: () => setAssigning(form), onView: () => setViewingResponses(form) }, form.id))) })), _jsx(FormEditorDialog, { open: editorOpen, onOpenChange: setEditorOpen, form: editing }), viewingResponses && (_jsx(ResponsesDialog, { open: Boolean(viewingResponses), onOpenChange: () => setViewingResponses(null), form: viewingResponses })), assigning && (_jsx(AssignFormDialog, { open: Boolean(assigning), onOpenChange: () => setAssigning(null), form: assigning }))] }));
}
function FormCard({ form, onEdit, onDelete, onAssign, onView, }) {
    const fields = form.fields ?? [];
    return (_jsxs("article", { className: "group flex flex-col rounded-sm border border-border/70 bg-card shadow-navy-xs transition hover:shadow-navy-sm", children: [_jsxs("header", { className: "flex items-start justify-between border-b border-border/60 p-5", children: [_jsxs("div", { className: "min-w-0 flex-1", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("h3", { className: "truncate font-serif text-lg leading-tight tracking-tightest text-foreground", children: form.title }), _jsx(Badge, { variant: form.status === 'published' ? 'improving' : 'fyi', children: form.status })] }), form.description && (_jsx("p", { className: "mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground", children: form.description }))] }), _jsxs("div", { className: "flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100", children: [_jsx(Button, { variant: "ghost", size: "icon", onClick: onEdit, "aria-label": "Edit form", className: "h-7 w-7", children: _jsx(Pencil, { className: "h-3.5 w-3.5" }) }), _jsx(Button, { variant: "ghost", size: "icon", onClick: onDelete, "aria-label": "Delete form", className: "h-7 w-7", children: _jsx(Trash2, { className: "h-3.5 w-3.5" }) })] })] }), _jsxs("footer", { className: "flex items-center justify-between p-4", children: [_jsxs("span", { className: "font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground", children: [fields.length, " field", fields.length === 1 ? '' : 's', " \u00B7 Updated", ' ', format(new Date(form.updated_at), 'd MMM')] }), _jsxs("div", { className: "flex gap-2", children: [form.status === 'published' && (_jsxs(Button, { variant: "default", size: "sm", onClick: onAssign, children: [_jsx(Send, { className: "mr-1.5 h-3.5 w-3.5" }), "Assign"] })), _jsx(Button, { variant: "outline", size: "sm", onClick: onView, children: "Responses" })] })] })] }));
}
// ─── Form editor ──────────────────────────────────────────────────────────
function FormEditorDialog({ open, onOpenChange, form, }) {
    const isEdit = Boolean(form);
    const create = useCreateIntakeForm();
    const update = useUpdateIntakeForm(form?.id ?? '');
    const [title, setTitle] = useState(form?.title ?? '');
    const [description, setDescription] = useState(form?.description ?? '');
    const [fields, setFields] = useState(form?.fields ?? []);
    const [status, setStatus] = useState(form?.status ?? 'draft');
    function addField() {
        setFields([...fields, { type: 'text', label: '', required: false, order: fields.length }]);
    }
    function updateField(index, partial) {
        setFields(fields.map((f, i) => (i === index ? { ...f, ...partial } : f)));
    }
    function removeField(index) {
        setFields(fields.filter((_, i) => i !== index).map((f, i) => ({ ...f, order: i })));
    }
    function moveField(index, dir) {
        const j = index + dir;
        if (j < 0 || j >= fields.length)
            return;
        const next = [...fields];
        [next[index], next[j]] = [next[j], next[index]];
        setFields(next.map((f, i) => ({ ...f, order: i })));
    }
    async function onSave() {
        const payload = { title, description: description || undefined, fields, status };
        if (isEdit) {
            await update.mutateAsync(payload);
        }
        else {
            await create.mutateAsync(payload);
        }
        onOpenChange(false);
    }
    const busy = create.isPending || update.isPending;
    return (_jsx(Dialog, { open: open, onOpenChange: onOpenChange, children: _jsxs(DialogContent, { className: "max-h-[85vh] max-w-3xl overflow-y-auto", children: [_jsxs(DialogHeader, { children: [_jsx("div", { className: "font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground", children: isEdit ? 'Edit form' : 'New intake form' }), _jsx(DialogTitle, { children: isEdit ? ('Edit your questionnaire.') : (_jsxs(_Fragment, { children: ["Design a ", _jsx("em", { className: "not-italic text-gold-700", children: "questionnaire." })] })) }), _jsx(DialogDescription, { children: "Add fields, set requirements, then publish when ready." })] }), _jsxs("div", { className: "space-y-5", children: [_jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { className: "font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground", children: "Title" }), _jsx(Input, { value: title, onChange: (e) => setTitle(e.target.value), placeholder: "e.g. Initial TMJ assessment", required: true })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { className: "font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground", children: "Status" }), _jsx("div", { className: "flex gap-2", children: ['draft', 'published'].map((s) => (_jsx("button", { type: "button", onClick: () => setStatus(s), className: cn('flex-1 rounded-sm border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] transition-colors', status === s
                                                    ? 'border-navy-600 bg-navy-600 text-background'
                                                    : 'border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground'), children: s }, s))) })] })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { className: "font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground", children: "Description" }), _jsx(Textarea, { value: description, onChange: (e) => setDescription(e.target.value), placeholder: "Instructions shown to the patient before they start.", rows: 2 })] }), _jsxs("div", { children: [_jsxs("div", { className: "mb-3 flex items-center justify-between", children: [_jsxs(Label, { className: "font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground", children: ["Fields (", fields.length, ")"] }), _jsxs(Button, { type: "button", variant: "outline", size: "sm", onClick: addField, children: [_jsx(Plus, { className: "mr-1.5 h-3.5 w-3.5" }), " Add field"] })] }), fields.length === 0 ? (_jsx("div", { className: "rounded-sm border border-dashed border-border bg-secondary/20 p-8 text-center text-sm text-muted-foreground", children: "No fields yet. Click \"Add field\" to start building." })) : (_jsx("ul", { className: "space-y-3", children: fields.map((field, i) => (_jsxs("li", { className: "flex gap-3 rounded-sm border border-border/70 bg-secondary/20 p-4", children: [_jsxs("div", { className: "flex flex-col items-center gap-1 pt-1", children: [_jsx("button", { type: "button", onClick: () => moveField(i, -1), disabled: i === 0, className: "text-muted-foreground disabled:opacity-30", children: _jsx(ChevronUp, { className: "h-3.5 w-3.5" }) }), _jsx(GripVertical, { className: "h-3.5 w-3.5 text-muted-foreground/40" }), _jsx("button", { type: "button", onClick: () => moveField(i, 1), disabled: i === fields.length - 1, className: "text-muted-foreground disabled:opacity-30", children: _jsx(ChevronDown, { className: "h-3.5 w-3.5" }) })] }), _jsxs("div", { className: "flex-1 space-y-3", children: [_jsxs("div", { className: "grid grid-cols-[1fr_auto_auto] gap-3", children: [_jsx(Input, { value: field.label, onChange: (e) => updateField(i, { label: e.target.value }), placeholder: "Field label" }), _jsx("select", { value: field.type, onChange: (e) => updateField(i, { type: e.target.value }), className: "rounded-sm border border-border bg-card px-3 py-2 text-xs", children: FIELD_TYPES.map((t) => (_jsx("option", { value: t.value, children: t.label }, t.value))) }), _jsxs("label", { className: "flex items-center gap-2 text-xs text-muted-foreground", children: [_jsx("input", { type: "checkbox", checked: field.required, onChange: (e) => updateField(i, { required: e.target.checked }), className: "accent-navy-600" }), "Required"] })] }), (field.type === 'checkbox' || field.type === 'select') && (_jsx(Input, { value: (field.options ?? []).join(', '), onChange: (e) => updateField(i, {
                                                            options: e.target.value
                                                                .split(',')
                                                                .map((s) => s.trim())
                                                                .filter(Boolean),
                                                        }), placeholder: "Options (comma-separated): e.g. Clicking, Aching, Sharp", className: "text-xs" })), field.type === 'scale' && (_jsxs("div", { className: "flex items-center gap-3", children: [_jsx(Input, { type: "number", value: field.min ?? 0, onChange: (e) => updateField(i, { min: Number(e.target.value) }), placeholder: "Min", className: "w-20 text-xs" }), _jsx("span", { className: "text-xs text-muted-foreground", children: "to" }), _jsx(Input, { type: "number", value: field.max ?? 10, onChange: (e) => updateField(i, { max: Number(e.target.value) }), placeholder: "Max", className: "w-20 text-xs" })] }))] }), _jsx("button", { type: "button", onClick: () => removeField(i), className: "self-start text-muted-foreground transition-colors hover:text-destructive", "aria-label": "Remove field", children: _jsx(X, { className: "h-4 w-4" }) })] }, i))) }))] })] }), _jsxs(DialogFooter, { children: [_jsx(Button, { variant: "outline", onClick: () => onOpenChange(false), children: "Cancel" }), _jsx(Button, { onClick: onSave, disabled: busy || !title.trim(), children: busy ? 'Saving…' : isEdit ? 'Save changes' : 'Create form' })] })] }) }));
}
function ResponsesDialog({ open, onOpenChange, form, }) {
    const { data: responses, isLoading } = useIntakeResponses(form.id);
    return (_jsx(Dialog, { open: open, onOpenChange: onOpenChange, children: _jsxs(DialogContent, { className: "max-h-[80vh] max-w-2xl overflow-y-auto", children: [_jsxs(DialogHeader, { children: [_jsxs(DialogTitle, { children: ["Responses \u00B7 ", form.title] }), _jsxs(DialogDescription, { children: [responses?.length ?? 0, " response", (responses?.length ?? 0) === 1 ? '' : 's', " submitted."] })] }), isLoading ? (_jsx("div", { className: "space-y-3", children: Array.from({ length: 3 }).map((_, i) => (_jsx(Skeleton, { className: "h-20" }, i))) })) : !responses || responses.length === 0 ? (_jsx("div", { className: "py-10 text-center text-sm text-muted-foreground", children: "No responses yet. Assign this form to patients to start collecting data." })) : (_jsx("ul", { className: "space-y-3", children: responses.map((r) => (_jsxs("li", { className: "rounded-sm border border-border/70 p-4", children: [_jsxs("div", { className: "mb-3 flex items-center justify-between", children: [_jsx("span", { className: "font-serif text-sm tracking-tightest text-foreground", children: r.patient_name }), _jsx("span", { className: "font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground", children: format(new Date(r.submitted_at), 'd MMM yyyy · HH:mm') })] }), _jsx("div", { className: "space-y-2", children: r.answers.map((a, i) => (_jsxs("div", { className: "flex justify-between border-b border-border/40 pb-2 last:border-0 last:pb-0", children: [_jsx("span", { className: "text-xs text-muted-foreground", children: a.field_label }), _jsx("span", { className: "text-xs text-foreground", children: Array.isArray(a.value) ? a.value.join(', ') : String(a.value) })] }, i))) })] }, r.id))) }))] }) }));
}
function AssignFormDialog({ open, onOpenChange, form, }) {
    const [search, setSearch] = useState('');
    const { data: patientsData, isLoading } = usePatients({
        page: 1,
        limit: 50,
        search: search || undefined,
    });
    const assign = useAssignIntakeForm(form.id);
    const patients = patientsData?.data ?? [];
    async function onAssign(patientId) {
        await assign.mutateAsync(patientId);
        onOpenChange(false);
    }
    return (_jsx(Dialog, { open: open, onOpenChange: onOpenChange, children: _jsxs(DialogContent, { className: "max-w-lg", children: [_jsxs(DialogHeader, { children: [_jsx("div", { className: "font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground", children: "Assign form" }), _jsxs(DialogTitle, { children: ["Send ", _jsx("em", { className: "not-italic text-gold-700", children: form.title }), " to a patient"] }), _jsx(DialogDescription, { children: "They'll see this form in their app and can fill it out at their own pace." })] }), _jsxs("div", { className: "space-y-4", children: [_jsx(Input, { placeholder: "Search patients\u2026", value: search, onChange: (e) => setSearch(e.target.value) }), _jsx("div", { className: "max-h-64 overflow-y-auto rounded-sm border border-border/70", children: isLoading ? (_jsx("div", { className: "p-6 text-center font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground", children: "Loading\u2026" })) : patients.length === 0 ? (_jsx("div", { className: "p-6 text-center text-sm text-muted-foreground", children: search ? 'No patients match your search.' : 'No linked patients yet.' })) : (_jsx("ul", { className: "divide-y divide-border/60", children: patients.map((p) => (_jsx("li", { children: _jsxs("button", { type: "button", onClick: () => onAssign(p.patient_id), disabled: assign.isPending, className: "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/40 disabled:opacity-50", children: [_jsx(Avatar, { size: "sm", children: _jsx(AvatarFallback, { children: initials(p.first_name, p.last_name) }) }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsxs("div", { className: "truncate font-serif text-sm tracking-tightest", children: [p.first_name, " ", p.last_name] }), _jsxs("div", { className: "font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground", children: ["Linked ", format(new Date(p.linked_at), 'd MMM yyyy')] })] }), _jsx(Send, { className: "h-3.5 w-3.5 text-muted-foreground" })] }) }, p.patient_id))) })) })] }), _jsx(DialogFooter, { children: _jsx(Button, { variant: "outline", onClick: () => onOpenChange(false), children: "Cancel" }) })] }) }));
}
