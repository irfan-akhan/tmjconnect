import { useRef, useState } from 'react';
import { Upload, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  useCreateExercise,
  useUpdateExercise,
  uploadVideo,
  type Exercise,
  type ExerciseInput,
} from './queries';

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  exercise?: Exercise | null;
};

export function ExerciseFormDialog({ open, onOpenChange, exercise }: Props) {
  const isEdit = Boolean(exercise);
  const create = useCreateExercise();
  const update = useUpdateExercise(exercise?.id ?? '');

  const [form, setForm] = useState<ExerciseInput>(() => ({
    title: exercise?.title ?? '',
    description: exercise?.description ?? '',
    category: exercise?.category ?? '',
    instructions: exercise?.instructions ?? '',
    duration_seconds: exercise?.duration_seconds ?? null,
    video_url: exercise?.video_url ?? null,
    thumbnail_url: exercise?.thumbnail_url ?? null,
  }));
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function update_<K extends keyof ExerciseInput>(k: K, v: ExerciseInput[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function onPickVideo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const { url } = await uploadVideo(file);
      update_('video_url', url);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: ExerciseInput = {
      ...form,
      description: form.description || null,
      category: form.category || null,
      instructions: form.instructions || null,
    };
    if (isEdit) {
      await update.mutateAsync(payload);
    } else {
      await create.mutateAsync(payload);
    }
    onOpenChange(false);
  }

  const mutation = isEdit ? update : create;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            {isEdit ? 'Edit exercise' : 'New exercise'}
          </div>
          <DialogTitle>
            {isEdit ? 'Refine the prescription.' : (
              <>Something new for <em className="text-accent">the library.</em></>
            )}
          </DialogTitle>
          <DialogDescription>
            Patients see the title, description, and video you upload here.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="title" className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Title
            </Label>
            <Input
              id="title"
              required
              value={form.title}
              onChange={(e) => update_('title', e.target.value)}
              placeholder="e.g. Jaw relaxation — controlled opening"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category" className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                Category
              </Label>
              <Input
                id="category"
                value={form.category ?? ''}
                onChange={(e) => update_('category', e.target.value)}
                placeholder="e.g. Mobility"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="duration" className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                Duration · seconds
              </Label>
              <Input
                id="duration"
                type="number"
                min={1}
                value={form.duration_seconds ?? ''}
                onChange={(e) => update_('duration_seconds', e.target.value ? Number(e.target.value) : null)}
                placeholder="120"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Description
            </Label>
            <Textarea
              id="description"
              rows={3}
              value={form.description ?? ''}
              onChange={(e) => update_('description', e.target.value)}
              placeholder="A short explainer the patient will read before starting."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="instructions" className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Instructions
            </Label>
            <Textarea
              id="instructions"
              rows={4}
              value={form.instructions ?? ''}
              onChange={(e) => update_('instructions', e.target.value)}
              placeholder="Step-by-step guidance shown alongside the video."
            />
          </div>

          {/* Video upload */}
          <div className="space-y-2">
            <Label className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Demonstration video
            </Label>
            {form.video_url ? (
              <div className="flex items-center gap-3 rounded-sm border border-border/70 bg-background p-3">
                <Video className="h-5 w-5 stroke-[1.5] text-accent" />
                <span className="truncate font-mono text-xs text-muted-foreground">{form.video_url}</span>
                <div className="ml-auto flex gap-2">
                  <a
                    href={form.video_url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground"
                  >
                    Preview
                  </a>
                  <button
                    type="button"
                    onClick={() => update_('video_url', null)}
                    className="font-mono text-[10px] uppercase tracking-[0.22em] text-destructive hover:underline"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="flex w-full flex-col items-center justify-center gap-2 rounded-sm border border-dashed border-border bg-card/60 py-8 transition-colors hover:border-foreground/40 hover:bg-secondary/40 disabled:opacity-50"
              >
                <Upload className="h-5 w-5 stroke-[1.5] text-muted-foreground" />
                <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                  {uploading ? 'Uploading…' : 'Click to upload · mp4 / mov'}
                </span>
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="video/mp4,video/quicktime,video/webm"
              className="hidden"
              onChange={onPickVideo}
            />
            {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}
          </div>

          {mutation.isError && (
            <p className="text-sm text-destructive">
              {mutation.error instanceof Error ? mutation.error.message : 'Save failed.'}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending || uploading}>
              {mutation.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Create exercise'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
