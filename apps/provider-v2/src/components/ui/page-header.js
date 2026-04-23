import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cn } from '@/lib/utils';
export function PageHeader({ eyebrow, title, description, actions, className, ...props }) {
    return (_jsxs("div", { className: cn('flex flex-col gap-4 border-b border-border/60 pb-6 sm:flex-row sm:items-end sm:justify-between', className), ...props, children: [_jsxs("div", { className: "space-y-2", children: [eyebrow && (_jsx("div", { className: "font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground", children: eyebrow })), _jsx("h1", { className: "font-serif text-3xl leading-tight tracking-tightest text-foreground sm:text-4xl", children: title }), description && (_jsx("p", { className: "max-w-2xl text-sm text-muted-foreground", children: description }))] }), actions && _jsx("div", { className: "flex shrink-0 items-center gap-2", children: actions })] }));
}
