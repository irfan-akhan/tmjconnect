import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cn } from '@/lib/utils';
export function EmptyState({ icon, title, description, action, className, ...props }) {
    return (_jsxs("div", { className: cn('flex flex-col items-center justify-center gap-3 rounded-sm border border-dashed border-border/70 bg-card/40 p-10 text-center', className), ...props, children: [icon && (_jsx("div", { className: "flex h-12 w-12 items-center justify-center rounded-sm bg-secondary text-muted-foreground", children: icon })), _jsx("h3", { className: "font-serif text-xl tracking-tightest text-foreground", children: title }), description && (_jsx("p", { className: "max-w-md text-sm text-muted-foreground", children: description })), action && _jsx("div", { className: "pt-2", children: action })] }));
}
