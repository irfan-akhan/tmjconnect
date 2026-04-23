import { useState } from 'react';
import { format } from 'date-fns';
import {
  ChevronDown, ChevronUp, ClipboardList, GripVertical,
  Pencil, Plus, Send, Trash2, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
  useIntakeForms, useCreateIntakeForm, useUpdateIntakeForm,
  useDeleteIntakeForm, useIntakeResponses, useAssignIntakeForm,
  type FieldDef, type IntakeForm,
} from '@/features/intake/queries';
import { usePatients } from '@/features/patients/queries';

const FIELD_TYPES = [
  { value: 'scale', label: 'Pain Scale (0-10)' },
  { value: 'checkbox', label: 'Checkbox List' },
  { value: 'text', label: 'Free Text' },
  { value: 'select', label: 'Single Select' },
  { value: 'number', label: 'Number' },
] as const;

export function IntakeFormsPage() {
  const { data: forms, isLoading } = useIntakeForms();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<IntakeForm | null>(null);
  const [viewingResponses, setViewingResponses] = useState<IntakeForm | null>(null);
  const [assigning, setAssigning] = useState<IntakeForm | null>(null);
  const del = useDeleteIntakeForm();

  function openNew() {
    setEditing(null);
    setEditorOpen(true);
  }

  function openEdit(form: IntakeForm) {
    setEditing(form);
    setEditorOpen(true);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-10">
      <header className="flex items-end justify-between gap-8 border-b border-border/70 pb-8">
        <div>
          <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            Folio № 09 — Intake
          </div>
          <h1 className="font-serif text-5xl tracking-tightest">
            Custom <em className="text-accent">forms.</em>
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Build questionnaires and assign them to patients during onboarding or check-ins.
          </p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4" /> New form</Button>
      </header>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-sm bg-secondary" />
          ))}
        </div>
      ) : !forms || forms.length === 0 ? (
        <div className="rounded-sm border border-dashed border-border bg-card/60 p-16 text-center">
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-sm bg-primary/10">
            <ClipboardList className="h-6 w-6 stroke-[1.5] text-primary" />
          </div>
          <h2 className="font-serif text-3xl tracking-tightest">No forms yet.</h2>
          <p className="mx-auto mt-3 max-w-sm text-sm text-muted-foreground">
            Create your first intake form — add pain scales, checkboxes, text fields, and more.
          </p>
          <Button className="mt-6" onClick={openNew}>Create your first form</Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {forms.map((form) => (
            <Card key={form.id} className="group">
              <CardHeader className="flex-row items-start justify-between pb-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <CardTitle className="font-serif text-lg tracking-tightest">{form.title}</CardTitle>
                    <span className={cn(
                      'rounded-sm px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.22em]',
                      form.status === 'published' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-secondary text-muted-foreground',
                    )}>
                      {form.status}
                    </span>
                  </div>
                  {form.description && (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{form.description}</p>
                  )}
                </div>
                <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(form)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => del.mutate(form.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                    {(form.fields as FieldDef[]).length} fields · Updated {format(new Date(form.updated_at), 'd MMM yyyy')}
                  </span>
                  <div className="flex gap-2">
                    {form.status === 'published' && (
                      <Button variant="default" size="sm" onClick={() => setAssigning(form)}>
                        <Send className="h-3.5 w-3.5" /> Assign
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => setViewingResponses(form)}>
                      Responses
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <FormEditorDialog open={editorOpen} onOpenChange={setEditorOpen} form={editing} />
      {viewingResponses && (
        <ResponsesDialog open={Boolean(viewingResponses)} onOpenChange={() => setViewingResponses(null)} form={viewingResponses} />
      )}
      {assigning && (
        <AssignFormDialog open={Boolean(assigning)} onOpenChange={() => setAssigning(null)} form={assigning} />
      )}
    </div>
  );
}

// ─── Form Editor Dialog ─────────────────────────────────────────────────────

function FormEditorDialog({ open, onOpenChange, form }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  form: IntakeForm | null;
}) {
  const isEdit = Boolean(form);
  const create = useCreateIntakeForm();
  const update = useUpdateIntakeForm(form?.id ?? '');
  const [title, setTitle] = useState(form?.title ?? '');
  const [description, setDescription] = useState(form?.description ?? '');
  const [fields, setFields] = useState<FieldDef[]>((form?.fields as FieldDef[]) ?? []);
  const [status, setStatus] = useState(form?.status ?? 'draft');

  function addField() {
    setFields([...fields, { type: 'text', label: '', required: false, order: fields.length }]);
  }

  function updateField(index: number, partial: Partial<FieldDef>) {
    setFields(fields.map((f, i) => i === index ? { ...f, ...partial } : f));
  }

  function removeField(index: number) {
    setFields(fields.filter((_, i) => i !== index).map((f, i) => ({ ...f, order: i })));
  }

  function moveField(index: number, direction: -1 | 1) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= fields.length) return;
    const updated = [...fields];
    [updated[index], updated[newIndex]] = [updated[newIndex]!, updated[index]!];
    setFields(updated.map((f, i) => ({ ...f, order: i })));
  }

  async function onSave() {
    const payload = { title, description: description || undefined, fields, status };
    if (isEdit) {
      await update.mutateAsync(payload);
    } else {
      await create.mutateAsync(payload as { title: string; description?: string; fields: FieldDef[] });
    }
    onOpenChange(false);
  }

  const busy = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            {isEdit ? 'Edit form' : 'New intake form'}
          </div>
          <DialogTitle className="font-serif text-2xl tracking-tightest">
            {isEdit ? 'Edit your questionnaire.' : <>Design a <em className="text-accent">questionnaire.</em></>}
          </DialogTitle>
          <DialogDescription>
            Add fields, set requirements, then publish when ready.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Initial TMJ Assessment" required />
            </div>
            <div className="space-y-2">
              <Label className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Status</Label>
              <div className="flex gap-2">
                {(['draft', 'published'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    className={cn(
                      'flex-1 rounded-sm border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] transition-colors',
                      status === s ? 'border-foreground bg-foreground text-background' : 'border-border text-muted-foreground hover:border-foreground/40',
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Instructions shown to the patient before they start" rows={2} />
          </div>

          {/* Field builder */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <Label className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                Fields ({fields.length})
              </Label>
              <Button type="button" variant="outline" size="sm" onClick={addField}>
                <Plus className="h-3.5 w-3.5" /> Add field
              </Button>
            </div>

            {fields.length === 0 ? (
              <div className="rounded-sm border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                No fields yet. Click "Add field" to start building your form.
              </div>
            ) : (
              <div className="space-y-3">
                {fields.map((field, i) => (
                  <div key={i} className="flex gap-3 rounded-sm border border-border/70 bg-secondary/20 p-4">
                    <div className="flex flex-col items-center gap-1 pt-1">
                      <button type="button" onClick={() => moveField(i, -1)} disabled={i === 0} className="text-muted-foreground disabled:opacity-30"><ChevronUp className="h-3.5 w-3.5" /></button>
                      <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40" />
                      <button type="button" onClick={() => moveField(i, 1)} disabled={i === fields.length - 1} className="text-muted-foreground disabled:opacity-30"><ChevronDown className="h-3.5 w-3.5" /></button>
                    </div>

                    <div className="flex-1 space-y-3">
                      <div className="grid grid-cols-[1fr_auto_auto] gap-3">
                        <Input value={field.label} onChange={(e) => updateField(i, { label: e.target.value })} placeholder="Field label" />
                        <select
                          value={field.type}
                          onChange={(e) => updateField(i, { type: e.target.value as FieldDef['type'] })}
                          className="rounded-sm border border-border bg-background px-3 py-2 text-xs"
                        >
                          {FIELD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                        <label className="flex items-center gap-2 text-xs text-muted-foreground">
                          <input type="checkbox" checked={field.required} onChange={(e) => updateField(i, { required: e.target.checked })} />
                          Required
                        </label>
                      </div>

                      {(field.type === 'checkbox' || field.type === 'select') && (
                        <Input
                          value={(field.options ?? []).join(', ')}
                          onChange={(e) => updateField(i, { options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
                          placeholder="Options (comma-separated): e.g. Clicking, Aching, Sharp"
                          className="text-xs"
                        />
                      )}

                      {field.type === 'scale' && (
                        <div className="flex gap-3">
                          <Input type="number" value={field.min ?? 0} onChange={(e) => updateField(i, { min: Number(e.target.value) })} placeholder="Min" className="w-20 text-xs" />
                          <span className="self-center text-xs text-muted-foreground">to</span>
                          <Input type="number" value={field.max ?? 10} onChange={(e) => updateField(i, { max: Number(e.target.value) })} placeholder="Max" className="w-20 text-xs" />
                        </div>
                      )}
                    </div>

                    <button type="button" onClick={() => removeField(i)} className="self-start text-muted-foreground hover:text-destructive">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onSave} disabled={busy || !title.trim()}>
            {busy ? 'Saving…' : isEdit ? 'Save changes' : 'Create form'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Responses Dialog ───────────────────────────────────────────────────────

function ResponsesDialog({ open, onOpenChange, form }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  form: IntakeForm;
}) {
  const { data: responses, isLoading } = useIntakeResponses(form.id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl tracking-tightest">
            Responses — {form.title}
          </DialogTitle>
          <DialogDescription>
            {responses?.length ?? 0} responses submitted
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-sm bg-secondary" />
            ))}
          </div>
        ) : !responses || responses.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            No responses yet. Assign this form to patients to start collecting data.
          </div>
        ) : (
          <div className="space-y-4">
            {responses.map((r) => (
              <div key={r.id} className="rounded-sm border border-border/70 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-semibold">{r.patient_name}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {format(new Date(r.submitted_at), 'MMM d, yyyy · h:mm a')}
                  </span>
                </div>
                <div className="space-y-2">
                  {(r.answers as Array<{ field_label: string; field_type: string; value: unknown }>).map((a, i) => (
                    <div key={i} className="flex justify-between border-b border-border/50 pb-2 last:border-0 last:pb-0">
                      <span className="text-xs text-muted-foreground">{a.field_label}</span>
                      <span className="text-xs font-semibold">
                        {Array.isArray(a.value) ? a.value.join(', ') : String(a.value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Assign Form to Patient Dialog ──────────────────────────────────────────

function AssignFormDialog({ open, onOpenChange, form }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  form: IntakeForm;
}) {
  const [search, setSearch] = useState('');
  const { data: patientsData, isLoading } = usePatients({ page: 1, limit: 50, search: search || undefined });
  const assign = useAssignIntakeForm(form.id);
  const patients = patientsData?.data ?? [];

  async function onAssign(patientId: string) {
    await assign.mutateAsync(patientId);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Assign form
          </div>
          <DialogTitle className="font-serif text-xl tracking-tightest">
            Send <em className="text-accent">{form.title}</em> to a patient
          </DialogTitle>
          <DialogDescription>
            The patient will see this form in their app and can fill it out.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Input
            placeholder="Search patients..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <div className="max-h-64 overflow-y-auto rounded-sm border border-border/70">
            {isLoading ? (
              <div className="p-6 text-center font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                Loading…
              </div>
            ) : patients.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                {search ? 'No patients match your search.' : 'No linked patients yet.'}
              </div>
            ) : (
              <ul className="divide-y divide-border/70">
                {patients.map((p) => (
                  <li key={p.patient_id}>
                    <button
                      type="button"
                      onClick={() => onAssign(p.patient_id)}
                      disabled={assign.isPending}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/40 disabled:opacity-50"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-primary font-mono text-xs text-primary-foreground">
                        {p.first_name?.[0]}{p.last_name?.[0]}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">{p.first_name} {p.last_name}</div>
                        <div className="font-mono text-[10px] text-muted-foreground">
                          Linked {format(new Date(p.linked_at), 'd MMM yyyy')}
                        </div>
                      </div>
                      <Send className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
