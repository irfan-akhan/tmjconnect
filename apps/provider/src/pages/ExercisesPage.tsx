import { useState } from 'react';
import { format } from 'date-fns';
import { ChevronLeft, ChevronRight, Dumbbell, Pencil, Trash2, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ExerciseFormDialog } from '@/features/exercises/ExerciseFormDialog';
import { useDeleteExercise, useExercises, type Exercise } from '@/features/exercises/queries';

const LIMIT = 12;

function formatDuration(seconds: number | null) {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s.toString().padStart(2, '0')}s` : `${s}s`;
}

export function ExercisesPage() {
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Exercise | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Exercise | null>(null);

  const { data, isLoading, isError, error } = useExercises({ page, limit: LIMIT });
  const del = useDeleteExercise();

  const rows = data?.data ?? [];
  const meta = data?.meta;
  const totalPages = meta?.totalPages ?? 1;

  function onNew() {
    setEditing(null);
    setFormOpen(true);
  }
  function onEdit(ex: Exercise) {
    setEditing(ex);
    setFormOpen(true);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-10">
      <header className="flex items-end justify-between gap-8 border-b border-border/70 pb-8">
        <div>
          <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            Folio № 03 — Library
            {meta && (
              <span className="ml-3 text-muted-foreground/60">
                {meta.total.toString().padStart(3, '0')} exercises
              </span>
            )}
          </div>
          <h1 className="font-serif text-5xl tracking-tightest">
            Your prescribed <em className="text-accent">movements.</em>
          </h1>
        </div>
        <Button onClick={onNew}>New exercise</Button>
      </header>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-56 animate-pulse rounded-sm bg-secondary" />
          ))}
        </div>
      ) : isError ? (
        <p className="text-sm text-destructive">
          {error instanceof Error ? error.message : 'Failed to load exercises.'}
        </p>
      ) : rows.length === 0 ? (
        <div className="rounded-sm border border-dashed border-border bg-card/60 p-16 text-center">
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-sm bg-secondary">
            <Dumbbell className="h-6 w-6 stroke-[1.5]" />
          </div>
          <h2 className="font-serif text-3xl tracking-tightest">An empty library.</h2>
          <p className="mx-auto mt-3 max-w-sm text-sm text-muted-foreground">
            Start with the first exercise — record a short demonstration and
            write a few lines about the movement.
          </p>
          <Button className="mt-8" onClick={onNew}>
            Create your first exercise
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((ex) => (
            <ExerciseCard
              key={ex.id}
              ex={ex}
              onEdit={() => onEdit(ex)}
              onDelete={() => setDeleteTarget(ex)}
            />
          ))}
        </div>
      )}

      {meta && meta.total > 0 && (
        <footer className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          <span>
            Page {String(meta.page).padStart(2, '0')} / {String(totalPages).padStart(2, '0')}
          </span>
          <div className="flex gap-1">
            <Button variant="outline" size="icon" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </footer>
      )}

      <ExerciseFormDialog open={formOpen} onOpenChange={setFormOpen} exercise={editing} />

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Remove this exercise?</DialogTitle>
            <DialogDescription>
              Active assignments referencing <strong className="font-serif text-foreground">{deleteTarget?.title}</strong> will remain — but you won't be able to assign it to new patients.
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

function ExerciseCard({
  ex,
  onEdit,
  onDelete,
}: {
  ex: Exercise;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="group relative flex flex-col rounded-sm border border-border/70 bg-card transition-shadow hover:shadow-sm">
      {/* Preview */}
      <div className="relative aspect-video overflow-hidden rounded-t-sm bg-secondary">
        {ex.thumbnail_url ? (
          <img src={ex.thumbnail_url} alt="" className="h-full w-full object-cover" />
        ) : ex.video_url ? (
          <video src={ex.video_url} className="h-full w-full object-cover" muted />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Dumbbell className="h-10 w-10 stroke-[1] text-muted-foreground/40" />
          </div>
        )}
        {ex.video_url && (
          <div className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-sm bg-foreground/80 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-background">
            <Video className="h-3 w-3" />
            Video
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-serif text-lg leading-tight tracking-tightest">{ex.title}</h3>
        </div>
        {ex.category && (
          <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            {ex.category}
          </div>
        )}
        {ex.description && (
          <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {ex.description}
          </p>
        )}

        <div className="mt-auto flex items-end justify-between pt-5">
          <dl className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            <dt className="text-muted-foreground/60">Duration</dt>
            <dd className="text-foreground normal-case tracking-normal">{formatDuration(ex.duration_seconds)}</dd>
            <dt className="mt-1 text-muted-foreground/60">Added</dt>
            <dd className="text-foreground normal-case tracking-normal">{format(new Date(ex.created_at), 'd MMM yyyy')}</dd>
          </dl>
          <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <Button variant="ghost" size="icon" onClick={onEdit} aria-label="Edit">
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onDelete} aria-label="Delete">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}
