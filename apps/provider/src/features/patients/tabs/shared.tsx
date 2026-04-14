import type { LucideIcon } from 'lucide-react';
import { Activity } from 'lucide-react';

export function SkeletonList() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-20 animate-pulse rounded-sm bg-secondary" />
      ))}
    </div>
  );
}

export function EmptyState({
  icon: Icon = Activity,
  title,
  body,
  cta,
}: {
  icon?: LucideIcon;
  title: string;
  body: string;
  cta?: React.ReactNode;
}) {
  return (
    <div className="rounded-sm border border-dashed border-border bg-card/60 p-16 text-center">
      <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-sm bg-secondary">
        <Icon className="h-6 w-6 stroke-[1.5]" />
      </div>
      <h2 className="font-serif text-2xl tracking-tightest">{title}</h2>
      <p className="mx-auto mt-3 max-w-sm text-sm text-muted-foreground">{body}</p>
      {cta && <div className="mt-6">{cta}</div>}
    </div>
  );
}
