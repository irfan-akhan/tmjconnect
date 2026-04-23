import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from 'react';
import { Line, LineChart, ResponsiveContainer, YAxis } from 'recharts';
import { cn } from '@/lib/utils';
function severityStroke(avg) {
    if (avg >= 7)
        return 'hsl(0, 53%, 48%)';
    if (avg >= 4)
        return 'hsl(31, 80%, 44%)';
    return 'hsl(154, 70%, 32%)';
}
export function Sparkline({ data, width = '100%', height = 32, className, stroke }) {
    const points = React.useMemo(() => data.map((v, i) => ({ i, v: v ?? null })), [data]);
    const numeric = data.filter((v) => typeof v === 'number');
    const avg = numeric.length ? numeric.reduce((a, b) => a + b, 0) / numeric.length : 0;
    const color = stroke ?? severityStroke(avg);
    if (!numeric.length) {
        return (_jsx("div", { className: cn('h-8 w-full rounded-sm bg-secondary/60', className), style: { height }, "aria-label": "No data" }));
    }
    return (_jsx("div", { className: cn('w-full', className), style: { width, height }, children: _jsx(ResponsiveContainer, { width: "100%", height: "100%", children: _jsxs(LineChart, { data: points, margin: { top: 2, right: 2, bottom: 2, left: 2 }, children: [_jsx(YAxis, { hide: true, domain: [0, 10] }), _jsx(Line, { type: "monotone", dataKey: "v", stroke: color, strokeWidth: 1.5, dot: false, isAnimationActive: false, connectNulls: true })] }) }) }));
}
