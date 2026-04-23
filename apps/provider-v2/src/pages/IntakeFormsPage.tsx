import { useState } from 'react';
import { format } from 'date-fns';
import {
  ChevronDown,
  ChevronUp,
  ClipboardList,
  GripVertical,
  Pencil,
  Plus,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import { Avatar, AvatarFallback, initials } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  useAssignIntakeForm,
  useCreateIntakeForm,
  useDeleteIntakeForm,
  useIntakeForms,
  useIntakeResponses,
  useUpdateIntakeForm,
  type FieldDef,
  type IntakeForm,
} from '@/features/intake/queries';
import { usePatients } from '@/features/patients/queries';

const FIELD_TYPES = [
  { value: 'scale', label: 'Pain scale (0–10)' },
  { value: 'checkbox', label: 'Checkbox list' },
  { value: 'text', label: 'Free text' },
  { value: 'select', label: 'Single select' },
  { value: 'number', label: 'Number' },
] as const;

export function IntakeFormsPage() {
  const { data: forms, isLoading } = useIntakeForms();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<IntakeForm | null>(null);
  const [viewingResponses, setViewingResponses] = useState<IntakeForm | null>(null);
  const [assigning, setAssigning] = useState<IntakeForm | null>(null);
  const del = useDeleteIntakeForm();

  const allForms = forms ?? [];
  const published = allForms.filter((f) => f.status === 'published');
  const drafts = allForms.filter((f) => f.status === 'draft');

  function openNew() {
    setEditing(null);
    setEditorOpen(true);
  }
  function openEdit(form: IntakeForm) {
    setEditing(form);
    setEditorOpen(true);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        eyebrow="Manage · Intake forms"
        title={
          <>
            Custom <em className="not-italic text-gold-700">forms.</em>
          </>
        }
        description={
          <>
            Build questionnaires and assign them to patients during onboarding or check-ins ·{' '}
            <span className="text-foreground">{published.length} published</span> ·{' '}
            <span className="text-foreground">{drafts.length} draft</span>
          </>
        }
        actions={
          <Button size="sm" onClick={openNew}>
            <Plus className="mr-2 h-3.5 w-3.5" />
            New form
          </Button>
        }
      />

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-44" />
          ))}
        </div>
      ) : allForms.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="h-6 w-6" />}
          title="No forms yet."
          description="Create your first intake form — add pain scales, checkboxes, text fields, and more."
          action={<Button onClick={openNew}>Create your first form</Button>}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {allForms.map((form) => (
            <FormCard
              key={form.id}
              form={form}
              onEdit={() => openEdit(form)}
              onDelete={() => del.mutate(form.id)}
              onAssign={() => setAssigning(form)}
              onView={() => setViewingResponses(form)}
            />
          ))}
        </div>
      )}

      <FormEditorDialog open={editorOpen} onOpenChange={setEditorOpen} form={editing} />
      {viewingResponses && (
        <ResponsesDialog
          open={Boolean(viewingResponses)}
          onOpenChange={() => setViewingResponses(null)}
          form={viewingResponses}
        />
      )}
      {assigning && (
        <AssignFormDialog
          open={Boolean(assigning)}
          onOpenChange={() => setAssigning(null)}
          form={assigning}
        />
      )}
    </div>
  );
}

function FormCard({
  form,
  onEdit,
  onDelete,
  onAssign,
  onView,
}: {
  form: IntakeForm;
  onEdit: () => void;
  onDelete: () => void;
  onAssign: () => void;
  onView: () => void;
}) {
  const fields = (form.fields as FieldDef[]) ?? [];
  return (
    <article className="group flex flex-col rounded-sm border border-border/70 bg-card shadow-navy-xs transition hover:shadow-navy-sm">
      <header className="flex items-start justify-between border-b border-border/60 p-5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-serif text-lg leading-tight tracking-tightest text-foreground">
              {form.title}
            </h3>
            <Badge variant={form.status === 'published' ? 'improving' : 'fyi'}>
              {form.status}
            </Badge>
          </div>
          {form.description && (
            <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
              {form.description}
            </p>
          )}
        </div>
        <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <Button variant="ghost" size="icon" onClick={onEdit} aria-label="Edit form" className="h-7 w-7">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onDelete} aria-label="Delete form" className="h-7 w-7">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </header>

      <footer className="flex items-center justify-between p-4">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          {fields.length} field{fields.length === 1 ? '' : 's'} · Updated{' '}
          {format(new Date(form.updated_at), 'd MMM')}
        </span>
        <div className="flex gap-2">
          {form.status === 'published' && (
            <Button variant="default" size="sm" onClick={onAssign}>
              <Send className="mr-1.5 h-3.5 w-3.5" />
              Assign
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onView}>
            Responses
          </Button>
        </div>
      </footer>
    </article>
  );
}

// ─── Form editor ──────────────────────────────────────────────────────────

function FormEditorDialog({
  open,
  onOpenChange,
  form,
}: {
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
  const [status, setStatus] = useState<IntakeForm['status']>(form?.status ?? 'draft');

  function addField() {
    setFields([...fields, { type: 'text', label: '', required: false, order: fields.length }]);
  }
  function updateField(index: number, partial: Partial<FieldDef>) {
    setFields(fields.map((f, i) => (i === index ? { ...f, ...partial } : f)));
  }
  function removeField(index: number) {
    setFields(fields.filter((_, i) => i !== index).map((f, i) => ({ ...f, order: i })));
  }
  function moveField(index: number, dir: -1 | 1) {
    const j = index + dir;
    if (j < 0 || j >= fields.length) return;
    const next = [...fields];
    [next[index], next[j]] = [next[j]!, next[index]!];
    setFields(next.map((f, i) => ({ ...f, order: i })));
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
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            {isEdit ? 'Edit form' : 'New intake form'}
          </div>
          <DialogTitle>
            {isEdit ? (
              'Edit your questionnaire.'
            ) : (
              <>
                Design a <em className="not-italic text-gold-700">questionnaire.</em>
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            Add fields, set requirements, then publish when ready.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                Title
              </Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Initial TMJ assessment"
                required
              />
            </div>
            <div className="space-y-2">
              <Label className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                Status
              </Label>
              <div className="flex gap-2">
                {(['draft', 'published'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    className={cn(
                      'flex-1 rounded-sm border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] transition-colors',
                      status === s
                        ? 'border-navy-600 bg-navy-600 text-background'
                        : 'border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground',
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Description
            </Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Instructions shown to the patient before they start."
              rows={2}
            />
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <Label className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                Fields ({fields.length})
              </Label>
              <Button type="button" variant="outline" size="sm" onClick={addField}>
                <Plus className="mr-1.5 h-3.5 w-3.5" /> Add field
              </Button>
            </div>

            {fields.length === 0 ? (
              <div className="rounded-sm border border-dashed border-border bg-secondary/20 p-8 text-center text-sm text-muted-foreground">
                No fields yet. Click "Add field" to start building.
              </div>
            ) : (
              <ul className="space-y-3">
                {fields.map((field, i) => (
                  <li key={i} className="flex gap-3 rounded-sm border border-border/70 bg-secondary/20 p-4">
                    <div className="flex flex-col items-center gap-1 pt-1">
                      <button
                        type="button"
                        onClick={() => moveField(i, -1)}
                        disabled={i === 0}
                        className="text-muted-foreground disabled:opacity-30"
                      >
                        <ChevronUp className="h-3.5 w-3.5" />
                      </button>
                      <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40" />
                      <button
                        type="button"
                        onClick={() => moveField(i, 1)}
                        disabled={i === fields.length - 1}
                        className="text-muted-foreground disabled:opacity-30"
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="flex-1 space-y-3">
                      <div className="grid grid-cols-[1fr_auto_auto] gap-3">
                        <Input
                          value={field.label}
                          onChange={(e) => updateField(i, { label: e.target.value })}
                          placeholder="Field label"
                        />
                        <select
                          value={field.type}
                          onChange={(e) =>
                            updateField(i, { type: e.target.value as FieldDef['type'] })
                          }
                          className="rounded-sm border border-border bg-card px-3 py-2 text-xs"
                        >
                          {FIELD_TYPES.map((t) => (
                            <option key={t.value} value={t.value}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                        <label className="flex items-center gap-2 text-xs text-muted-foreground">
                          <input
                            type="checkbox"
                            checked={field.required}
                            onChange={(e) => updateField(i, { required: e.target.checked })}
                            className="accent-navy-600"
                          />
                          Required
                        </label>
                      </div>

                      {(field.type === 'checkbox' || field.type === 'select') && (
                        <Input
                          value={(field.options ?? []).join(', ')}
                          onChange={(e) =>
                            updateField(i, {
                              options: e.target.value
                                .split(',')
                                .map((s) => s.trim())
                                .filter(Boolean),
                            })
                          }
                          placeholder="Options (comma-separated): e.g. Clicking, Aching, Sharp"
                          className="text-xs"
                        />
                      )}

                      {field.type === 'scale' && (
                        <div className="flex items-center gap-3">
                          <Input
                            type="number"
                            value={field.min ?? 0}
                            onChange={(e) => updateField(i, { min: Number(e.target.value) })}
                            placeholder="Min"
                            className="w-20 text-xs"
                          />
                          <span className="text-xs text-muted-foreground">to</span>
                          <Input
                            type="number"
                            value={field.max ?? 10}
                            onChange={(e) => updateField(i, { max: Number(e.target.value) })}
                            placeholder="Max"
                            className="w-20 text-xs"
                          />
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => removeField(i)}
                      className="self-start text-muted-foreground transition-colors hover:text-destructive"
                      aria-label="Remove field"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={busy || !title.trim()}>
            {busy ? 'Saving…' : isEdit ? 'Save changes' : 'Create form'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResponsesDialog({
  open,
  onOpenChange,
  form,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  form: IntakeForm;
}) {
  const { data: responses, isLoading } = useIntakeResponses(form.id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Responses · {form.title}</DialogTitle>
          <DialogDescription>
            {responses?.length ?? 0} response{(responses?.length ?? 0) === 1 ? '' : 's'} submitted.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        ) : !responses || responses.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            No responses yet. Assign this form to patients to start collecting data.
          </div>
        ) : (
          <ul className="space-y-3">
            {responses.map((r) => (
              <li key={r.id} className="rounded-sm border border-border/70 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="font-serif text-sm tracking-tightest text-foreground">
                    {r.patient_name}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    {format(new Date(r.submitted_at), 'd MMM yyyy · HH:mm')}
                  </span>
                </div>
                <div className="space-y-2">
                  {r.answers.map((a, i) => (
                    <div
                      key={i}
                      className="flex justify-between border-b border-border/40 pb-2 last:border-0 last:pb-0"
                    >
                      <span className="text-xs text-muted-foreground">{a.field_label}</span>
                      <span className="text-xs text-foreground">
                        {Array.isArray(a.value) ? a.value.join(', ') : String(a.value)}
                      </span>
                    </div>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AssignFormDialog({
  open,
  onOpenChange,
  form,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  form: IntakeForm;
}) {
  const [search, setSearch] = useState('');
  const { data: patientsData, isLoading } = usePatients({
    page: 1,
    limit: 50,
    search: search || undefined,
  });
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
          <DialogTitle>
            Send <em className="not-italic text-gold-700">{form.title}</em> to a patient
          </DialogTitle>
          <DialogDescription>
            They'll see this form in their app and can fill it out at their own pace.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Input
            placeholder="Search patients…"
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
              <ul className="divide-y divide-border/60">
                {patients.map((p) => (
                  <li key={p.patient_id}>
                    <button
                      type="button"
                      onClick={() => onAssign(p.patient_id)}
                      disabled={assign.isPending}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/40 disabled:opacity-50"
                    >
                      <Avatar size="sm">
                        <AvatarFallback>{initials(p.first_name, p.last_name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-serif text-sm tracking-tightest">
                          {p.first_name} {p.last_name}
                        </div>
                        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
