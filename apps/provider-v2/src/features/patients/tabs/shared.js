import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Activity } from 'lucide-react';
export function SkeletonList() {
    return (_jsx("div", { className: "space-y-2", children: Array.from({ length: 4 }).map((_, i) => (_jsx("div", { className: "h-20 animate-pulse rounded-sm bg-secondary" }, i))) }));
}
export function EmptyState({ icon: Icon = Activity, title, body, cta, }) {
    return (_jsxs("div", { className: "rounded-sm border border-dashed border-border bg-card/60 p-16 text-center", children: [_jsx("div", { className: "mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-sm bg-secondary", children: _jsx(Icon, { className: "h-6 w-6 stroke-[1.5]" }) }), _jsx("h2", { className: "font-serif text-2xl tracking-tightest", children: title }), _jsx("p", { className: "mx-auto mt-3 max-w-sm text-sm text-muted-foreground", children: body }), cta && _jsx("div", { className: "mt-6", children: cta })] }));
}
