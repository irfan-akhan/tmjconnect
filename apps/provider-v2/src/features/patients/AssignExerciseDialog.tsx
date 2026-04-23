import { useState } from 'react';
import { Check, Dumbbell, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useExercises, type Exercise } from '@/features/exercises/queries';
import { useDebounced } from '@/hooks/useDebounced';
import { useCreateAssignment } from './assignment-mutations';

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  patientId: string;
  patientName?: string;
};

const FREQUENCIES = ['daily', '2x daily', '3x daily', 'alt days', 'weekly'];

export function AssignExerciseDialog({ open, onOpenChange, patientId, patientName }: Props) {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounced(search, 250);
  const [selected, setSelected] = useState<Exercise | null>(null);
  const [frequency, setFrequency] = useState('daily');
  const [sets, setSets] = useState(1);

  const { data, isLoading } = useExercises({ page: 1, limit: 50 });
  const create = useCreateAssignment(patientId);

  const filtered = (data?.data ?? []).filter((ex) =>
    debouncedSearch
      ? `${ex.title} ${ex.category ?? ''}`.toLowerCase().includes(debouncedSearch.toLowerCase())
      : true,
  );

  function reset() {
    setSearch('');
    setSelected(null);
    setFrequency('daily');
    setSets(1);
  }

  async function onAssign(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    await create.mutateAsync({
      exercise_id: selected.id,
      frequency,
      sets,
    });
    reset();
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            New assignment
          </div>
          <DialogTitle>
            {patientName ? (
              <>Prescribe a movement for <em className="text-accent">{patientName}</em>.</>
            ) : (
              'Prescribe a movement.'
            )}
          </DialogTitle>
          <DialogDescription>
            Pick one from your library, then set the cadence.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onAssign} className="space-y-5">
          {/* Search */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 stroke-[1.5] text-muted-foreground" />
            <Input
              placeholder="Search your library…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* List */}
          <div className="max-h-72 overflow-y-auto rounded-sm border border-border/70">
            {isLoading ? (
              <div className="p-8 text-center font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                Loading…
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center">
                <Dumbbell className="mx-auto h-6 w-6 stroke-[1.5] text-muted-foreground" />
                <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                  {debouncedSearch ? 'No matches in your library.' : 'Your library is empty. Add an exercise first.'}
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-border/70">
                {filtered.map((ex) => {
                  const active = selected?.id === ex.id;
                  return (
                    <li key={ex.id}>
                      <button
                        type="button"
                        onClick={() => setSelected(ex)}
                        className={cn(
                          'grid w-full grid-cols-[auto_1fr_auto] items-center gap-4 bg-card px-4 py-3 text-left transition-colors hover:bg-secondary/40',
                          active && 'bg-secondary',
                        )}
                      >
                        <div className={cn(
                          'flex h-8 w-8 items-center justify-center rounded-sm border',
                          active ? 'border-foreground bg-foreground text-background' : 'border-border bg-background',
                        )}>
                          {active ? <Check className="h-4 w-4" /> : <Dumbbell className="h-4 w-4 stroke-[1.5] text-muted-foreground" />}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate font-serif text-base tracking-tightest">{ex.title}</div>
                          {ex.category && (
                            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                              {ex.category}
                            </div>
                          )}
                        </div>
                        {ex.duration_seconds && (
                          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                            {Math.round(ex.duration_seconds / 60)}m
                          </div>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Cadence */}
          <div className="grid grid-cols-[2fr_1fr] gap-4">
            <div className="space-y-2">
              <Label className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                Frequency
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {FREQUENCIES.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFrequency(f)}
                    className={cn(
                      'rounded-sm border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] transition-colors',
                      frequency === f
                        ? 'border-foreground bg-foreground text-background'
                        : 'border-border bg-card text-muted-foreground hover:border-foreground/40 hover:text-foreground',
                    )}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sets" className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                Sets
              </Label>
              <Input
                id="sets"
                type="number"
                min={1}
                value={sets}
                onChange={(e) => setSets(Math.max(1, Number(e.target.value) || 1))}
              />
            </div>
          </div>

          {create.isError && (
            <p className="text-sm text-destructive">
              {create.error instanceof Error ? create.error.message : 'Failed to assign.'}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!selected || create.isPending}>
              {create.isPending ? 'Assigning…' : 'Assign exercise'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
