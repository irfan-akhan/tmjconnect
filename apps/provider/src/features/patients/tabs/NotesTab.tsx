import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { z } from 'zod';
import { Lock, MoreVertical, Pencil, StickyNote, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import {
  useCreateNote,
  useDeleteNote,
  usePatientNotes,
  useUpdateNote,
  type ClinicalNote,
} from '@/features/patients/notes-queries';
import { EmptyState, SkeletonList } from './shared';

const noteFormSchema = z.object({
  body: z.string().min(1, 'A note needs at least one character.').max(10000, 'Too long.'),
  tagsText: z.string().max(500, 'Keep the tag list short.'),
});
type NoteFormValues = z.infer<typeof noteFormSchema>;

function parseTags(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20);
}

export function NotesTab({ patientId }: { patientId: string }) {
  const q = usePatientNotes(patientId);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ClinicalNote | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ClinicalNote | null>(null);
  const del = useDeleteNote(patientId);

  if (q.isLoading) return <SkeletonList />;
  if (q.isError) {
    return (
      <p className="py-8 text-sm text-destructive">
        {q.error instanceof Error ? q.error.message : 'Failed to load notes.'}
      </p>
    );
  }

  const rows = q.data?.data ?? [];

  return (
    <div className="space-y-6">
      {/* Privacy banner */}
      <div className="flex items-start gap-3 rounded-sm border-l-2 border-accent bg-accent/5 px-4 py-3">
        <Lock className="mt-0.5 h-4 w-4 stroke-[1.5] text-accent" />
        <div className="flex-1">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent">
            Private to you
          </div>
          <p className="text-sm text-muted-foreground">
            Clinical notes are never shared with the patient. Only you can read or edit them.
          </p>
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          New note
        </Button>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={StickyNote}
          title="No notes yet."
          body="Jot an observation, a plan, or a question for next visit — this space is yours."
          cta={
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              Write the first note
            </Button>
          }
        />
      ) : (
        <ol className="space-y-3">
          {rows.map((n) => (
            <NoteCard
              key={n.id}
              note={n}
              onEdit={() => {
                setEditing(n);
                setFormOpen(true);
              }}
              onDelete={() => setDeleteTarget(n)}
            />
          ))}
        </ol>
      )}

      <NoteFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        patientId={patientId}
        note={editing}
      />

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this note?</DialogTitle>
            <DialogDescription>
              This cannot be undone. The note will be permanently removed from the patient chart.
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
              {del.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NoteCard({
  note,
  onEdit,
  onDelete,
}: {
  note: ClinicalNote;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const edited = note.updated_at !== note.created_at;
  return (
    <li className="group rounded-sm border border-border/70 bg-card p-5">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          {format(new Date(note.created_at), 'd MMM yyyy · HH:mm')}
          {edited && (
            <span className="ml-2 text-muted-foreground/60">
              · edited {format(new Date(note.updated_at), 'd MMM')}
            </span>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100 data-[state=open]:opacity-100"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onEdit}>
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem destructive onSelect={onDelete}>
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <p className="whitespace-pre-wrap font-serif text-[15px] leading-[1.65] tracking-tight">
        {note.body}
      </p>

      {note.tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5 border-t border-border/70 pt-3">
          {note.tags.map((t) => (
            <span
              key={t}
              className="rounded-sm bg-secondary px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground"
            >
              {t}
            </span>
          ))}
        </div>
      )}
    </li>
  );
}

function NoteFormDialog({
  open,
  onOpenChange,
  patientId,
  note,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  patientId: string;
  note: ClinicalNote | null;
}) {
  const create = useCreateNote(patientId);
  const update = useUpdateNote(patientId);
  const isEdit = Boolean(note);
  const mutation = isEdit ? update : create;

  const form = useForm<NoteFormValues>({
    resolver: zodResolver(noteFormSchema),
    defaultValues: {
      body: note?.body ?? '',
      tagsText: (note?.tags ?? []).join(', '),
    },
  });

  // Reset whenever the dialog opens against a different note (or for a fresh one).
  useEffect(() => {
    if (!open) return;
    form.reset({
      body: note?.body ?? '',
      tagsText: (note?.tags ?? []).join(', '),
    });
  }, [open, note, form]);

  async function onSubmit(values: NoteFormValues) {
    const tags = parseTags(values.tagsText);
    try {
      if (isEdit && note) {
        await update.mutateAsync({ id: note.id, body: values.body, tags });
        toast.success('Note updated.');
      } else {
        await create.mutateAsync({ body: values.body, tags });
        toast.success('Note saved.');
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed.');
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            {isEdit ? 'Edit note' : 'New note'} · private to you
          </div>
          <DialogTitle>
            {isEdit ? 'Refine the observation.' : (
              <>A note for <em className="text-accent">the chart.</em></>
            )}
          </DialogTitle>
          <DialogDescription>
            Clinical notes are never visible to the patient.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="note-body" className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Body
            </Label>
            <Textarea
              id="note-body"
              rows={8}
              placeholder="Observations, plan, questions for next visit…"
              className="font-serif text-[15px] leading-[1.65]"
              aria-invalid={Boolean(form.formState.errors.body) || undefined}
              {...form.register('body')}
            />
            {form.formState.errors.body && (
              <p className="text-xs text-destructive">{form.formState.errors.body.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="note-tags" className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Tags · comma-separated
            </Label>
            <Input
              id="note-tags"
              placeholder="follow-up, imaging, bruxism"
              aria-invalid={Boolean(form.formState.errors.tagsText) || undefined}
              {...form.register('tagsText')}
            />
            {form.formState.errors.tagsText && (
              <p className="text-xs text-destructive">{form.formState.errors.tagsText.message}</p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending || form.formState.isSubmitting}>
              {mutation.isPending ? 'Saving…' : isEdit ? 'Save' : 'Create note'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default NotesTab;
