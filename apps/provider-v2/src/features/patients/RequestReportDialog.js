import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Send } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useCreateReportRequest } from './report-requests-queries';
const TEMPLATES = [
    'Could you file a quick update on your pain levels this week?',
    'Please submit a report with photos of the affected area today.',
    'How has your jaw mobility been since we adjusted your exercises?',
];
export function RequestReportDialog({ open, onOpenChange, patientId, patientName }) {
    const create = useCreateReportRequest(patientId);
    const [prompt, setPrompt] = useState('');
    async function onSubmit(e) {
        e.preventDefault();
        try {
            await create.mutateAsync({ prompt: prompt.trim() });
            toast.success('Report request sent to patient.');
            setPrompt('');
            onOpenChange(false);
        }
        catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to send.');
        }
    }
    return (_jsx(Dialog, { open: open, onOpenChange: (v) => {
            if (!v)
                setPrompt('');
            onOpenChange(v);
        }, children: _jsxs(DialogContent, { className: "max-w-lg", children: [_jsxs(DialogHeader, { children: [_jsx("div", { className: "font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground", children: "Request a report" }), _jsx(DialogTitle, { children: patientName ? (_jsxs(_Fragment, { children: ["Ask ", _jsx("em", { className: "text-accent", children: patientName }), " to file a report."] })) : ('Ask your patient to file a report.') }), _jsx(DialogDescription, { children: "They'll be notified and can submit directly from their app." })] }), _jsxs("form", { onSubmit: onSubmit, className: "space-y-5", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { className: "font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground", children: "Starters" }), _jsx("div", { className: "flex flex-col gap-1.5", children: TEMPLATES.map((t) => (_jsx("button", { type: "button", onClick: () => setPrompt(t), className: cn('rounded-sm border px-3 py-2 text-left text-sm transition-colors', prompt === t
                                            ? 'border-foreground bg-secondary text-foreground'
                                            : 'border-border bg-card text-muted-foreground hover:border-foreground/40 hover:text-foreground'), children: t }, t))) })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { className: "font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground", children: "Message to patient" }), _jsx(Textarea, { value: prompt, onChange: (e) => setPrompt(e.target.value), rows: 4, required: true, placeholder: "Be specific about what you need them to share\u2026" }), _jsxs("div", { className: "flex justify-end font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground", children: [prompt.length, "/2000"] })] }), create.isError && (_jsx("p", { className: "text-sm text-destructive", children: create.error instanceof Error ? create.error.message : 'Failed to send.' })), _jsxs(DialogFooter, { children: [_jsx(Button, { type: "button", variant: "outline", onClick: () => onOpenChange(false), children: "Cancel" }), _jsxs(Button, { type: "submit", disabled: create.isPending || !prompt.trim(), children: [_jsx(Send, { className: "h-4 w-4" }), create.isPending ? 'Sending…' : 'Send request'] })] })] })] }) }));
}
