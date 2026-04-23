import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Command } from 'cmdk';
import { ArrowRight, Dumbbell, FileText, LayoutDashboard, Link2, Moon, Plus, Settings, Sun, Users, } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useTheme } from '@/components/ThemeProvider';
import { useGenerateCode } from '@/features/linking/queries';
import { cn } from '@/lib/utils';
function usePatientSearch(query) {
    return useQuery({
        queryKey: ['cmdk', 'patients', query],
        queryFn: () => apiFetch('/providers/patients', {
            query: { page: 1, limit: 8, search: query || undefined },
        }).then((r) => r.data),
        staleTime: 10_000,
    });
}
export function CommandPalette({ open, onOpenChange }) {
    const navigate = useNavigate();
    const { theme, toggle } = useTheme();
    const generate = useGenerateCode();
    const [query, setQuery] = useState('');
    const patients = usePatientSearch(query);
    function close() {
        onOpenChange(false);
        setQuery('');
    }
    function go(path) {
        close();
        navigate(path);
    }
    async function onGenerateCode() {
        close();
        await generate.mutateAsync();
        navigate('/linking');
    }
    return (_jsx(DialogPrimitive.Root, { open: open, onOpenChange: onOpenChange, children: _jsxs(DialogPrimitive.Portal, { children: [_jsx(DialogPrimitive.Overlay, { className: "fixed inset-0 z-50 bg-foreground/20 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" }), _jsxs(DialogPrimitive.Content, { "aria-describedby": undefined, className: "fixed left-1/2 top-[12vh] z-50 w-[92vw] max-w-xl -translate-x-1/2 rounded-sm border border-border/70 bg-popover shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95", children: [_jsx(DialogPrimitive.Title, { className: "sr-only", children: "Command menu" }), _jsxs(Command, { label: "Command menu", children: [_jsxs("div", { className: "flex items-center gap-3 border-b border-border/70 px-4", children: [_jsx("span", { className: "font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground", children: "\u2318K" }), _jsx(Command.Input, { value: query, onValueChange: setQuery, placeholder: "Jump to patient, page, or action\u2026", className: "flex-1 bg-transparent py-4 text-sm outline-none placeholder:text-muted-foreground" }), _jsx("span", { className: "font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground", children: "esc" })] }), _jsxs(Command.List, { className: "max-h-[60vh] overflow-y-auto p-2", children: [_jsx(Command.Empty, { className: "px-3 py-8 text-center font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground", children: "Nothing matches." }), (patients.data?.length ?? 0) > 0 && (_jsx(Group, { label: "Patients", children: patients.data.map((p) => (_jsxs(Item, { value: `patient ${p.first_name} ${p.last_name}`, onSelect: () => go(`/patients/${p.patient_id}`), children: [_jsx("div", { className: "flex h-6 w-6 items-center justify-center rounded-sm bg-secondary font-mono text-[10px] tracking-wider text-muted-foreground", children: `${p.first_name?.[0] ?? ''}${p.last_name?.[0] ?? ''}`.toUpperCase() }), _jsxs("span", { className: "flex-1 truncate font-serif text-sm tracking-tightest", children: [p.first_name, " ", p.last_name] }), p.avg_pain_7d != null && (_jsxs("span", { className: "font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground", children: ["Pain ", p.avg_pain_7d.toFixed(1)] })), _jsx(ArrowRight, { className: "h-3.5 w-3.5 text-muted-foreground" })] }, p.patient_id))) })), _jsxs(Group, { label: "Go to", children: [_jsxs(Item, { value: "go dashboard overview home", onSelect: () => go('/dashboard'), children: [_jsx(LayoutDashboard, { className: "h-4 w-4 stroke-[1.5] text-muted-foreground" }), "Dashboard", _jsx(Shortcut, { keys: ['G', 'D'] })] }), _jsxs(Item, { value: "go patients people", onSelect: () => go('/patients'), children: [_jsx(Users, { className: "h-4 w-4 stroke-[1.5] text-muted-foreground" }), "Patients", _jsx(Shortcut, { keys: ['G', 'P'] })] }), _jsxs(Item, { value: "go reports inbox", onSelect: () => go('/reports'), children: [_jsx(FileText, { className: "h-4 w-4 stroke-[1.5] text-muted-foreground" }), "Reports inbox", _jsx(Shortcut, { keys: ['G', 'R'] })] }), _jsxs(Item, { value: "go exercises library", onSelect: () => go('/exercises'), children: [_jsx(Dumbbell, { className: "h-4 w-4 stroke-[1.5] text-muted-foreground" }), "Exercise library", _jsx(Shortcut, { keys: ['G', 'E'] })] }), _jsxs(Item, { value: "go linking codes invite", onSelect: () => go('/linking'), children: [_jsx(Link2, { className: "h-4 w-4 stroke-[1.5] text-muted-foreground" }), "Linking codes", _jsx(Shortcut, { keys: ['G', 'L'] })] }), _jsxs(Item, { value: "go settings profile sessions", onSelect: () => go('/settings'), children: [_jsx(Settings, { className: "h-4 w-4 stroke-[1.5] text-muted-foreground" }), "Settings", _jsx(Shortcut, { keys: ['G', 'S'] })] })] }), _jsxs(Group, { label: "Actions", children: [_jsxs(Item, { value: "action generate linking code new patient invite", onSelect: onGenerateCode, children: [_jsx(Plus, { className: "h-4 w-4 stroke-[1.5] text-muted-foreground" }), "Generate new linking code"] }), _jsxs(Item, { value: "action toggle theme dark light mode", onSelect: () => {
                                                        toggle();
                                                        close();
                                                    }, children: [theme === 'dark' ? (_jsx(Sun, { className: "h-4 w-4 stroke-[1.5] text-muted-foreground" })) : (_jsx(Moon, { className: "h-4 w-4 stroke-[1.5] text-muted-foreground" })), "Switch to ", theme === 'dark' ? 'light' : 'dark', " mode"] })] })] })] })] })] }) }));
}
function Group({ label, children }) {
    return (_jsx(Command.Group, { heading: label, className: "pb-2 [&_[cmdk-group-heading]]:mb-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.22em] [&_[cmdk-group-heading]]:text-muted-foreground", children: children }));
}
function Item({ value, onSelect, children, }) {
    return (_jsx(Command.Item, { value: value, onSelect: onSelect, className: cn('flex cursor-pointer items-center gap-3 rounded-sm px-2 py-2 text-sm outline-none', 'data-[selected=true]:bg-secondary data-[selected=true]:text-foreground'), children: children }));
}
function Shortcut({ keys }) {
    return (_jsx("span", { className: "ml-auto flex gap-1", children: keys.map((k) => (_jsx("kbd", { className: "rounded-sm border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground", children: k }, k))) }));
}
/** ⌘K / Ctrl+K to toggle; `g X` prefix for route navigation. */
export function useCommandPaletteHotkeys({ onToggle, onNavigate, }) {
    const bindings = useMemo(() => ({
        d: '/dashboard',
        p: '/patients',
        r: '/reports',
        e: '/exercises',
        l: '/linking',
        s: '/settings',
    }), []);
    const state = useMemo(() => ({ gPressedAt: 0 }), []);
    useEffect(() => {
        function onKey(e) {
            const target = e.target;
            const isEditable = target &&
                (target.tagName === 'INPUT' ||
                    target.tagName === 'TEXTAREA' ||
                    target.isContentEditable);
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                onToggle();
                return;
            }
            if (isEditable)
                return;
            if (e.key === 'g' && !e.metaKey && !e.ctrlKey && !e.altKey) {
                state.gPressedAt = Date.now();
                return;
            }
            const within = Date.now() - state.gPressedAt < 800;
            if (within && bindings[e.key.toLowerCase()]) {
                e.preventDefault();
                onNavigate(bindings[e.key.toLowerCase()]);
                state.gPressedAt = 0;
            }
        }
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [bindings, onNavigate, onToggle, state]);
}
