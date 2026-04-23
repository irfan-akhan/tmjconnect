import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from 'react';
import { cva } from 'class-variance-authority';
import { TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
const filterPillVariants = cva('inline-flex items-center gap-1.5 rounded-sm border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', {
    variants: {
        variant: {
            default: 'border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground',
            active: 'border-transparent bg-gold-600 text-navy-900 hover:bg-gold-500',
            urgent: 'border-transparent bg-err/10 text-err-dark hover:bg-err/15',
        },
    },
    defaultVariants: { variant: 'default' },
});
export const FilterPill = React.forwardRef(({ className, variant, count, active, urgent, icon, children, ...props }, ref) => {
    const resolved = variant ?? (active ? 'active' : urgent ? 'urgent' : 'default');
    return (_jsxs("button", { ref: ref, type: "button", className: cn(filterPillVariants({ variant: resolved }), className), "aria-pressed": active, ...props, children: [(icon ?? (urgent && !active ? _jsx(TriangleAlert, { className: "h-3 w-3" }) : null)) || null, _jsx("span", { children: children }), typeof count === 'number' && (_jsx("span", { className: cn('ml-1 rounded-sm px-1 py-0.5 text-[10px] tracking-wider', active
                    ? 'bg-navy-900/15 text-navy-900'
                    : urgent
                        ? 'bg-err/15 text-err-dark'
                        : 'bg-secondary text-muted-foreground'), children: count }))] }));
});
FilterPill.displayName = 'FilterPill';
