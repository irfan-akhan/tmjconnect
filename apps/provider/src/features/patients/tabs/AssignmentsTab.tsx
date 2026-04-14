import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Check, Dumbbell, MoreVertical, Pause, Play, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { usePatientAssignments, type Assignment } from '@/features/patients/detail-queries';
import {
  useDeleteAssignment,
  useUpdateAssignment,
  type AssignmentStatus,
} from '@/features/patients/assignment-mutations';
import { EmptyState, SkeletonList } from './shared';

const FREQUENCIES = ['daily', '2x daily', '3x daily', 'alt days', 'weekly'];

export function AssignmentsTab({ patientId, onAssign }: { patientId: string; onAssign: () => void }) {
  const q = usePatientAssignments(patientId);
  const [deleteTarget, setDeleteTarget] = useState<Assignment | null>(null);
  const del = useDeleteAssignment(patientId);

  if (q.isLoading) return <SkeletonList />;
  if (q.isError) {
    return (
      <p className="py-8 text-sm text-destructive">
        {q.error instanceof Error ? q.error.message : 'Failed to load assignments.'}
      </p>
    );
  }
  if (!q.data || q.data.length === 0) {
    return (
      <EmptyState
        icon={Dumbbell}
        title="No exercises assigned."
        body="Pick from your library to create the first assignment."
        cta={<Button onClick={onAssign}>Assign an exercise</Button>}
      />
    );
  }

  const grouped: Record<AssignmentStatus, Assignment[]> = { active: [], paused: [], completed: [] };
  for (const a of q.data) grouped[a.status]?.push(a);

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-3">
        {(['active', 'paused', 'completed'] as const).map((status) => (
          <section key={status} className="space-y-3">
            <div className="flex items-baseline justify-between border-b border-border/70 pb-2">
              <h3 className="font-mono text-[11px] uppercase tracking-[0.22em]">{status}</h3>
              <span className="font-mono text-[10px] text-muted-foreground">
                {grouped[status].length.toString().padStart(2, '0')}
              </span>
            </div>
            {grouped[status].length === 0 ? (
              <p className="py-8 text-center font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                None
              </p>
            ) : (
              grouped[status].map((a) => (
                <AssignmentCard
                  key={a.id}
                  assignment={a}
                  patientId={patientId}
                  onDelete={() => setDeleteTarget(a)}
                />
              ))
            )}
          </section>
        ))}
      </div>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Remove this assignment?</DialogTitle>
            <DialogDescription>
              <strong className="font-serif text-foreground">{deleteTarget?.title}</strong> will no longer appear in the patient's plan. Completion history is preserved.
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
    </>
  );
}

function AssignmentCard({
  assignment,
  patientId,
  onDelete,
}: {
  assignment: Assignment;
  patientId: string;
  onDelete: () => void;
}) {
  const update = useUpdateAssignment(patientId);
  const [editOpen, setEditOpen] = useState(false);
  const a = assignment;

  function setStatus(status: AssignmentStatus) {
    update.mutate({ assignmentId: a.id, body: { status } });
  }

  return (
    <>
      <article className="group relative rounded-sm border border-border/70 bg-card p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="font-serif text-lg tracking-tightest">{a.title}</div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100 data-[state=open]:opacity-100">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setEditOpen(true)}>
                Edit cadence
              </DropdownMenuItem>
              {a.status === 'active' && (
                <DropdownMenuItem onSelect={() => setStatus('paused')}>
                  <Pause className="h-3.5 w-3.5" />
                  Pause
                </DropdownMenuItem>
              )}
              {a.status === 'paused' && (
                <DropdownMenuItem onSelect={() => setStatus('active')}>
                  <Play className="h-3.5 w-3.5" />
                  Resume
                </DropdownMenuItem>
              )}
              {a.status !== 'completed' && (
                <DropdownMenuItem onSelect={() => setStatus('completed')}>
                  <Check className="h-3.5 w-3.5" />
                  Mark complete
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive onSelect={onDelete}>
                <Trash2 className="h-3.5 w-3.5" />
                Remove
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {a.description && (
          <p className="mb-3 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {a.description}
          </p>
        )}
        <dl className="grid grid-cols-2 gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          <div>
            <dt className="text-muted-foreground/60">Frequency</dt>
            <dd className="text-foreground normal-case tracking-normal">{a.frequency}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground/60">Sets</dt>
            <dd className="text-foreground">{a.sets}</dd>
          </div>
        </dl>
        <div className="mt-3 border-t border-border/70 pt-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          Since {format(new Date(a.assigned_at), 'd MMM yyyy')}
        </div>
      </article>

      <EditAssignmentDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        assignment={a}
        patientId={patientId}
      />
    </>
  );
}

function EditAssignmentDialog({
  open,
  onOpenChange,
  assignment,
  patientId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  assignment: Assignment;
  patientId: string;
}) {
  const update = useUpdateAssignment(patientId);
  const [frequency, setFrequency] = useState(assignment.frequency);
  const [sets, setSets] = useState(assignment.sets);

  useMemo(() => {
    if (open) {
      setFrequency(assignment.frequency);
      setSets(assignment.sets);
    }
  }, [open, assignment]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    await update.mutateAsync({ assignmentId: assignment.id, body: { frequency, sets } });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Edit cadence
          </div>
          <DialogTitle>
            <em className="text-accent">{assignment.title}</em>
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={onSave} className="space-y-5">
          <div className="space-y-2">
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Frequency
            </div>
            <div className="flex flex-wrap gap-1.5">
              {FREQUENCIES.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFrequency(f)}
                  className={
                    'rounded-sm border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] transition-colors ' +
                    (frequency === f
                      ? 'border-foreground bg-foreground text-background'
                      : 'border-border bg-card text-muted-foreground hover:border-foreground/40 hover:text-foreground')
                  }
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Sets
            </div>
            <input
              type="number"
              min={1}
              value={sets}
              onChange={(e) => setSets(Math.max(1, Number(e.target.value) || 1))}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={update.isPending}>
              {update.isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default AssignmentsTab;
