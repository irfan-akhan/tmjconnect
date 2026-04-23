import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Check, Dumbbell, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useExercises } from '@/features/exercises/queries';
import { useDebounced } from '@/hooks/useDebounced';
import { useCreateAssignment } from './assignment-mutations';
const FREQUENCIES = ['daily', '2x daily', '3x daily', 'alt days', 'weekly'];
export function AssignExerciseDialog({ open, onOpenChange, patientId, patientName }) {
    const [search, setSearch] = useState('');
    const debouncedSearch = useDebounced(search, 250);
    const [selected, setSelected] = useState(null);
    const [frequency, setFrequency] = useState('daily');
    const [sets, setSets] = useState(1);
    const { data, isLoading } = useExercises({ page: 1, limit: 50 });
    const create = useCreateAssignment(patientId);
    const filtered = (data?.data ?? []).filter((ex) => debouncedSearch
        ? `${ex.title} ${ex.category ?? ''}`.toLowerCase().includes(debouncedSearch.toLowerCase())
        : true);
    function reset() {
        setSearch('');
        setSelected(null);
        setFrequency('daily');
        setSets(1);
    }
    async function onAssign(e) {
        e.preventDefault();
        if (!selected)
            return;
        await create.mutateAsync({
            exercise_id: selected.id,
            frequency,
            sets,
        });
        reset();
        onOpenChange(false);
    }
    return (_jsx(Dialog, { open: open, onOpenChange: (v) => {
            if (!v)
                reset();
            onOpenChange(v);
        }, children: _jsxs(DialogContent, { className: "max-w-3xl", children: [_jsxs(DialogHeader, { children: [_jsx("div", { className: "font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground", children: "New assignment" }), _jsx(DialogTitle, { children: patientName ? (_jsxs(_Fragment, { children: ["Prescribe a movement for ", _jsx("em", { className: "text-accent", children: patientName }), "."] })) : ('Prescribe a movement.') }), _jsx(DialogDescription, { children: "Pick one from your library, then set the cadence." })] }), _jsxs("form", { onSubmit: onAssign, className: "space-y-5", children: [_jsxs("div", { className: "relative", children: [_jsx(Search, { className: "pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 stroke-[1.5] text-muted-foreground" }), _jsx(Input, { placeholder: "Search your library\u2026", value: search, onChange: (e) => setSearch(e.target.value), className: "pl-9" })] }), _jsx("div", { className: "max-h-72 overflow-y-auto rounded-sm border border-border/70", children: isLoading ? (_jsx("div", { className: "p-8 text-center font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground", children: "Loading\u2026" })) : filtered.length === 0 ? (_jsxs("div", { className: "p-8 text-center", children: [_jsx(Dumbbell, { className: "mx-auto h-6 w-6 stroke-[1.5] text-muted-foreground" }), _jsx("p", { className: "mt-3 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground", children: debouncedSearch ? 'No matches in your library.' : 'Your library is empty. Add an exercise first.' })] })) : (_jsx("ul", { className: "divide-y divide-border/70", children: filtered.map((ex) => {
                                    const active = selected?.id === ex.id;
                                    return (_jsx("li", { children: _jsxs("button", { type: "button", onClick: () => setSelected(ex), className: cn('grid w-full grid-cols-[auto_1fr_auto] items-center gap-4 bg-card px-4 py-3 text-left transition-colors hover:bg-secondary/40', active && 'bg-secondary'), children: [_jsx("div", { className: cn('flex h-8 w-8 items-center justify-center rounded-sm border', active ? 'border-foreground bg-foreground text-background' : 'border-border bg-background'), children: active ? _jsx(Check, { className: "h-4 w-4" }) : _jsx(Dumbbell, { className: "h-4 w-4 stroke-[1.5] text-muted-foreground" }) }), _jsxs("div", { className: "min-w-0", children: [_jsx("div", { className: "truncate font-serif text-base tracking-tightest", children: ex.title }), ex.category && (_jsx("div", { className: "font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground", children: ex.category }))] }), ex.duration_seconds && (_jsxs("div", { className: "font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground", children: [Math.round(ex.duration_seconds / 60), "m"] }))] }) }, ex.id));
                                }) })) }), _jsxs("div", { className: "grid grid-cols-[2fr_1fr] gap-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsx(Label, { className: "font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground", children: "Frequency" }), _jsx("div", { className: "flex flex-wrap gap-1.5", children: FREQUENCIES.map((f) => (_jsx("button", { type: "button", onClick: () => setFrequency(f), className: cn('rounded-sm border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] transition-colors', frequency === f
                                                    ? 'border-foreground bg-foreground text-background'
                                                    : 'border-border bg-card text-muted-foreground hover:border-foreground/40 hover:text-foreground'), children: f }, f))) })] }), _jsxs("div", { className: "space-y-2", children: [_jsx(Label, { htmlFor: "sets", className: "font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground", children: "Sets" }), _jsx(Input, { id: "sets", type: "number", min: 1, value: sets, onChange: (e) => setSets(Math.max(1, Number(e.target.value) || 1)) })] })] }), create.isError && (_jsx("p", { className: "text-sm text-destructive", children: create.error instanceof Error ? create.error.message : 'Failed to assign.' })), _jsxs(DialogFooter, { children: [_jsx(Button, { type: "button", variant: "outline", onClick: () => onOpenChange(false), children: "Cancel" }), _jsx(Button, { type: "submit", disabled: !selected || create.isPending, children: create.isPending ? 'Assigning…' : 'Assign exercise' })] })] })] }) }));
}
