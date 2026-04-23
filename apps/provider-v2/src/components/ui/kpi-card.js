import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';
const kpiVariants = cva('relative flex flex-col gap-3 rounded-sm border border-border/70 bg-card p-5 shadow-navy-xs transition-shadow hover:shadow-navy-sm', {
    variants: {
        accent: {
            none: '',
            gold: 'before:absolute before:inset-x-0 before:top-0 before:h-0.5 before:bg-gold-600',
            urgent: 'before:absolute before:inset-x-0 before:top-0 before:h-0.5 before:bg-err',
            ok: 'before:absolute before:inset-x-0 before:top-0 before:h-0.5 before:bg-ok',
            navy: 'before:absolute before:inset-x-0 before:top-0 before:h-0.5 before:bg-navy-600',
        },
    },
    defaultVariants: { accent: 'none' },
});
export const KpiCard = React.forwardRef(({ className, accent, label, value, delta, trend, icon, hint, ...props }, ref) => {
    const TrendIcon = trend === 'up' ? ArrowUpRight : trend === 'down' ? ArrowDownRight : Minus;
    return (_jsxs("div", { ref: ref, className: cn(kpiVariants({ accent }), className), ...props, children: [_jsxs("div", { className: "flex items-start justify-between", children: [_jsx("span", { className: "font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground", children: label }), icon ? _jsx("span", { className: "text-muted-foreground", children: icon }) : null] }), _jsx("div", { className: "font-serif text-4xl leading-none tracking-tightest text-foreground", children: value }), (delta || hint) && (_jsxs("div", { className: "flex items-center gap-2 text-xs text-muted-foreground", children: [delta && (_jsxs("span", { className: cn('inline-flex items-center gap-1 font-medium', trend === 'up' && 'text-ok-dark', trend === 'down' && 'text-err-dark'), children: [_jsx(TrendIcon, { className: "h-3 w-3" }), delta] })), hint && _jsx("span", { className: "text-muted-foreground", children: hint })] }))] }));
});
KpiCard.displayName = 'KpiCard';
