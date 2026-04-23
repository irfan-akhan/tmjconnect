import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useProviderCreateReport } from './report-requests-queries';
const URGENCIES = [
    { value: 'routine', label: 'Routine', tone: 'border-border text-muted-foreground' },
    { value: 'concerning', label: 'Concerning', tone: 'border-accent/30 text-accent' },
    { value: 'urgent', label: 'Urgent', tone: 'border-destructive/30 text-destructive' },
];
export function FileOnBehalfDialog({ open, onOpenChange, patientId, patientName, fulfillingRequestId, }) {
    const create = useProviderCreateReport(patientId);
    const [urgency, setUrgency] = useState('routine');
    const [painLevel, setPainLevel] = useState('');
    const [description, setDescription] = useState('');
    const [patientNotes, setPatientNotes] = useState('');
    function reset() {
        setUrgency('routine');
        setPainLevel('');
        setDescription('');
        setPatientNotes('');
    }
    async function onSubmit(e) {
        e.preventDefault();
        try {
            await create.mutateAsync({
                urgency,
                pain_level: painLevel === '' ? null : painLevel,
                description: description.trim(),
                patient_notes: patientNotes.trim() || null,
                fulfilling_request_id: fulfillingRequestId,
            });
            toast.success('Report filed.');
            reset();
            onOpenChange(false);
        }
        catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to file.');
        }
    }
    return (_jsx(Dialog, { open: open, onOpenChange: (v) => {
            if (!v)
                reset();
            onOpenChange(v);
        }, children: _jsxs(DialogContent, { className: "max-w-2xl", children: [_jsxs(DialogHeader, { children: [_jsx("div", { className: "font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground", children: "File a report \u00B7 on behalf" }), _jsx(DialogTitle, { children: patientName ? (_jsxs(_Fragment, { children: ["For ", _jsx("em", { className: "text-accent", children: patientName }), "."] })) : ('File on your patient\'s behalf.') }), _jsx(DialogDescription, { children: "Use this when the patient can't \u2014 notes from a phone call, in-person visit, or urgent escalation. The report is logged with provider authorship." })] }), _jsxs("form", { onSubmit: onSubmit, className: "space-y-5", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { className: "font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground", children: "Urgency" }), _jsx("div", { className: "flex flex-wrap gap-1.5", children: URGENCIES.map((u) => (_jsx("button", { type: "button", onClick: () => setUrgency(u.value), className: cn('rounded-sm border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] transition-colors', urgency === u.value
                                            ? 'border-foreground bg-foreground text-background'
                                            : `bg-card ${u.tone} hover:border-foreground/40`), children: u.label }, u.value))) })] }), _jsx("div", { className: "grid grid-cols-[1fr_auto] gap-4", children: _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "pain_level", className: "font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground", children: "Pain level \u00B7 0\u201310" }), _jsx(Input, { id: "pain_level", type: "number", min: 0, max: 10, value: painLevel, onChange: (e) => {
                                            const v = e.target.value;
                                            if (v === '')
                                                return setPainLevel('');
                                            setPainLevel(Math.max(0, Math.min(10, Number(v))));
                                        }, placeholder: "\u2014" })] }) }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { className: "font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground", children: "Description" }), _jsx(Textarea, { value: description, onChange: (e) => setDescription(e.target.value), rows: 5, required: true, placeholder: "What happened. Relevant history. What you observed." })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { className: "font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground", children: "Patient quotes \u00B7 optional" }), _jsx(Textarea, { value: patientNotes, onChange: (e) => setPatientNotes(e.target.value), rows: 3, placeholder: "Direct quotes from the patient, if relevant." })] }), create.isError && (_jsx("p", { className: "text-sm text-destructive", children: create.error instanceof Error ? create.error.message : 'Failed to file.' })), _jsxs(DialogFooter, { children: [_jsx(Button, { type: "button", variant: "outline", onClick: () => onOpenChange(false), children: "Cancel" }), _jsx(Button, { type: "submit", disabled: create.isPending || !description.trim(), children: create.isPending ? 'Filing…' : 'File report' })] })] })] }) }));
}
