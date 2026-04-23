import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
export function DataTable({ columns, rows, rowKey, sort, onSortChange, onRowClick, rowClassName, emptyState, page = 1, pageSize, total, onPageChange, loading, }) {
    function handleSort(col) {
        if (!col.sortable || !onSortChange)
            return;
        if (!sort || sort.key !== col.key) {
            onSortChange({ key: col.key, dir: 'desc' });
        }
        else if (sort.dir === 'desc') {
            onSortChange({ key: col.key, dir: 'asc' });
        }
        else {
            onSortChange(null);
        }
    }
    const showPagination = pageSize != null && total != null && onPageChange != null;
    const lastPage = showPagination ? Math.max(1, Math.ceil(total / pageSize)) : 1;
    return (_jsxs("div", { className: "overflow-hidden rounded-sm border border-border/70 bg-card", children: [_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full border-collapse", children: [_jsx("thead", { children: _jsx("tr", { className: "border-b border-border/70 bg-secondary/40", children: columns.map((col) => {
                                    const isSorted = sort?.key === col.key;
                                    const Icon = !isSorted ? ArrowUpDown : sort?.dir === 'asc' ? ArrowUp : ArrowDown;
                                    const align = col.align ?? 'left';
                                    return (_jsx("th", { style: { width: col.width }, className: cn('px-4 py-3 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground', align === 'right' && 'text-right', align === 'center' && 'text-center', col.className), children: col.sortable ? (_jsxs("button", { type: "button", onClick: () => handleSort(col), className: cn('inline-flex items-center gap-1.5 transition-colors hover:text-foreground', align === 'right' && 'flex-row-reverse', isSorted && 'text-foreground'), children: [col.header, _jsx(Icon, { className: "h-3 w-3" })] })) : (col.header) }, col.key));
                                }) }) }), _jsx("tbody", { children: loading && rows.length === 0 ? (Array.from({ length: 5 }).map((_, i) => (_jsx("tr", { className: "border-b border-border/40", children: columns.map((c) => (_jsx("td", { className: "px-4 py-4", children: _jsx("div", { className: "h-4 w-3/4 animate-pulse rounded-sm bg-secondary" }) }, c.key))) }, `s-${i}`)))) : rows.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: columns.length, className: "px-4 py-12", children: emptyState ?? (_jsx("div", { className: "text-center font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground", children: "Nothing here yet." })) }) })) : (rows.map((row) => {
                                const extra = rowClassName?.(row);
                                return (_jsx("tr", { onClick: () => onRowClick?.(row), className: cn('border-b border-border/40 transition-colors last:border-b-0', onRowClick && 'cursor-pointer hover:bg-secondary/40', extra), children: columns.map((col) => {
                                        const align = col.align ?? 'left';
                                        return (_jsx("td", { className: cn('px-4 py-3 align-middle text-sm text-foreground', align === 'right' && 'text-right', align === 'center' && 'text-center', col.className), children: col.cell(row) }, col.key));
                                    }) }, rowKey(row)));
                            })) })] }) }), showPagination && (_jsxs("div", { className: "flex items-center justify-between border-t border-border/70 bg-secondary/30 px-4 py-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground", children: [_jsx("div", { children: total === 0 ? 'No results' : `Page ${page} of ${lastPage} · ${total} total` }), _jsxs("div", { className: "flex items-center gap-1", children: [_jsx("button", { type: "button", onClick: () => onPageChange(Math.max(1, page - 1)), disabled: page <= 1, className: "inline-flex h-7 w-7 items-center justify-center rounded-sm border border-border bg-card transition-colors hover:bg-secondary disabled:pointer-events-none disabled:opacity-40", children: _jsx(ChevronLeft, { className: "h-3.5 w-3.5" }) }), _jsx("button", { type: "button", onClick: () => onPageChange(Math.min(lastPage, page + 1)), disabled: page >= lastPage, className: "inline-flex h-7 w-7 items-center justify-center rounded-sm border border-border bg-card transition-colors hover:bg-secondary disabled:pointer-events-none disabled:opacity-40", children: _jsx(ChevronRight, { className: "h-3.5 w-3.5" }) })] })] }))] }));
}
