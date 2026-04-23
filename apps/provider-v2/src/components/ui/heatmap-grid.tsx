import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export interface HeatmapCell {
  date: string;
  value: number | null;
}

export interface HeatmapGridProps {
  cells: HeatmapCell[];
  className?: string;
  legend?: boolean;
}

function bucketClass(value: number | null) {
  if (value == null) return 'bg-secondary/60';
  if (value >= 8) return 'bg-err';
  if (value >= 6) return 'bg-err/70';
  if (value >= 4) return 'bg-warn';
  if (value >= 2) return 'bg-warn/50';
  if (value > 0) return 'bg-ok/50';
  return 'bg-ok/25';
}

export function HeatmapGrid({ cells, className, legend = true }: HeatmapGridProps) {
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <TooltipProvider delayDuration={120}>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((c) => (
            <Tooltip key={c.date}>
              <TooltipTrigger asChild>
                <div
                  className={cn(
                    'aspect-square rounded-sm border border-border/40 transition-transform hover:scale-110',
                    bucketClass(c.value),
                  )}
                  aria-label={`${c.date}: ${c.value ?? 'no entry'}`}
                />
              </TooltipTrigger>
              <TooltipContent side="top">
                {c.date} · {c.value == null ? 'no entry' : `pain ${c.value}`}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </TooltipProvider>
      {legend && (
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          <span>Less</span>
          <div className="flex gap-1">
            <span className="h-2.5 w-2.5 rounded-sm bg-secondary/60" />
            <span className="h-2.5 w-2.5 rounded-sm bg-ok/25" />
            <span className="h-2.5 w-2.5 rounded-sm bg-warn/50" />
            <span className="h-2.5 w-2.5 rounded-sm bg-warn" />
            <span className="h-2.5 w-2.5 rounded-sm bg-err/70" />
            <span className="h-2.5 w-2.5 rounded-sm bg-err" />
          </div>
          <span>More</span>
        </div>
      )}
    </div>
  );
}
