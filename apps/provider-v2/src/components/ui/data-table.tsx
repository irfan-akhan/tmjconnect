import * as React from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SortDir = 'asc' | 'desc';
export type SortState<K extends string = string> = { key: K; dir: SortDir } | null;

export interface DataColumn<T, K extends string = string> {
  key: K;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  sortable?: boolean;
  width?: string;
  align?: 'left' | 'right' | 'center';
  className?: string;
}

export interface DataTableProps<T, K extends string = string> {
  columns: DataColumn<T, K>[];
  rows: T[];
  rowKey: (row: T) => string;
  sort?: SortState<K>;
  onSortChange?: (sort: SortState<K>) => void;
  onRowClick?: (row: T) => void;
  rowClassName?: (row: T) => string | undefined;
  emptyState?: React.ReactNode;
  page?: number;
  pageSize?: number;
  total?: number;
  onPageChange?: (page: number) => void;
  loading?: boolean;
}

export function DataTable<T, K extends string = string>({
  columns,
  rows,
  rowKey,
  sort,
  onSortChange,
  onRowClick,
  rowClassName,
  emptyState,
  page = 1,
  pageSize,
  total,
  onPageChange,
  loading,
}: DataTableProps<T, K>) {
  function handleSort(col: DataColumn<T, K>) {
    if (!col.sortable || !onSortChange) return;
    if (!sort || sort.key !== col.key) {
      onSortChange({ key: col.key, dir: 'desc' });
    } else if (sort.dir === 'desc') {
      onSortChange({ key: col.key, dir: 'asc' });
    } else {
      onSortChange(null);
    }
  }

  const showPagination = pageSize != null && total != null && onPageChange != null;
  const lastPage = showPagination ? Math.max(1, Math.ceil(total! / pageSize!)) : 1;

  return (
    <div className="overflow-hidden rounded-sm border border-border/70 bg-card">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border/70 bg-secondary/40">
              {columns.map((col) => {
                const isSorted = sort?.key === col.key;
                const Icon = !isSorted ? ArrowUpDown : sort?.dir === 'asc' ? ArrowUp : ArrowDown;
                const align = col.align ?? 'left';
                return (
                  <th
                    key={col.key}
                    style={{ width: col.width }}
                    className={cn(
                      'px-4 py-3 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground',
                      align === 'right' && 'text-right',
                      align === 'center' && 'text-center',
                      col.className,
                    )}
                  >
                    {col.sortable ? (
                      <button
                        type="button"
                        onClick={() => handleSort(col)}
                        className={cn(
                          'inline-flex items-center gap-1.5 transition-colors hover:text-foreground',
                          align === 'right' && 'flex-row-reverse',
                          isSorted && 'text-foreground',
                        )}
                      >
                        {col.header}
                        <Icon className="h-3 w-3" />
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={`s-${i}`} className="border-b border-border/40">
                  {columns.map((c) => (
                    <td key={c.key} className="px-4 py-4">
                      <div className="h-4 w-3/4 animate-pulse rounded-sm bg-secondary" />
                    </td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12">
                  {emptyState ?? (
                    <div className="text-center font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                      Nothing here yet.
                    </div>
                  )}
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const extra = rowClassName?.(row);
                return (
                  <tr
                    key={rowKey(row)}
                    onClick={() => onRowClick?.(row)}
                    className={cn(
                      'border-b border-border/40 transition-colors last:border-b-0',
                      onRowClick && 'cursor-pointer hover:bg-secondary/40',
                      extra,
                    )}
                  >
                    {columns.map((col) => {
                      const align = col.align ?? 'left';
                      return (
                        <td
                          key={col.key}
                          className={cn(
                            'px-4 py-3 align-middle text-sm text-foreground',
                            align === 'right' && 'text-right',
                            align === 'center' && 'text-center',
                            col.className,
                          )}
                        >
                          {col.cell(row)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {showPagination && (
        <div className="flex items-center justify-between border-t border-border/70 bg-secondary/30 px-4 py-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          <div>
            {total === 0 ? 'No results' : `Page ${page} of ${lastPage} · ${total} total`}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onPageChange!(Math.max(1, page - 1))}
              disabled={page <= 1}
              className="inline-flex h-7 w-7 items-center justify-center rounded-sm border border-border bg-card transition-colors hover:bg-secondary disabled:pointer-events-none disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onPageChange!(Math.min(lastPage, page + 1))}
              disabled={page >= lastPage}
              className="inline-flex h-7 w-7 items-center justify-center rounded-sm border border-border bg-card transition-colors hover:bg-secondary disabled:pointer-events-none disabled:opacity-40"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
