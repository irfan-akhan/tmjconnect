import { useState } from 'react';
import { toast } from 'sonner';
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
import { cn } from '@/lib/utils';
import { useProviderCreateReport } from './report-requests-queries';

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  patientId: string;
  patientName?: string;
  /** Optional: closes out a pending report_request on success. */
  fulfillingRequestId?: string;
};

const URGENCIES: Array<{ value: 'routine' | 'concerning' | 'urgent'; label: string; tone: string }> = [
  { value: 'routine', label: 'Routine', tone: 'border-border text-muted-foreground' },
  { value: 'concerning', label: 'Concerning', tone: 'border-accent/30 text-accent' },
  { value: 'urgent', label: 'Urgent', tone: 'border-destructive/30 text-destructive' },
];

export function FileOnBehalfDialog({
  open,
  onOpenChange,
  patientId,
  patientName,
  fulfillingRequestId,
}: Props) {
  const create = useProviderCreateReport(patientId);
  const [urgency, setUrgency] = useState<'routine' | 'concerning' | 'urgent'>('routine');
  const [painLevel, setPainLevel] = useState<number | ''>('');
  const [description, setDescription] = useState('');
  const [patientNotes, setPatientNotes] = useState('');

  function reset() {
    setUrgency('routine');
    setPainLevel('');
    setDescription('');
    setPatientNotes('');
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await create.mutateAsync({
        urgency,
        pain_level: painLevel === '' ? null : painLevel,
        description: description.trim(),
        patient_notes: patientNotes.trim() || null,
        fulfilling_request_id: fulfillingRequestId,
      });
      toast.success('Report filed.');
      reset();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to file.');
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            File a report · on behalf
          </div>
          <DialogTitle>
            {patientName ? (
              <>For <em className="text-accent">{patientName}</em>.</>
            ) : (
              'File on your patient\'s behalf.'
            )}
          </DialogTitle>
          <DialogDescription>
            Use this when the patient can't — notes from a phone call, in-person visit, or urgent escalation. The report is logged with provider authorship.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Urgency
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {URGENCIES.map((u) => (
                <button
                  key={u.value}
                  type="button"
                  onClick={() => setUrgency(u.value)}
                  className={cn(
                    'rounded-sm border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] transition-colors',
                    urgency === u.value
                      ? 'border-foreground bg-foreground text-background'
                      : `bg-card ${u.tone} hover:border-foreground/40`,
                  )}
                >
                  {u.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-[1fr_auto] gap-4">
            <div className="space-y-2">
              <Label htmlFor="pain_level" className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                Pain level · 0–10
              </Label>
              <Input
                id="pain_level"
                type="number"
                min={0}
                max={10}
                value={painLevel}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === '') return setPainLevel('');
                  setPainLevel(Math.max(0, Math.min(10, Number(v))));
                }}
                placeholder="—"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Description
            </Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              required
              placeholder="What happened. Relevant history. What you observed."
            />
          </div>

          <div className="space-y-2">
            <Label className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Patient quotes · optional
            </Label>
            <Textarea
              value={patientNotes}
              onChange={(e) => setPatientNotes(e.target.value)}
              rows={3}
              placeholder="Direct quotes from the patient, if relevant."
            />
          </div>

          {create.isError && (
            <p className="text-sm text-destructive">
              {create.error instanceof Error ? create.error.message : 'Failed to file.'}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending || !description.trim()}>
              {create.isPending ? 'Filing…' : 'File report'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
