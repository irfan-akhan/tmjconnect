import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
function bucketClass(value) {
    if (value == null)
        return 'bg-secondary/60';
    if (value >= 8)
        return 'bg-err';
    if (value >= 6)
        return 'bg-err/70';
    if (value >= 4)
        return 'bg-warn';
    if (value >= 2)
        return 'bg-warn/50';
    if (value > 0)
        return 'bg-ok/50';
    return 'bg-ok/25';
}
export function HeatmapGrid({ cells, className, legend = true }) {
    return (_jsxs("div", { className: cn('flex flex-col gap-3', className), children: [_jsx(TooltipProvider, { delayDuration: 120, children: _jsx("div", { className: "grid grid-cols-7 gap-1", children: cells.map((c) => (_jsxs(Tooltip, { children: [_jsx(TooltipTrigger, { asChild: true, children: _jsx("div", { className: cn('aspect-square rounded-sm border border-border/40 transition-transform hover:scale-110', bucketClass(c.value)), "aria-label": `${c.date}: ${c.value ?? 'no entry'}` }) }), _jsxs(TooltipContent, { side: "top", children: [c.date, " \u00B7 ", c.value == null ? 'no entry' : `pain ${c.value}`] })] }, c.date))) }) }), legend && (_jsxs("div", { className: "flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground", children: [_jsx("span", { children: "Less" }), _jsxs("div", { className: "flex gap-1", children: [_jsx("span", { className: "h-2.5 w-2.5 rounded-sm bg-secondary/60" }), _jsx("span", { className: "h-2.5 w-2.5 rounded-sm bg-ok/25" }), _jsx("span", { className: "h-2.5 w-2.5 rounded-sm bg-warn/50" }), _jsx("span", { className: "h-2.5 w-2.5 rounded-sm bg-warn" }), _jsx("span", { className: "h-2.5 w-2.5 rounded-sm bg-err/70" }), _jsx("span", { className: "h-2.5 w-2.5 rounded-sm bg-err" })] }), _jsx("span", { children: "More" })] }))] }));
}
