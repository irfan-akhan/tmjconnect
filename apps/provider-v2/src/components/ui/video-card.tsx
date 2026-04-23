import { Play } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface VideoCardProps {
  title: string;
  category?: string;
  duration?: string;
  thumbnailUrl?: string | null;
  byline?: string;
  assignedCount?: number;
  completionPct?: number;
  onClick?: () => void;
  className?: string;
}

export function VideoCard({
  title,
  category,
  duration,
  thumbnailUrl,
  byline,
  assignedCount,
  completionPct,
  onClick,
  className,
}: VideoCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group flex flex-col overflow-hidden rounded-sm border border-border/70 bg-card text-left shadow-navy-xs transition hover:-translate-y-0.5 hover:shadow-navy-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
    >
      <div className="relative aspect-video w-full overflow-hidden bg-gradient-to-br from-navy-700 to-navy-900">
        {thumbnailUrl ? (
          <img src={thumbnailUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-gold-600/70">
            <Play className="h-10 w-10 fill-current" strokeWidth={0} />
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-foreground/0 transition group-hover:bg-foreground/15">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gold-600 text-navy-900 opacity-0 transition group-hover:opacity-100">
            <Play className="h-4 w-4 fill-current" strokeWidth={0} />
          </div>
        </div>
        {category && (
          <Badge variant="navy" className="absolute left-2 top-2">
            {category}
          </Badge>
        )}
        {duration && (
          <span className="absolute right-2 top-2 rounded-sm bg-foreground/70 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-background">
            {duration}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-2 p-4">
        <h3 className="font-serif text-base leading-tight tracking-tightest text-foreground">{title}</h3>
        {byline && (
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{byline}</p>
        )}
        {(assignedCount != null || completionPct != null) && (
          <div className="mt-2 flex flex-col gap-1.5">
            {assignedCount != null && (
              <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                <span>Assigned · {assignedCount}</span>
                {completionPct != null && <span>{Math.round(completionPct)}%</span>}
              </div>
            )}
            {completionPct != null && (
              <div className="h-1 w-full overflow-hidden rounded-sm bg-secondary">
                <div
                  className="h-full bg-ok"
                  style={{ width: `${Math.max(0, Math.min(100, completionPct))}%` }}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </button>
  );
}
