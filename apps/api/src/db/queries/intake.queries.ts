import { eq, and, desc, sql, ne } from 'drizzle-orm';
import type { Db } from '../../config/database';
import { intakeForms, intakeFormAssignments, intakeResponses } from '../schema';

type DbClient = Db['db'];

export type IntakeFieldDef = {
  type: 'scale' | 'checkbox' | 'text' | 'select' | 'number';
  label: string;
  options?: string[];
  required: boolean;
  order: number;
  min?: number;
  max?: number;
  placeholder?: string;
};

// ─── Provider: Form CRUD ────────────────────────────────────────────────

export async function createForm(db: DbClient, providerId: string, input: {
  title: string; description?: string | null; fields: IntakeFieldDef[];
}) {
  const [row] = await db.insert(intakeForms).values({
    provider_id: providerId,
    title: input.title,
    description: input.description ?? null,
    fields: input.fields,
  }).returning();
  return row;
}

export async function updateForm(db: DbClient, providerId: string, formId: string, input: {
  title?: string; description?: string | null; fields?: IntakeFieldDef[]; status?: string;
}) {
  const values: Record<string, unknown> = { updated_at: sql`NOW()` };
  if (input.title !== undefined) values.title = input.title;
  if (input.description !== undefined) values.description = input.description;
  if (input.fields !== undefined) values.fields = input.fields;
  if (input.status !== undefined) values.status = input.status;

  const [row] = await db.update(intakeForms)
    .set(values)
    .where(and(eq(intakeForms.id, formId), eq(intakeForms.provider_id, providerId)))
    .returning();
  if (!row) throw Object.assign(new Error('Form not found'), { statusCode: 404 });
  return row;
}

export async function deleteForm(db: DbClient, providerId: string, formId: string) {
  const result = await db.delete(intakeForms)
    .where(and(eq(intakeForms.id, formId), eq(intakeForms.provider_id, providerId)));
  return result;
}

export async function listForms(db: DbClient, providerId: string) {
  return db.select().from(intakeForms)
    .where(and(eq(intakeForms.provider_id, providerId), ne(intakeForms.status, 'archived')))
    .orderBy(desc(intakeForms.updated_at));
}

export async function getForm(db: DbClient, formId: string) {
  const [row] = await db.select().from(intakeForms).where(eq(intakeForms.id, formId));
  if (!row) throw Object.assign(new Error('Form not found'), { statusCode: 404 });
  return row;
}

// ─── Provider: Assignments ──────────────────────────────────────────────

export async function assignForm(db: DbClient, providerId: string, formId: string, patientId: string) {
  const [row] = await db.insert(intakeFormAssignments).values({
    form_id: formId,
    patient_id: patientId,
    provider_id: providerId,
  }).onConflictDoNothing().returning();
  if (!row) throw Object.assign(new Error('Form already assigned to this patient'), { statusCode: 409 });
  return row;
}

export async function listAssignmentsByPatient(db: DbClient, patientId: string) {
  type Row = {
    id: string; form_id: string; status: string; assigned_at: string;
    form_title: string; form_description: string | null; form_fields: unknown;
    provider_name: string;
  };
  const res = await db.execute<Row>(sql`
    SELECT a.id, a.form_id, a.status, a.assigned_at::text,
           f.title AS form_title, f.description AS form_description, f.fields AS form_fields,
           COALESCE(p.first_name || ' ' || p.last_name, 'Provider') AS provider_name
    FROM intake_form_assignments a
    JOIN intake_forms f ON f.id = a.form_id
    LEFT JOIN profiles p ON p.user_id = a.provider_id
    WHERE a.patient_id = ${patientId} AND a.status = 'pending'
    ORDER BY a.assigned_at DESC
  `);
  const rows = Array.isArray(res) ? res : (res as { rows?: Row[] }).rows ?? [];
  return rows;
}

export async function listResponsesByForm(db: DbClient, providerId: string, formId: string) {
  type Row = {
    id: string; patient_id: string; answers: unknown; submitted_at: string;
    patient_name: string;
  };
  const res = await db.execute<Row>(sql`
    SELECT r.id, r.patient_id, r.answers, r.submitted_at::text,
           COALESCE(p.first_name || ' ' || p.last_name, 'Patient') AS patient_name
    FROM intake_responses r
    JOIN intake_form_assignments a ON a.id = r.assignment_id
    LEFT JOIN profiles p ON p.user_id = r.patient_id
    WHERE r.form_id = ${formId} AND a.provider_id = ${providerId}
    ORDER BY r.submitted_at DESC
  `);
  const rows = Array.isArray(res) ? res : (res as { rows?: Row[] }).rows ?? [];
  return rows;
}

// ─── Patient: Submit Response ───────────────────────────────────────────

export async function submitResponse(db: DbClient, patientId: string, formId: string, answers: unknown[]) {
  const [assignment] = await db.select().from(intakeFormAssignments)
    .where(and(
      eq(intakeFormAssignments.form_id, formId),
      eq(intakeFormAssignments.patient_id, patientId),
      eq(intakeFormAssignments.status, 'pending'),
    ));
  if (!assignment) throw Object.assign(new Error('No pending assignment found'), { statusCode: 404 });

  const [response] = await db.insert(intakeResponses).values({
    assignment_id: assignment.id,
    form_id: formId,
    patient_id: patientId,
    answers,
  }).returning();

  await db.update(intakeFormAssignments)
    .set({ status: 'completed', completed_at: sql`NOW()` })
    .where(eq(intakeFormAssignments.id, assignment.id));

  return response;
}
