import { useState } from 'react';
import { Send } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
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
import { cn } from '@/lib/utils';
import { useCreateReportRequest } from './report-requests-queries';

const TEMPLATES = [
  'Could you file a quick update on your pain levels this week?',
  'Please submit a report with photos of the affected area today.',
  'How has your jaw mobility been since we adjusted your exercises?',
];

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  patientId: string;
  patientName?: string;
};

export function RequestReportDialog({ open, onOpenChange, patientId, patientName }: Props) {
  const create = useCreateReportRequest(patientId);
  const [prompt, setPrompt] = useState('');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await create.mutateAsync({ prompt: prompt.trim() });
      toast.success('Report request sent to patient.');
      setPrompt('');
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send.');
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) setPrompt('');
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Request a report
          </div>
          <DialogTitle>
            {patientName ? (
              <>Ask <em className="text-accent">{patientName}</em> to file a report.</>
            ) : (
              'Ask your patient to file a report.'
            )}
          </DialogTitle>
          <DialogDescription>
            They'll be notified and can submit directly from their app.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Starters
            </Label>
            <div className="flex flex-col gap-1.5">
              {TEMPLATES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setPrompt(t)}
                  className={cn(
                    'rounded-sm border px-3 py-2 text-left text-sm transition-colors',
                    prompt === t
                      ? 'border-foreground bg-secondary text-foreground'
                      : 'border-border bg-card text-muted-foreground hover:border-foreground/40 hover:text-foreground',
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Message to patient
            </Label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              required
              placeholder="Be specific about what you need them to share…"
            />
            <div className="flex justify-end font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              {prompt.length}/2000
            </div>
          </div>

          {create.isError && (
            <p className="text-sm text-destructive">
              {create.error instanceof Error ? create.error.message : 'Failed to send.'}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending || !prompt.trim()}>
              <Send className="h-4 w-4" />
              {create.isPending ? 'Sending…' : 'Send request'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
