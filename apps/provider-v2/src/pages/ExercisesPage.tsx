import { useMemo, useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import {
  BarChart3,
  Dumbbell,
  Pencil,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { FilterPill } from '@/components/ui/filter-pill';
import { PageHeader } from '@/components/ui/page-header';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ExerciseFormDialog } from '@/features/exercises/ExerciseFormDialog';
import { useDeleteExercise, useExercises, type Exercise } from '@/features/exercises/queries';

const LIMIT = 24;
type SortKey = 'recent' | 'title';
const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: 'recent', label: 'Most recent' },
  { value: 'title', label: 'Title (A → Z)' },
];

const CATEGORIES = ['Jaw Mobility', 'Stretching', 'Strengthening', 'Relaxation'];

function formatDuration(seconds: number | null) {
  if (!seconds) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function ExercisesPage() {
  const [page, setPage] = useState(1);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>('recent');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Exercise | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Exercise | null>(null);

  const { data, isLoading, isError, error } = useExercises({ page, limit: LIMIT });
  const del = useDeleteExercise();

  const allRows = data?.data ?? [];
  const total = data?.meta?.total ?? 0;

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const cat of CATEGORIES) map[cat] = 0;
    for (const ex of allRows) {
      const cat = ex.category;
      if (cat && map[cat] !== undefined) map[cat] += 1;
    }
    return map;
  }, [allRows]);

  const filteredRows = useMemo(() => {
    let next = allRows;
    if (filterCategory) next = next.filter((ex) => ex.category === filterCategory);
    const sorted = [...next];
    if (sort === 'title') sorted.sort((a, b) => a.title.localeCompare(b.title));
    if (sort === 'recent')
      sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return sorted;
  }, [allRows, filterCategory, sort]);

  const lastUpload = useMemo(() => {
    if (allRows.length === 0) return null;
    return allRows.reduce((latest, ex) =>
      new Date(ex.created_at) > new Date(latest.created_at) ? ex : latest,
    );
  }, [allRows]);

  function onNew() {
    setEditing(null);
    setFormOpen(true);
  }
  function onEdit(ex: Exercise) {
    setEditing(ex);
    setFormOpen(true);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <PageHeader
        eyebrow="Exercise library"
        title="Record once, prescribe forever."
        description={
          <>
            <span className="text-foreground">{total}</span> exercise
            {total === 1 ? '' : 's'} across {CATEGORIES.length} categories
            {lastUpload && (
              <>
                {' · '}Last upload{' '}
                <span className="text-foreground">
                  {formatDistanceToNow(new Date(lastUpload.created_at), { addSuffix: true })}
                </span>
              </>
            )}
          </>
        }
        actions={
          <>
            <Button variant="outline" size="sm">
              <BarChart3 className="mr-2 h-3.5 w-3.5" />
              Analytics
            </Button>
            <Button size="sm" onClick={onNew}>
              <Upload className="mr-2 h-3.5 w-3.5" />
              Upload new video
            </Button>
          </>
        }
      />

      {/* Filters + sort */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <FilterPill
            active={filterCategory === null}
            count={allRows.length}
            onClick={() => setFilterCategory(null)}
          >
            All exercises
          </FilterPill>
          {CATEGORIES.map((cat) => (
            <FilterPill
              key={cat}
              active={filterCategory === cat}
              count={counts[cat] ?? 0}
              onClick={() => setFilterCategory(cat)}
            >
              {cat}
            </FilterPill>
          ))}
        </div>
        <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-72" />
          ))}
        </div>
      ) : isError ? (
        <EmptyState
          title="Couldn't load exercises."
          description={error instanceof Error ? error.message : 'Unknown error'}
        />
      ) : filteredRows.length === 0 ? (
        <EmptyState
          icon={<Dumbbell className="h-6 w-6" />}
          title={filterCategory ? 'No exercises in this category yet.' : 'An empty library.'}
          description={
            filterCategory
              ? 'Switch categories or upload a new video.'
              : 'Record a short demonstration and write a few lines about the movement.'
          }
          action={<Button onClick={onNew}>Create your first exercise</Button>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredRows.map((ex) => (
            <ExerciseCardItem
              key={ex.id}
              ex={ex}
              onEdit={() => onEdit(ex)}
              onDelete={() => setDeleteTarget(ex)}
            />
          ))}
        </div>
      )}

      {data?.meta && data.meta.total > LIMIT && (
        <div className="flex items-center justify-between border-t border-border/70 pt-4 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          <span>
            Page {page} / {data.meta.totalPages} · {data.meta.total} total
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= (data.meta.totalPages ?? 1)}
              onClick={() => setPage((p) => Math.min(data.meta!.totalPages, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <ExerciseFormDialog open={formOpen} onOpenChange={setFormOpen} exercise={editing} />

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Remove this exercise?</DialogTitle>
            <DialogDescription>
              Active assignments referencing{' '}
              <strong className="font-serif text-foreground">{deleteTarget?.title}</strong> will
              remain — but you won't be able to assign it to new patients.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={del.isPending}
              onClick={async () => {
                if (!deleteTarget) return;
                await del.mutateAsync(deleteTarget.id);
                setDeleteTarget(null);
              }}
            >
              {del.isPending ? 'Removing…' : 'Remove'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ExerciseCardItem({
  ex,
  onEdit,
  onDelete,
}: {
  ex: Exercise;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const completionLabel =
    ex.completion_pct == null ? '—' : `${ex.completion_pct}% completion`;
  const assignmentLabel =
    ex.assignment_count === 0
      ? 'Not assigned'
      : ex.active_assignment_count === ex.assignment_count
        ? `${ex.assignment_count} assigned`
        : `${ex.active_assignment_count} active · ${ex.assignment_count} total`;
  return (
    <div className="group relative">
      <article className="flex flex-col overflow-hidden rounded-sm border border-border/70 bg-card shadow-navy-xs transition hover:-translate-y-0.5 hover:shadow-navy-sm">
        <div className="relative aspect-video w-full overflow-hidden bg-gradient-to-br from-navy-700 to-navy-900">
          {ex.thumbnail_url ? (
            <img src={ex.thumbnail_url} alt="" className="h-full w-full object-cover" />
          ) : ex.video_url ? (
            <video src={ex.video_url} className="h-full w-full object-cover" muted />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-gold-600/70">
              <Dumbbell className="h-12 w-12" strokeWidth={1.25} />
            </div>
          )}
          {ex.category && (
            <span className="absolute left-2 top-2 rounded-sm bg-navy-700/80 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-background backdrop-blur-sm">
              {ex.category}
            </span>
          )}
          {formatDuration(ex.duration_seconds) && (
            <span className="absolute right-2 top-2 rounded-sm bg-foreground/70 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-background">
              {formatDuration(ex.duration_seconds)}
            </span>
          )}
        </div>
        <div className="flex flex-col gap-2 p-4">
          <h3 className="font-serif text-base leading-tight tracking-tightest text-foreground">
            {ex.title}
          </h3>
          {ex.description && (
            <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
              {ex.description}
            </p>
          )}
          <div className="mt-1 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            <span>{assignmentLabel}</span>
            <span className="text-muted-foreground/80">{completionLabel}</span>
          </div>
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
            Added {format(new Date(ex.created_at), 'd MMM yyyy')}
          </div>
        </div>
      </article>
      <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <Button variant="outline" size="icon" onClick={onEdit} aria-label="Edit" className="h-7 w-7 bg-card/95 backdrop-blur">
          <Pencil className="h-3 w-3" />
        </Button>
        <Button variant="outline" size="icon" onClick={onDelete} aria-label="Delete" className="h-7 w-7 bg-card/95 backdrop-blur">
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

// Plus icon kept for any future toolbar usage of the same module.
export const _Plus = Plus;
